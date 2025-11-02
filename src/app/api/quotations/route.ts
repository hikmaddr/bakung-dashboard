import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveBrandProfile } from "@/lib/brand";
import { sendNotificationToRole } from "@/lib/notification";
import { saveFile as saveFileUtil } from "@/lib/storage";
import path from "path";
import crypto from "crypto";
// Ensure Node.js runtime for Prisma and fs operations
export const runtime = "nodejs";

// Gunakan util `saveFile` yang mendukung Vercel Blob dan fallback lokal
async function saveFile(file: File) {
  const MAX_SIZE = 5 * 1024 * 1024; // 5MB
  const ALLOWED = [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "application/pdf",
  ];
  const { url } = await saveFileUtil(file, {
    prefix: "quo/",
    allowedContentTypes: ALLOWED,
    maxSizeBytes: MAX_SIZE,
  });
  return url;
}

// ==============================
// GET /api/quotations  -> list
// ==============================
export async function GET(req: NextRequest, _ctx: { params: Promise<{}> }) {
  try {
    const active = await getActiveBrandProfile();

    // Parse optional filters
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
    if (start) where.date = { gte: start, lt: now };
    if (statuses.length > 0) where.status = { in: statuses };

    const rows = await prisma.quotation.findMany({
      orderBy: { createdAt: "desc" },
      where,
      include: { customer: true, items: true },
    });

    // Build conversion flags (hasInvoice / hasSalesOrder) efficiently
    const quotationIds = rows.map((q) => q.id);
    let invoiceByQuotation = new Set<number>();
    let soByQuotation = new Set<number>();
    if (quotationIds.length > 0) {
      try {
        const invoices = await prisma.invoice.findMany({
          where: { quotationId: { in: quotationIds } },
          select: { quotationId: true },
        });
        invoiceByQuotation = new Set(invoices.map((i) => i.quotationId));
      } catch {}
      try {
        const salesOrders = await prisma.salesOrder.findMany({
          where: { quotationId: { in: quotationIds } },
          select: { quotationId: true },
        });
        soByQuotation = new Set(salesOrders.map((s) => s.quotationId));
      } catch {}
    }

    // Add 'total' alias expected by client list page and conversion flags
    const data = rows.map((q: any) => ({
      ...q,
      total: q.totalAmount ?? 0,
      hasInvoice: invoiceByQuotation.has(q.id),
      hasSalesOrder: soByQuotation.has(q.id),
    }));
    const fmt = sp.get("format");
    if (fmt === "std") return NextResponse.json({ success: true, data });
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("GET /api/quotations error:", err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

// ==============================
// POST /api/quotations -> create
// ==============================
export async function POST(req: NextRequest, _ctx: { params: Promise<{}> }) {
  try {
    const formData = await req.formData();

    const quotationNumber = formData.get("quotationNumber") as string;
    const date = formData.get("date") as string;
    const validUntil = formData.get("validUntil") as string;
    const projectDescription = formData.get("projectDescription") as string;
    const rawNotes = formData.get("notes");
    const notes =
      typeof rawNotes === "string"
        ? rawNotes.trim()
        : "";
    const customerId = Number(formData.get("customerId"));
    const status = formData.get("status") as string;
    const items = JSON.parse(formData.get("items") as string);

    const now = new Date();

    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    const ALLOWED = new Set([
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
      "application/pdf",
    ]);

    const projectFile = formData.get("projectFile") as File | null;
    let projectFileUrl: string | null = null;
    if (projectFile && (projectFile as any).size) {
      const type = (projectFile as any).type || "";
      const size = (projectFile as any).size || 0;
      if (size > MAX_SIZE) {
        throw new Error("Ukuran lampiran project melebihi 5MB.");
      }
      if (type && !ALLOWED.has(type)) {
        throw new Error("Tipe lampiran project tidak didukung.");
      }
      projectFileUrl = await saveFile(projectFile);
    }

    const processedItems = await Promise.all(
      items.map(async (item: any) => {
        let imageUrl: string | null = null;
        if (item.imageKey) {
          const file = formData.get(item.imageKey) as File;
          if (file) {
            const type = (file as any).type || "";
            const size = (file as any).size || 0;
            if (size > MAX_SIZE) {
              throw new Error(`Ukuran file terlalu besar untuk item '${item.product}' (maks 5MB)`);
            }
            if (type && !ALLOWED.has(type)) {
              throw new Error(`Tipe file tidak didukung untuk item '${item.product}'`);
            }
            imageUrl = await saveFile(file);
          }
        }

        const qty = Number(item.quantity);
        const price = Number(item.price);
        const productName = String(item.product || "").trim();
        return {
          product: productName,
          description: item.description,
          quantity: qty,
          unit: item.unit,
          price: price,
          subtotal: qty * price,
          imageUrl:
            imageUrl ??
            (typeof item.imageUrl === "string" && item.imageUrl.trim()
              ? item.imageUrl.trim()
              : null),
        };
      })
    );

    const totalAmount = processedItems.reduce((acc: number, it: any) => acc + it.subtotal, 0);

  const quotation = await prisma.quotation.create({
    data: {
      quotationNumber,
      date: new Date(date),
      validUntil: new Date(validUntil),
      projectDesc: projectDescription,
      projectFileUrl,
      customerId,
      status,
      notes: notes ? notes : null,
      totalAmount,
      // Tag brand aktif
      brandProfileId: (await getActiveBrandProfile())?.id,
      items: { create: processedItems },
    },
    include: { customer: true, items: true },
  });

    // Notify brand Admins about new quotation
    try {
      const brandId = quotation.brandProfileId ?? null;
      await sendNotificationToRole(
        "Admin",
        "Quotation baru",
        `Quotation ${quotation.quotationNumber} dibuat dengan total ${totalAmount.toLocaleString()}`,
        "info",
        brandId ?? undefined
      );
    } catch {}

    return NextResponse.json({ success: true, message: "Quotation berhasil disimpan", data: quotation });
  } catch (err: any) {
    console.error("POST /api/quotations error:", err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
