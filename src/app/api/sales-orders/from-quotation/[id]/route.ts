import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

function generateOrderNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `SO-${year}-${random}`;
}

// ✅ POST — convert quotation ke sales order
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const quotationId = Number(id);

    const quotation = await prisma.quotation.findUnique({
      where: { id: quotationId },
      include: { items: true },
    });

    if (!quotation) {
      return NextResponse.json(
        { success: false, message: "Quotation tidak ditemukan" },
        { status: 404 }
      );
    }

    if (quotation.status !== "Confirmed") {
      return NextResponse.json(
        { success: false, message: "Quotation belum berstatus Confirmed" },
        { status: 400 }
      );
    }

    const normalizedItems = quotation.items.map((item) => {
      const quantity = Number(item.quantity) || 0;
      const price = Number(item.price) || 0;
      const subtotal = quantity * price;
      return {
        product: item.product,
        description: item.description,
        quantity,
        unit: item.unit || "pcs",
        price,
        discount: 0,
        imageUrl: item.imageUrl,
        subtotal,
      };
    });

    const subtotal = normalizedItems.reduce((acc, item) => acc + item.subtotal, 0);
    const lineDiscount = 0;
    const extraDiscount = 0;
    const taxMode = "none";
    const taxAmount = 0;
    const totalAmount = subtotal;

    const order = await prisma.salesOrder.create({
      data: {
        orderNumber: generateOrderNumber(),
        date: new Date(),
        status: "Draft",
        customerId: quotation.customerId,
        quotationId: quotation.id,
        subtotal,
        lineDiscount,
        extraDiscount,
        taxMode,
        taxAmount,
        totalAmount,
        items: {
          create: normalizedItems,
        },
      },
      include: { items: true, customer: true },
    });

    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    console.error("POST /sales-orders/from-quotation/:id error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal convert quotation" },
      { status: 500 }
    );
  }
}
