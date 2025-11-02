import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveBrandProfile, resolveAllowedBrandIds } from "@/lib/brand";
import { getAuth } from "@/lib/auth";

function generateInvoiceNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `INV-${year}-${random}`;
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

    // Scope check: aktifkan hanya untuk brand Creative
    const activeBrand = await getActiveBrandProfile();
    const brandToCheck = quotation.brandProfileId
      ? await prisma.brandProfile.findUnique({ where: { id: quotation.brandProfileId } })
      : activeBrand;

    if (!brandToCheck || String(brandToCheck.businessScope || "").toUpperCase() !== "CREATIVE") {
      return NextResponse.json(
        { success: false, message: "Fitur hanya aktif untuk brand dengan scope Creative" },
        { status: 403 }
      );
    }

    // Cek apakah sudah ada invoice dari quotation ini
    const existingInvoice = await prisma.invoice.findFirst({
      where: { quotationId: qid },
      include: { items: true },
    });

    const subtotal = quotation.items.reduce(
      (acc, it) => acc + (Number(it.price) || 0) * (Number(it.quantity) || 0),
      0
    );

    if (!existingInvoice) {
      // Confirm quotation terlebih dahulu agar status konsisten dengan flow
      if (quotation.status !== "Confirmed") {
        await prisma.quotation.update({ where: { id: qid }, data: { status: "Confirmed" } });
      }

      const now = new Date();
      const invoice = await prisma.invoice.create({
        data: {
          invoiceNumber: generateInvoiceNumber(),
          issueDate: now,
          dueDate: now, // bisa disesuaikan (mis. +30 hari)
          status: "Draft",
          customerId: quotation.customerId,
          quotationId: quotation.id,
          brandProfileId: quotation.brandProfileId ?? activeBrand?.id,
          subtotal,
          total: subtotal,
          items: {
            create: quotation.items.map((item) => ({
              name: item.product,
              description: item.description || "",
              qty: Number(item.quantity) || 0,
              unit: item.unit || "pcs",
              price: Number(item.price) || 0,
              discount: 0,
              discountType: "percent",
              subtotal: (Number(item.quantity) || 0) * (Number(item.price) || 0),
            })),
          },
        },
        include: { items: true },
      });

      return NextResponse.json({
        success: true,
        message: "Quotation berhasil disalin ke Invoice.",
        data: invoice,
      });
    }

    // Jika sudah ada, sinkronkan isi jika quotation lebih baru
    // Pastikan status quotation menjadi Confirmed meskipun invoice sudah ada
    try {
      if (quotation.status !== "Confirmed") {
        await prisma.quotation.update({ where: { id: qid }, data: { status: "Confirmed" } });
      }
    } catch {}

    if (new Date(quotation.updatedAt) <= new Date(existingInvoice.updatedAt)) {
      return NextResponse.json(
        { success: false, message: "Quotation belum berubah. Tidak disalin ulang." },
        { status: 409 }
      );
    }

    const [_, updated] = await prisma.$transaction([
      prisma.invoiceItem.deleteMany({ where: { invoiceId: existingInvoice.id } }),
      prisma.invoice.update({
        where: { id: existingInvoice.id },
        data: {
          customerId: quotation.customerId,
          brandProfileId: existingInvoice.brandProfileId ?? quotation.brandProfileId ?? activeBrand?.id ?? undefined,
          subtotal,
          total: subtotal,
          items: {
            create: quotation.items.map((item) => ({
              name: item.product,
              description: item.description || "",
              qty: Number(item.quantity) || 0,
              unit: item.unit || "pcs",
              price: Number(item.price) || 0,
              discount: 0,
              discountType: "percent",
              subtotal: (Number(item.quantity) || 0) * (Number(item.price) || 0),
            })),
          },
        },
        include: { items: true },
      }),
    ]);

    // Tegaskan status quotation menjadi Confirmed setelah sinkronisasi
    try {
      if (quotation.status !== "Confirmed") {
        await prisma.quotation.update({ where: { id: qid }, data: { status: "Confirmed" } });
      }
    } catch {}

    return NextResponse.json({
      success: true,
      message: "Perubahan quotation tersinkron ke Invoice yang sudah ada.",
      data: updated,
    });
  } catch (error) {
    console.error("convert-to-invoice error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal salin ke Invoice" },
      { status: 500 }
    );
  }
}
