import { NextResponse, type NextRequest } from "next/server";
export const revalidate = 60;
import { prisma } from "@/lib/prisma";
import { sendNotificationToRole } from "@/lib/notification";
import { saveFile as saveFileUtil } from "@/lib/storage";
import { quotationSchema } from "@/lib/validations";
import { createApiHandler } from "@/lib/api-handler";

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

export const GET = createApiHandler({
  handler: async (req, _, { activeBrand }) => {
    // Parse optional filters
    const sp = req.nextUrl.searchParams;
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
    if (start) where.date = { gte: start, lt: now };
    if (statuses.length > 0) where.status = { in: statuses };

    const page = Number(sp.get("page")) || 1;
    const limit = Number(sp.get("limit")) || 50;
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      prisma.quotation.findMany({
        orderBy: { createdAt: "desc" },
        where,
        include: { customer: true, items: true },
        skip,
        take: limit,
      }),
      prisma.quotation.count({ where })
    ]);

    // Build conversion flags
    const quotationIds = rows.map((q) => q.id);
    let invoiceByQuotation = new Set<number>();
    let soByQuotation = new Set<number>();
    if (quotationIds.length > 0) {
      try {
        const invoices = await prisma.invoice.findMany({
          where: { quotationId: { in: quotationIds } },
          select: { quotationId: true },
        });
        invoiceByQuotation = new Set(invoices.map((i) => i.quotationId).filter((id): id is number => id !== null));
      } catch {}
      try {
        const salesOrders = await prisma.salesOrder.findMany({
          where: { quotationId: { in: quotationIds } },
          select: { quotationId: true },
        });
        soByQuotation = new Set(salesOrders.map((s) => s.quotationId).filter((id): id is number => id !== null));
      } catch {}
    }

    const data = rows.map((q: any) => ({
      ...q,
      total: q.totalAmount ?? 0,
      hasInvoice: invoiceByQuotation.has(q.id),
      hasSalesOrder: soByQuotation.has(q.id),
      sentVia: q.sentVia,
    }));

    const responseData = { 
      success: true, 
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };

    const fmt = sp.get("format");
    if (fmt === "std") return NextResponse.json(responseData);
    return NextResponse.json(data);
  }
});

export const POST = createApiHandler({
  actionName: "QUOTATION_CREATE",
  entityType: "quotation",
  handler: async (req, formData: FormData, { activeBrand }) => {
    const quotationNumber = formData.get("quotationNumber") as string;
    const date = formData.get("date") as string;
    const validUntil = formData.get("validUntil") as string;
    const projectDescription = formData.get("projectDescription") as string;
    const rawNotes = formData.get("notes");
    const notes = typeof rawNotes === "string" ? rawNotes.trim() : "";
    const customerId = formData.get("customerId");
    let status = formData.get("status") as string;
    const itemsRaw = formData.get("items") as string;
    const items = itemsRaw ? JSON.parse(itemsRaw) : [];

    // Map frontend variants to valid schema/DB status
    if (status === "Confirmed" || status === "SendPDF") {
      status = "Sent";
    }

    // Manual validation since it's FormData
    const result = quotationSchema.safeParse({
      quotationNumber,
      date,
      validUntil,
      projectDescription,
      notes,
      customerId,
      status,
      items,
    });

    if (!result.success) {
      const flattened = result.error.flatten();
      console.error("[QUOTATION_CREATE] Validation failed:", flattened.fieldErrors);
      return NextResponse.json({
        success: false,
        message: "Data tidak valid. Silakan periksa kembali input Anda.",
        errors: flattened.fieldErrors,
        formErrors: flattened.formErrors,
      }, { status: 400 });
    }

    const validatedData = result.data;
    const MAX_SIZE = 5 * 1024 * 1024;
    const ALLOWED = new Set([
      "image/png", "image/jpeg", "image/jpg", "image/webp", "application/pdf",
    ]);

    const projectFile = formData.get("projectFile") as File | null;
    let projectFileUrl: string | null = null;
    if (projectFile && (projectFile as any).size) {
      const type = projectFile.type || "";
      const size = projectFile.size || 0;
      if (size > MAX_SIZE) throw new Error("Ukuran lampiran project melebihi 5MB.");
      if (type && !ALLOWED.has(type)) throw new Error("Tipe lampiran project tidak didukung.");
      projectFileUrl = await saveFile(projectFile);
    }

    const processedItems = await Promise.all(
      validatedData.items.map(async (item: any) => {
        let imageUrl: string | null = null;
        if (item.imageKey) {
          const file = formData.get(item.imageKey) as File;
          console.log(`[API Quotation] Processing file for key: ${item.imageKey}, file found: ${!!file}, size: ${file?.size}`);
          if (file && (file as any).size) {
            const type = file.type || "";
            const size = file.size || 0;
            if (size > MAX_SIZE) throw new Error(`Ukuran file terlalu besar untuk item '${item.product}'`);
            if (type && !ALLOWED.has(type)) throw new Error(`Tipe file tidak didukung untuk item '${item.product}'`);
            imageUrl = await saveFile(file);
            console.log(`[API Quotation] File saved to: ${imageUrl}`);
          }
        }

        return {
          product: item.product.trim(),
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          price: item.price,
          subtotal: item.quantity * item.price,
          imageUrl: imageUrl ?? (typeof item.imageUrl === "string" ? item.imageUrl.trim() || null : null),
          supplierCost: item.supplierCost ?? 0,
          titipanCostAdjustment: item.titipanCostAdjustment ?? 0,
          hiddenMargin: item.hiddenMargin ?? 0,
          taxAdjustment: item.taxAdjustment ?? 0,
        };
      })
    );

    const totalAmount = processedItems.reduce((acc: number, it: any) => acc + it.subtotal, 0);

    const quotation = await prisma.quotation.create({
      data: {
        quotationNumber: validatedData.quotationNumber,
        date: validatedData.date,
        validUntil: validatedData.validUntil,
        projectDesc: validatedData.projectDescription,
        projectFileUrl,
        customerId: validatedData.customerId,
        status: validatedData.status,
        notes: validatedData.notes,
        totalAmount,
        brandProfileId: activeBrand.id,
        isNegotiated: validatedData.isNegotiated,
        originalAmount: validatedData.originalAmount,
        negotiatedAmount: validatedData.negotiatedAmount,
        marginChange: validatedData.marginChange,
        negotiationNotes: validatedData.negotiationNotes,
        clientPoUrl: validatedData.clientPoUrl,
        clientSoUrl: validatedData.clientSoUrl,
        clientOtherFiles: validatedData.clientOtherFiles || [],
        items: { create: processedItems },
      },
      include: { customer: true, items: true },
    });

    try {
      await sendNotificationToRole(
        "Admin",
        "Quotation baru",
        `Quotation ${quotation.quotationNumber} dibuat dengan total ${totalAmount.toLocaleString()}`,
        "info",
        activeBrand.id
      );
    } catch {}

    return NextResponse.json({ success: true, message: "Quotation berhasil disimpan", data: quotation });
  }
});

