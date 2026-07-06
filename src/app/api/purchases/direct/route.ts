import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { sendNotificationToRole } from "@/lib/notification";
import { saveFile } from "@/lib/storage";
import { createApiHandler } from "@/lib/api-handler";
import { resolveAllowedBrandIds } from "@/lib/brand";

async function saveAttachments(formData: FormData) {
  const files: File[] = [];
  const attachments: { url: string; name: string; type: string }[] = [];
  for (const [key, value] of formData.entries()) {
    if (key === "attachments" && value instanceof File) files.push(value);
  }
  for (const f of files) {
    const result = await saveFile(f, {
      prefix: "attachments/",
      maxSizeBytes: 20 * 1024 * 1024,
    });
    attachments.push({ url: result.url, name: f.name, type: f.type });
  }
  return attachments;
}

export const GET = createApiHandler({
  handler: async (req, _, { activeBrand, user }) => {
    const allowedBrandIds = await resolveAllowedBrandIds(
      user.userId,
      user.roles || [],
      []
    );
    const search = req.nextUrl.searchParams;
    const q = search.get("q")?.trim();
    const status = search.get("status")?.trim() || undefined;
    const brandIdStr = search.get("brandId")?.trim();
    const dateFromStr = search.get("dateFrom")?.trim();
    const dateToStr = search.get("dateTo")?.trim();
    const page = parseInt(search.get("page") || "1");
    const pageSize = parseInt(search.get("pageSize") || "20");

    const where: any = {};
    let brandId: number | null = null;
    if (brandIdStr) {
      const parsed = Number(brandIdStr);
      if (!Number.isNaN(parsed)) brandId = parsed;
    }

    if (brandId != null) {
      if (allowedBrandIds.length && !allowedBrandIds.includes(brandId)) {
        return NextResponse.json(
          { success: false, message: "Forbidden: brand scope" },
          { status: 403 }
        );
      }
      where.brandProfileId = brandId;
    } else {
      if (allowedBrandIds.length) {
        where.brandProfileId = { in: allowedBrandIds };
      } else {
        where.brandProfileId = activeBrand.id;
      }
    }

    if (q) where.OR = [{ purchaseNumber: { contains: q } }, { supplierName: { contains: q } }];
    if (status) where.status = status;
    if (dateFromStr || dateToStr) {
      where.date = {} as any;
      if (dateFromStr) (where.date as any).gte = new Date(dateFromStr);
      if (dateToStr) (where.date as any).lte = new Date(dateToStr);
    }

    const [total, rows] = await Promise.all([
      prisma.purchaseDirect.count({ where }),
      prisma.purchaseDirect.findMany({
        where,
        include: { items: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({ success: true, data: rows, total, page, pageSize });
  }
});

export const POST = createApiHandler({
  actionName: "PURCHASE_CREATE",
  entityType: "purchase_direct",
  handler: async (req, body, { activeBrand, user }) => {
    let payload: any = {};
    let attachments: any[] = [];

    if (body instanceof FormData) {
      const itemsRaw = body.get("items") as string | null;
      attachments = await saveAttachments(body);
      payload = {
        purchaseNumber: String(body.get("purchaseNumber") || ""),
        date: new Date(String(body.get("date") || new Date().toISOString())),
        supplierName: String(body.get("supplierName") || ""),
        marketplaceOrderId: (body.get("marketplaceOrderId") as string) || undefined,
        notes: (body.get("notes") as string) || undefined,
        shippingCost: Number(body.get("shippingCost") || 0),
        fee: Number(body.get("fee") || 0),
        tax: Number(body.get("tax") || 0),
        items: itemsRaw ? JSON.parse(itemsRaw) : [],
      };
    } else {
      payload = body;
      attachments = payload.attachments || [];
    }

    if (!payload.purchaseNumber) {
      return NextResponse.json({ success: false, message: "purchaseNumber wajib" }, { status: 400 });
    }

    const itemsNormalized = (payload.items || []).map((it: any) => ({
      productId: it.productId ?? null,
      name: it.name,
      description: it.description ?? null,
      qty: Number(it.qty || 0),
      unit: it.unit || "pcs",
      unitCost: it.unitCost != null ? Number(it.unitCost) : (it.price != null ? Number(it.price) : 0),
    }));
    const subtotal = itemsNormalized.reduce((sum: number, it: any) => sum + Number(it.qty) * Number(it.unitCost || 0), 0);
    const shippingCost = Number(payload.shippingCost || 0);
    const fee = Number(payload.fee || 0);
    const tax = Number(payload.tax || 0);
    const total = subtotal + shippingCost + fee + tax;

    const created = await prisma.purchaseDirect.create({
      data: {
        purchaseNumber: payload.purchaseNumber,
        date: new Date(payload.date || new Date()),
        supplierName: payload.supplierName || "Marketplace",
        marketplaceOrderId: payload.marketplaceOrderId || null,
        notes: payload.notes || null,
        attachments,
        proofUrl: attachments?.[0]?.url || payload.proofUrl || null,
        subtotal,
        shippingCost,
        fee,
        tax,
        total,
        brandProfileId: activeBrand.id,
        createdByUserId: user.userId,
        items: { create: itemsNormalized },
      },
      include: { items: true },
    });

    try {
      await sendNotificationToRole(
        "Owner",
        "Pembelian baru dibuat",
        `Pembelian ${created.purchaseNumber} berhasil dicatat dengan total ${created.total.toLocaleString()}.`,
        "info",
        activeBrand.id,
        `/pembelian/pembelian-langsung/${created.id}`,
      );
    } catch {}

    return NextResponse.json({ success: true, data: created });
  }
});

