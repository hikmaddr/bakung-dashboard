import { NextResponse, type NextRequest } from "next/server";
export const revalidate = 60;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { getActiveBrandProfile } from "@/lib/brand";

export async function GET(_req: NextRequest) {
  try {
    const active = await getActiveBrandProfile();
    const brandId = active?.id ?? null;

    const whereReceipt: any = {};
    if (brandId) whereReceipt.brandProfileId = brandId;

    const receipts = await prisma.receipt.findMany({
      where: whereReceipt,
      include: { payment: true },
      orderBy: { createdAt: "desc" },
    });

    const invoiceIds = receipts
      .filter((r) => r.payment && r.payment.type === "IN" && r.payment.refType === "INVOICE")
      .map((r) => r.payment!.refId);
    const uniqueInvoiceIds = Array.from(new Set(invoiceIds));

    const invoices = uniqueInvoiceIds.length
      ? await prisma.invoice.findMany({
          where: {
            id: { in: uniqueInvoiceIds },
            ...(brandId ? { brandProfileId: brandId } : {}),
            isDeleted: false,
          },
          select: {
            id: true,
            invoiceNumber: true,
            total: true,
            status: true,
            paymentStatus: true,
            dueDate: true,
            customer: { select: { pic: true, company: true } },
          },
        })
      : [];

    const invMap = new Map(invoices.map((inv) => [inv.id, inv] as const));

    const rows = receipts
      .filter((r) => r.payment && r.payment.type === "IN" && r.payment.refType === "INVOICE")
      .map((r) => {
        const inv = invMap.get(r.payment!.refId);
        return {
          id: r.payment!.refId, // gunakan invoiceId agar front-end dapat preview/unduh via /api/receipts/[invoiceId]/pdf
          receiptId: r.id,
          receiptNumber: r.receiptNumber || (inv?.invoiceNumber ? `RCPT-${inv.invoiceNumber}` : `RCPT-${r.id}`),
          date: r.payment!.paidAt.toISOString(),
          total: Number(inv?.total ?? r.payment!.amount ?? 0),
          customer: inv?.customer ? { pic: inv.customer.pic || null, company: inv.customer.company || null } : undefined,
          // Extra status fields for StatusBadge
          status: inv?.status || "Draft",
          paymentStatus: inv?.paymentStatus || "UNPAID",
          dueDate: inv?.dueDate ? inv.dueDate.toISOString() : null,
        };
      });

    return NextResponse.json({ success: true, data: rows });
  } catch (e) {
    console.error("GET /api/receipts error:", e);
    return NextResponse.json({ success: false, message: "Gagal mengambil kwitansi" }, { status: 500 });
  }
}
