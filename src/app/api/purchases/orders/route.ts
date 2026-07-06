import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createApiHandler } from "@/lib/api-handler";
import { purchaseOrderSchema } from "@/lib/validations";
import { normalizePurchaseOrderItems, createPurchaseOrder, parseDateInput } from "@/services/purchaseService";
import { resolveAllowedBrandIds } from "@/lib/brand";

export const runtime = "nodejs";

export const GET = createApiHandler({
  handler: async (req, _, { activeBrand, user }) => {
    const allowedBrandIds = await resolveAllowedBrandIds(
      user.userId,
      user.roles || [],
      []
    );
    const sp = req.nextUrl.searchParams;
    const statusRaw = sp.get("status") || "";
    const q = sp.get("q")?.trim();
    
    const page = Number(sp.get("page")) || 1;
    const limit = Number(sp.get("limit")) || 50;
    const skip = (page - 1) * limit;

    const statuses = statusRaw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => !!s);

    const where: any = {};
    
    // Brand filtering
    if (allowedBrandIds.length) {
      where.brandProfileId = { in: allowedBrandIds };
    } else {
      where.brandProfileId = activeBrand.id;
    }

    if (statuses.length > 0) where.status = { in: statuses };
    if (q) {
      where.OR = [
        { orderNumber: { contains: q, mode: "insensitive" } },
        { supplierName: { contains: q, mode: "insensitive" } },
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        orderBy: { createdAt: "desc" },
        where,
        include: { items: true, brand: true },
        skip,
        take: limit,
      }),
      prisma.purchaseOrder.count({ where })
    ]);

    return NextResponse.json({ 
      success: true, 
      data: orders,
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
  schema: purchaseOrderSchema,
  actionName: "PURCHASE_ORDER_CREATE",
  entityType: "purchase_order",
  handler: async (req, validatedData, { activeBrand, user }) => {
    const normalizedItems = normalizePurchaseOrderItems(validatedData.items);
    
    let parsedDate: Date;
    try {
      parsedDate = validatedData.date || new Date();
    } catch (err: any) {
      return NextResponse.json(
        { success: false, message: "Tanggal tidak valid" },
        { status: 400 }
      );
    }

    const order = await createPurchaseOrder({
      brandId: activeBrand.id,
      supplierName: validatedData.supplierName,
      items: normalizedItems,
      extraDiscount: validatedData.extraDiscount,
      taxMode: validatedData.taxMode,
      date: parsedDate,
      orderNumber: validatedData.orderNumber || null,
      status: validatedData.status,
      notes: validatedData.notes,
      createdByUserId: String(user.userId),
    });

    return NextResponse.json({
      success: true,
      message: "Purchase order berhasil dibuat",
      data: order,
    });
  }
});
