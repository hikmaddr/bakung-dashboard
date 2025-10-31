import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuth } from "@/lib/auth";
import { getActiveBrandProfile, resolveAllowedBrandIds } from "@/lib/brand";
import { logActivity } from "@/lib/activity";

async function saveAttachments(formData: FormData) {
  const files: File[] = [];
  const attachments: { url: string; name: string; type: string }[] = [];
  for (const [key, value] of formData.entries()) {
    if (key === "attachments" && value instanceof File) files.push(value);
  }
  for (const f of files) {
    const arrayBuffer = await f.arrayBuffer();
    const bytes = Buffer.from(arrayBuffer);
    const ext = f.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const fs = await import("fs");
    const path = await import("path");
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    const fullPath = path.join(uploadDir, fileName);
    fs.writeFileSync(fullPath, bytes);
    attachments.push({ url: `/uploads/${fileName}`, name: f.name, type: f.type });
  }
  return attachments;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuth();
    const allowedBrandIds = await resolveAllowedBrandIds(
      auth?.userId ?? null,
      (auth?.roles as string[]) ?? [],
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
    // Scope by brand if provided, otherwise use active brand
    let brandId: number | null = null;
    if (brandIdStr) {
      const parsed = Number(brandIdStr);
      if (!Number.isNaN(parsed)) brandId = parsed;
    }
    if (brandId != null) {
      // If brandId specified, enforce it is within allowed scope
      if (allowedBrandIds.length && !allowedBrandIds.includes(brandId)) {
        return NextResponse.json(
          { success: false, message: "Forbidden: brand scope" },
          { status: 403 }
        );
      }
      where.brandProfileId = brandId;
    } else {
      // No brandId specified: restrict by allowed brands or active brand fallback
      if (allowedBrandIds.length) {
        where.brandProfileId = { in: allowedBrandIds };
      } else {
        const brand = await getActiveBrandProfile();
        if (brand?.id) where.brandProfileId = brand.id;
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
  } catch (e: any) {
    return NextResponse.json(
      { success: false, message: e?.message || "Gagal memuat data pembelian" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuth();
    const brand = await getActiveBrandProfile();

    // Guard brand berdasarkan izin pengguna
    if (!brand?.id) return NextResponse.json({ success: false, message: "Brand aktif tidak ditemukan" }, { status: 400 });
    const allowedBrandIds = await resolveAllowedBrandIds(auth?.userId ?? null, (auth?.roles as string[]) ?? [], []);
    if (!allowedBrandIds.includes(brand.id)) return NextResponse.json({ success: false, message: "Forbidden: brand scope" }, { status: 403 });

    let payload: any = {};
    let attachments: any[] = [];
    if (req.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await req.formData();
      const itemsRaw = form.get("items") as string | null;
      attachments = await saveAttachments(form);
      payload = {
        purchaseNumber: String(form.get("purchaseNumber") || ""),
        date: new Date(String(form.get("date") || new Date().toISOString())),
        supplierName: String(form.get("supplierName") || ""),
        marketplaceOrderId: (form.get("marketplaceOrderId") as string) || undefined,
        notes: (form.get("notes") as string) || undefined,
        shippingCost: Number(form.get("shippingCost") || 0),
        fee: Number(form.get("fee") || 0),
        tax: Number(form.get("tax") || 0),
        items: itemsRaw ? JSON.parse(itemsRaw) : [],
      };
    } else {
      payload = await req.json();
      attachments = payload.attachments || [];
    }

    if (!payload.purchaseNumber) {
      return NextResponse.json({ success: false, message: "purchaseNumber wajib" }, { status: 400 });
    }
    // normalize items and compute totals
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
        brandProfileId: brand.id,
        createdByUserId: auth?.userId || null,
        items: { create: itemsNormalized },
      },
      include: { items: true },
    });
    // Catat aktivitas pembuatan purchase direct
    try {
      await logActivity(req, {
        userId: auth?.userId || null,
        action: "PURCHASE_CREATE",
        entity: "purchase_direct",
        entityId: created.id,
        metadata: {
          brandProfileId: brand.id,
          purchaseNumber: created.purchaseNumber,
          total: created.total,
          supplierName: created.supplierName,
          date: created.date,
        },
      });
    } catch {}
    return NextResponse.json({ success: true, data: created });
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || "Gagal membuat pembelian" }, { status: 500 });
  }
}
