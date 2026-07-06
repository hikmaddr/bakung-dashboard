import { NextResponse, type NextRequest } from "next/server";
export const revalidate = 60;
import { prisma } from "@/lib/prisma";
import { InvoiceStatus } from "@prisma/client";
import { sendNotificationToRole } from "@/lib/notification";
import { invoiceSchema } from "@/lib/validations";
import { createApiHandler } from "@/lib/api-handler";

function genInvoiceNumberBase() {
  const now = new Date();
  const year = now.getFullYear();
  return `INV-${year}`;
}

export const GET = createApiHandler({
  handler: async (req, _, { activeBrand }) => {
    await ensureInvoiceDueNotifications(activeBrand.id);
    const sp = req.nextUrl.searchParams;
    const includeDeleted = sp.get("includeDeleted") === "1";
    const rangeRaw = (sp.get("range") || "").toLowerCase();
    const statusRaw = sp.get("status") || "";
    const days = (() => {
      const m = rangeRaw.match(/^(\d+)d$/);
      return m ? Number(m[1]) : undefined;
    })();
    const now = new Date();
    const start = days ? new Date(now.getTime() - days * 24 * 60 * 60 * 1000) : undefined;
    const statuses = statusRaw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => !!s);

    const where: any = { brandProfileId: activeBrand.id };
    if (start) where.issueDate = { gte: start, lt: now };
    if (statuses.length > 0) where.status = { in: statuses };
    if (!includeDeleted) where.deletedAt = null;

    const page = Number(sp.get("page")) || 1;
    const limit = Number(sp.get("limit")) || 50;
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      prisma.invoice.findMany({
        orderBy: { createdAt: "desc" },
        where,
        include: { customer: true, items: true, quotation: true },
        skip,
        take: limit,
      }),
      prisma.invoice.count({ where })
    ]);

    return NextResponse.json({ 
      success: true, 
      data: rows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  }
});

