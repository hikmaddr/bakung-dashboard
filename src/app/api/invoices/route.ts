import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveBrandProfile, resolveAllowedBrandIds } from "@/lib/brand";
import { getAuth } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

function genInvoiceNumberBase() {
  const now = new Date();
  const year = now.getFullYear();
  return `INV-${year}`;
}

export async function GET(req: NextRequest) {
  try {
    const active = await getActiveBrandProfile();
    const sp = req.nextUrl.searchParams;
    const rangeRaw = (sp.get("range") || "").toLowerCase();
    const statusRaw = sp.get("status") || ""; // comma-separated allowed
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

    const where: any = {};
    if (active?.id) where.brandProfileId = active.id;
    if (start) where.issueDate = { gte: start, lt: now };
    if (statuses.length > 0) where.status = { in: statuses };

    const rows = await prisma.invoice.findMany({ orderBy: { createdAt: "desc" }, where, include: { customer: true, items: true, quotation: true } });
    return NextResponse.json({ success: true, data: rows });
  } catch (e) {
    console.error("GET /api/invoices error:", e);
    return NextResponse.json({ success: false, message: "Gagal mengambil invoice" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      invoiceNumber,
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
    } = body;

    if (!customerId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, message: "Customer dan items wajib diisi" }, { status: 400 });
    }

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
    let number = String(invoiceNumber || "").trim();
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

    // Guard brand berdasarkan izin
    const auth = await getAuth();
    const brand = await getActiveBrandProfile();
    if (!brand?.id) return NextResponse.json({ success: false, message: "Brand aktif tidak ditemukan" }, { status: 400 });
    const allowedBrandIds = await resolveAllowedBrandIds(auth?.userId ?? null, (auth?.roles as string[]) ?? [], []);
    if (!allowedBrandIds.includes(brand.id)) return NextResponse.json({ success: false, message: "Forbidden: brand scope" }, { status: 403 });

    const inv = await prisma.invoice.create({
      data: {
        invoiceNumber: number,
        issueDate: new Date(invoiceDate || new Date()),
        dueDate: new Date(dueDate || new Date()),
        status: "Draft",
        notes: notes ? String(notes).slice(0, 191) : null,
        terms: terms ? String(terms).slice(0, 191) : null,
        customerId: Number(customerId),
        quotationId: quotationId != null ? Number(quotationId) : undefined,
        brandProfileId: brand.id,
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
            name: it.name,
            description: it.description || "",
            qty: Number(it.qty) || 0,
            unit: it.unit || "pcs",
            price: Number(it.price) || 0,
            discount: Number(it.discount) || 0,
            discountType: it.discountType || "percent",
            subtotal: Number(it.qty || 0) * Number(it.price || 0),
          })),
        },
      },
      include: { customer: true, items: true },
    });
    // Catat aktivitas pembuatan invoice
    try {
      await logActivity(req, {
        userId: auth?.userId || null,
        action: "INVOICE_CREATE",
        entity: "invoice",
        entityId: inv.id,
        metadata: {
          brandProfileId: brand.id,
          invoiceNumber: inv.invoiceNumber,
          total: inv.total,
          customerId: inv.customerId,
          quotationId: inv.quotationId || null,
          taxMode,
          downPayment: Number(downPayment) || 0,
        },
      });
    } catch {}

    return NextResponse.json({ success: true, data: inv });
  } catch (e: any) {
    console.error("POST /api/invoices error:", e);
    const message = e?.code === 'P2002'
      ? 'Nomor invoice sudah digunakan'
      : e?.code === 'P2021'
      ? 'Tabel invoice/invoiceitem belum ada di database. Jalankan prisma migrate.'
      : (e?.message || 'Gagal menyimpan invoice');
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
