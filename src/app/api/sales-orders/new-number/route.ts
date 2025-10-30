import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function generateOrderNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `SO-${year}-${random}`;
}

export async function GET() {
  try {
    let orderNumber: string | null = null;
    let attempts = 0;

    while (attempts < 8) {
      const candidate = generateOrderNumber();
      const existing = await prisma.salesOrder.findUnique({
        where: { orderNumber: candidate },
        select: { id: true },
      });
      if (!existing) {
        orderNumber = candidate;
        break;
      }
      attempts += 1;
    }

    if (!orderNumber) {
      return NextResponse.json(
        {
          success: false,
          message: "Gagal menghasilkan nomor sales order unik",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { orderNumber },
    });
  } catch (error) {
    console.error("GET /api/sales-orders/new-number error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Gagal menghasilkan nomor sales order",
      },
      { status: 500 }
    );
  }
}
