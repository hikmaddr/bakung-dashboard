import { NextResponse, type NextRequest } from "next/server";
export const revalidate = 60;
import { prisma } from "@/lib/prisma";
import { normalizeSalesOrderItems, computeSalesOrderTotals, parseDateInput, createSalesOrder } from "@/services/salesService";
import { salesOrderSchema } from "@/lib/validations";
import { createApiHandler } from "@/lib/api-handler";

export const runtime = "nodejs";

export const GET = createApiHandler({
  handler: async (req, _, { activeBrand }) => {
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

    const [orders, total] = await Promise.all([
      prisma.salesOrder.findMany({
        orderBy: { createdAt: "desc" },
        where,
        include: { customer: true, items: true, quotation: true },
        skip,
        take: limit,
      }),
      prisma.salesOrder.count({ where })
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
  schema: salesOrderSchema,
  actionName: "SALES_ORDER_CREATE",
  entityType: "sales_order",
  handler: async (req, validatedData, { activeBrand }) => {
    const normalizedItems = normalizeSalesOrderItems(validatedData.items);
    if (normalizedItems.some((item) => !item.product)) {
      return NextResponse.json(
        { success: false, message: "Nama produk/jasa tidak boleh kosong" },
        { status: 400 }
      );
    }

    let parsedDate: Date;
    try {
      parsedDate = validatedData.date || parseDateInput(new Date());
    } catch (err: any) {
      return NextResponse.json(
        { success: false, message: err.message ?? "Tanggal tidak valid" },
        { status: 400 }
      );
    }

    const order = await createSalesOrder({
      brandId: activeBrand.id,
      customerId: validatedData.customerId,
      items: normalizedItems,
      extraDiscount: validatedData.extraDiscount,
      taxMode: validatedData.taxMode,
      date: parsedDate,
      quotationId: validatedData.quotationId,
      orderNumber: validatedData.orderNumber || null,
      status: validatedData.status,
      notes: validatedData.notes,
      isNonInventory: validatedData.isNonInventory,
    });

    return NextResponse.json({
      success: true,
      message: "Sales order berhasil dibuat",
      data: order,
    });
  }
});

