import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveBrandProfile, resolveAllowedBrandIds } from "@/lib/brand";
import { getAuth } from "@/lib/auth";

function generateOrderNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `SO-${year}-${random}`;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuth();
    const allowedBrandIds = await resolveAllowedBrandIds(
      auth?.userId ?? null,
      (auth?.roles as string[]) ?? [],
      []
    );
    const { id } = await params;
    const qid = Number(id);

    const quotation = await prisma.quotation.findFirst({
      where: {
        id: qid,
        brandProfileId: allowedBrandIds.length ? { in: allowedBrandIds } : undefined,
      },
      include: { items: true },
    });

    if (!quotation) {
      return NextResponse.json(
        { success: false, message: "Quotation tidak ditemukan" },
        { status: 404 }
      );
    }

    // Lihat apakah sudah ada Sales Order untuk quotation ini
    const existingOrder = await prisma.salesOrder.findFirst({
      where: { quotationId: qid },
      include: { items: true },
    });

    const totalAmount = quotation.items.reduce(
      (acc, it) => acc + it.price * it.quantity,
      0
    );

    if (!existingOrder) {
      // Belum ada: buat baru, dan confirm quotation
      if (quotation.status !== "Confirmed") {
        await prisma.quotation.update({ where: { id: qid }, data: { status: "Confirmed" } });
      }

      const order = await prisma.salesOrder.create({
        data: {
          orderNumber: generateOrderNumber(),
          date: new Date(),
          status: "Confirmed",
          customerId: quotation.customerId,
          quotationId: quotation.id,
          brandProfileId: quotation.brandProfileId ?? (await getActiveBrandProfile())?.id,
          totalAmount,
          items: {
            create: quotation.items.map((item) => ({
              product: item.product,
              description: item.description,
              quantity: item.quantity,
              unit: item.unit,
              price: item.price,
              imageUrl: item.imageUrl,
              subtotal: item.price * item.quantity,
            })),
          },
        },
        include: { items: true, customer: true },
      });

      return NextResponse.json({
        success: true,
        message: "Quotation berhasil disalin ke Sales Order.",
        data: order,
      });
    }

    // Sudah ada: hanya update bila quotation berubah (bandingkan updatedAt)
    if (new Date(quotation.updatedAt) <= new Date(existingOrder.updatedAt)) {
      return NextResponse.json(
        { success: false, message: "Quotation sudah dikonfirmasi dan belum ada perubahan. Tidak disalin ulang." },
        { status: 409 }
      );
    }

    const [_, updated] = await prisma.$transaction([
      prisma.salesOrderItem.deleteMany({ where: { salesOrderId: existingOrder.id } }),
      prisma.salesOrder.update({
        where: { id: existingOrder.id },
        data: {
          // pertahankan nomor & tanggal; sinkronkan data dari quotation
          customerId: quotation.customerId,
          brandProfileId: existingOrder.brandProfileId ?? quotation.brandProfileId ?? (await getActiveBrandProfile())?.id,
          totalAmount,
          items: {
            create: quotation.items.map((item) => ({
              product: item.product,
              description: item.description,
              quantity: item.quantity,
              unit: item.unit,
              price: item.price,
              imageUrl: item.imageUrl,
              subtotal: item.price * item.quantity,
            })),
          },
        },
        include: { items: true, customer: true },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: "Perubahan quotation tersinkron ke Sales Order yang sudah ada.",
      data: updated,
    });
  } catch (error) {
    console.error("convert-to-so error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal salin ke Sales Order" },
      { status: 500 }
    );
  }
}