export const POST = createApiHandler({
  schema: invoiceSchema,
  actionName: "INVOICE_CREATE",
  entityType: "invoice",
  handler: async (req, validatedData, { activeBrand }) => {
    const {
      invoiceDate,
      dueDate,
      customerId,
      quotationId,
      items,
      notes,
      terms,
      extraDiscountType = "amount",
      extraDiscountValue = 0,
      shippingCost = 0,
      taxMode = "none",
      downPayment = 0,
    } = validatedData;

    // compute
    const subtotal = items.reduce((acc: number, it: any) => acc + Number(it.qty || 0) * Number(it.price || 0), 0);
    const lineDiscount = items.reduce((acc: number, it: any) => {
      const base = Number(it.qty || 0) * Number(it.price || 0);
      const t = (it.discountType || "percent") === "amount"
        ? Math.max(0, Math.min(base, Number(it.discount) || 0))
        : Math.round((base * Math.max(0, Math.min(100, Number(it.discount) || 0))) / 100);
      return acc + t;
    }, 0);
    const baseAfterLine = Math.max(0, subtotal - lineDiscount);
    const extraDisc = extraDiscountType === "percent"
      ? Math.round((baseAfterLine * Math.max(0, Math.min(100, Number(extraDiscountValue) || 0))) / 100)
      : Math.min(baseAfterLine, Math.max(0, Number(extraDiscountValue) || 0));
    const afterExtra = Math.max(0, baseAfterLine - extraDisc);
    const basePlusShip = Math.max(0, afterExtra + Number(shippingCost || 0));
    let taxRate = 0, taxInclusive = false;
    if (taxMode === "ppn_11_inclusive") { taxRate = 11; taxInclusive = true; }
    else if (taxMode === "ppn_11_exclusive") { taxRate = 11; taxInclusive = false; }
    else if (taxMode === "ppn_12_inclusive") { taxRate = 12; taxInclusive = true; }
    else if (taxMode === "ppn_12_exclusive") { taxRate = 12; taxInclusive = false; }
    const taxAmount = taxRate === 0 ? 0 : (taxInclusive ? Math.round((basePlusShip * taxRate) / (100 + taxRate)) : Math.round((basePlusShip * taxRate) / 100));
    const totalBeforeDP = taxInclusive ? basePlusShip : basePlusShip + taxAmount;
    const total = Math.max(0, totalBeforeDP - Number(downPayment || 0));

    // generate number if not provided or duplicate
    let number = String(validatedData.invoiceNumber || "").trim();
    if (!number) {
      const base = genInvoiceNumberBase();
      const count = await prisma.invoice.count({ where: { invoiceNumber: { startsWith: base } } });
      number = `${base}-${String(count + 1).padStart(4, "0")}`;
    } else {
      const exists = await prisma.invoice.count({ where: { invoiceNumber: number } });
      if (exists > 0) {
        const base = genInvoiceNumberBase();
        const count = await prisma.invoice.count({ where: { invoiceNumber: { startsWith: base } } });
        number = `${base}-${String(count + 1).padStart(4, "0")}`;
      }
    }

    const inv = await prisma.invoice.create({
      data: {
        invoiceNumber: number,
        issueDate: new Date(invoiceDate || new Date()),
        dueDate: new Date(dueDate || new Date()),
        status: InvoiceStatus.Draft,
        notes: notes ? String(notes).slice(0, 191) : null,
        terms: terms ? String(terms).slice(0, 191) : null,
        customerId: Number(customerId),
        quotationId: quotationId != null ? Number(quotationId) : undefined,
        brandProfileId: activeBrand.id,
        subtotal,
        lineDiscount,
        extraDiscountType,
        extraDiscountValue,
        shippingCost: Number(shippingCost) || 0,
        taxMode,
        taxAmount: Number(taxAmount) || 0,
        downPayment: Number(downPayment) || 0,
        total,
        items: {
          create: items.map((it: any) => ({
            name: String(it.name ?? "").slice(0, 191),
            description: it.description ? String(it.description).slice(0, 191) : null,
            qty: Number(it.qty) || 0,
            unit: String(it.unit || "pcs").slice(0, 32),
            price: Number(it.price) || 0,
            discount: Number(it.discount) || 0,
            discountType: String(it.discountType || "percent").slice(0, 32),
            subtotal: Number(it.qty || 0) * Number(it.price || 0),
          })),
        },
      },
      include: { customer: true, items: true },
    });

    try {
      await sendNotificationToRole(
        "Owner",
        "Invoice baru dibuat",
        `Invoice ${inv.invoiceNumber} berhasil dibuat dengan total ${inv.total.toLocaleString()}.`,
        "info",
        activeBrand.id,
        `/penjualan/invoice-penjualan/${inv.id}`,
      );
    } catch {}

    return NextResponse.json({ success: true, data: inv });
  }
});

async function ensureInvoiceDueNotifications(brandId: number | null) {
  const now = new Date();
  const threshold = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const where: any = {
    deletedAt: null,
    dueDate: { lte: threshold },
    status: { notIn: [InvoiceStatus.Paid, InvoiceStatus.Void, InvoiceStatus.Canceled] },
  };
  if (brandId != null) {
    where.brandProfileId = brandId;
  }

  const dueInvoices = await prisma.invoice.findMany({
    where,
    select: { id: true, invoiceNumber: true, dueDate: true, brandProfileId: true },
  });

  if (dueInvoices.length === 0) return;

  const targetUrls = dueInvoices.map(inv => `/penjualan/invoice-penjualan/${inv.id}`);
  
  const existingNotifications = await prisma.notification.findMany({
    where: {
      targetUrl: { in: targetUrls },
      title: "Invoice jatuh tempo",
    },
    select: { targetUrl: true }
  });

  const notifiedUrls = new Set(existingNotifications.map(n => n.targetUrl));

  for (const invoice of dueInvoices) {
    const targetUrl = `/penjualan/invoice-penjualan/${invoice.id}`;
    if (notifiedUrls.has(targetUrl)) continue;

    const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;
    const isOverdue = dueDate ? dueDate.getTime() < now.getTime() : false;
    const message = dueDate
      ? `Invoice ${invoice.invoiceNumber} ${isOverdue ? "telah melewati" : "mendekati"} jatuh tempo (${dueDate.toLocaleDateString()}).`
      : `Invoice ${invoice.invoiceNumber} mendekati jatuh tempo.`;

    await sendNotificationToRole(
      "Owner",
      "Invoice jatuh tempo",
      message,
      "warning",
      invoice.brandProfileId ?? undefined,
      targetUrl,
    );
  }
}
