import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createApiHandler } from "@/lib/api-handler";
import { purchaseOrderSchema } from "@/lib/validations";
import { normalizePurchaseOrderItems, computePurchaseOrderTotals } from "@/services/purchaseService";

export const runtime = "nodejs";

export const GET = createApiHandler({
  handler: async (req, _, { params }) => {
    const { id } = params as { id: string };
    const order = await prisma.purchaseOrder.findUnique({
      where: { id: parseInt(id) },
      include: { items: true, brand: true, purchaseInvoices: true },
    });

    if (!order) {
      return NextResponse.json({ success: false, message: "Order tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: order });
  }
});

export const PATCH = createApiHandler({
  schema: purchaseOrderSchema.partial(),
  actionName: "PURCHASE_ORDER_UPDATE",
  entityType: "purchase_order",
  handler: async (req, validatedData, { params }) => {
    const { id } = params as { id: string };
    const orderId = parseInt(id);

    const existing = await prisma.purchaseOrder.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!existing) {
      return NextResponse.json({ success: false, message: "Order tidak ditemukan" }, { status: 404 });
    }

    const data: any = { ...validatedData };
    if (validatedData.items) {
      const normalizedItems = normalizePurchaseOrderItems(validatedData.items);
      const totals = computePurchaseOrderTotals(
        normalizedItems,
        validatedData.extraDiscount ?? existing.extraDiscount,
        validatedData.taxMode ?? existing.taxMode
      );
      
      data.subtotal = totals.subtotal;
      data.lineDiscount = totals.lineDiscount;
      data.extraDiscount = totals.extraDiscount;
      data.taxMode = totals.taxMode;
      data.taxAmount = totals.taxAmount;
      data.totalAmount = totals.totalAmount;

      // Update items via transaction
      return await prisma.$transaction(async (tx) => {
        await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: orderId } });
        const updated = await tx.purchaseOrder.update({
          where: { id: orderId },
          data: {
            ...data,
            items: {
              create: normalizedItems.map((item) => ({
                product: item.product,
                description: item.description,
                quantity: item.quantity,
                unit: item.unit,
                price: item.price,
                discount: item.discount,
                imageUrl: item.imageUrl,
                subtotal: item.subtotal,
                productId: item.productId,
              })),
            },
          },
          include: { items: true },
        });
        return NextResponse.json({ success: true, data: updated });
      });
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id: orderId },
      data,
      include: { items: true },
    });

    return NextResponse.json({ success: true, data: updated });
  }
});

export const DELETE = createApiHandler({
  actionName: "PURCHASE_ORDER_DELETE",
  entityType: "purchase_order",
  handler: async (req, _, { params }) => {
    const { id } = params as { id: string };
    await prisma.purchaseOrder.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ success: true, message: "Order berhasil dihapus" });
  }
});
