import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveBrandProfile } from "@/lib/brand";
import { getAuth } from "@/lib/auth";

type CreatePaymentBody = {
  type: "IN" | "OUT";
  method: "CASH" | "BCA" | "BRI" | "OTHER";
  amount: number;
  paidAt?: string | Date;
  refType: "SALES_ORDER" | "INVOICE" | "PURCHASE" | "EXPENSE";
  refId: number;
  notes?: string;
  brandProfileId?: number; // optional override
};

function monthRange(d: Date) {
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return { start, end };
}

async function generateReceiptNumber(brandId: number) {
  const now = new Date();
  const { start, end } = monthRange(now);
  const count = await prisma.receipt.count({
    where: { brandProfileId: brandId, createdAt: { gte: start, lt: end } },
  });
  const y = String(now.getFullYear());
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const seq = String(count + 1).padStart(4, "0");
  return `RC-${y}${m}-${seq}`;
}

async function recalcPaymentStatusForRef(brandId: number, refType: "SALES_ORDER"|"INVOICE"|"PURCHASE", refId: number) {
  if (refType === "SALES_ORDER") {
    const so = await prisma.salesOrder.findUnique({ where: { id: refId } });
    if (!so) return;
    const paidAgg = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: { brandProfileId: brandId, refType: "SALES_ORDER", refId, type: "IN" },
    });
    const paid = Number(paidAgg._sum.amount) || 0;
    const total = Number(so.totalAmount) || 0;
    const status = paid <= 0 ? "UNPAID" : paid + 0.0001 >= total ? "PAID" : "PARTIAL";
    await prisma.salesOrder.update({ where: { id: refId }, data: { paidAmount: paid, paymentStatus: status } });
    return;
  }
  if (refType === "INVOICE") {
    const inv = await prisma.invoice.findUnique({ where: { id: refId } });
    if (!inv) return;
    const paidAgg = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: { brandProfileId: brandId, refType: "INVOICE", refId, type: "IN" },
    });
    const paid = Number(paidAgg._sum.amount) || 0;
    const total = Number(inv.total) || 0;
    const status = paid <= 0 ? "UNPAID" : paid + 0.0001 >= total ? "PAID" : "PARTIAL";
    await prisma.invoice.update({ where: { id: refId }, data: { paidAmount: paid, paymentStatus: status } });
    return;
  }
  if (refType === "PURCHASE") {
    const pd = await prisma.purchaseDirect.findUnique({ where: { id: refId } });
    if (!pd) return;
    const paidAgg = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: { brandProfileId: brandId, refType: "PURCHASE", refId, type: "OUT" },
    });
    const paid = Number(paidAgg._sum.amount) || 0;
    const total = Number(pd.total) || 0;
    const status = paid <= 0 ? "UNPAID" : paid + 0.0001 >= total ? "PAID" : "PARTIAL";
    await prisma.purchaseDirect.update({ where: { id: refId }, data: { paidAmount: paid, paymentStatus: status } });
    return;
  }
}

export async function GET(req: NextRequest) {
  try {
    const search = req.nextUrl.searchParams;
    const page = Math.max(1, parseInt(search.get("page") || "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(search.get("pageSize") || "20")));
    const type = (search.get("type") || "").toUpperCase();
    const method = (search.get("method") || "").toUpperCase();
    const refType = (search.get("refType") || "").toUpperCase();
    const refIdStr = search.get("refId");
    const dateFrom = search.get("dateFrom");
    const dateTo = search.get("dateTo");
    const brandIdStr = search.get("brandId");

    let brandId: number | null = null;
    if (brandIdStr) {
      const parsed = Number(brandIdStr);
      if (Number.isFinite(parsed) && parsed > 0) brandId = parsed;
    }
    if (!brandId) {
      const brand = await getActiveBrandProfile();
      if (brand?.id) brandId = brand.id;
    }

    const where: any = {};
    if (brandId) where.brandProfileId = brandId;
    if (type === "IN" || type === "OUT") where.type = type;
    if (["CASH","BCA","BRI","OTHER"].includes(method)) where.method = method;
    if (["SALES_ORDER","INVOICE","PURCHASE","EXPENSE"].includes(refType)) where.refType = refType;
    if (refIdStr) {
      const rid = Number(refIdStr);
      if (Number.isFinite(rid)) where.refId = rid;
    }
    if (dateFrom || dateTo) {
      where.paidAt = {} as any;
      if (dateFrom) (where.paidAt as any).gte = new Date(dateFrom!);
      if (dateTo) (where.paidAt as any).lte = new Date(dateTo!);
    }

    const [total, rows, inAgg, outAgg] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({ where, orderBy: { paidAt: "desc" }, skip: (page-1)*pageSize, take: pageSize, include: { receipt: true } }),
      prisma.payment.aggregate({ _sum: { amount: true }, where: { ...where, type: "IN" as any } }),
      prisma.payment.aggregate({ _sum: { amount: true }, where: { ...where, type: "OUT" as any } }),
    ]);

    const byMethod = await prisma.payment.groupBy({ by: ["method", "type"], where, _sum: { amount: true } }).catch(() => [] as any[]);

    return NextResponse.json({ success: true, data: rows, total, page, pageSize, sumIn: inAgg._sum.amount || 0, sumOut: outAgg._sum.amount || 0, byMethod });
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || "Gagal memuat payments" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CreatePaymentBody;
    const auth = await getAuth();
    let brandId = body.brandProfileId || null;
    if (!brandId) {
      const brand = await getActiveBrandProfile();
      if (!brand?.id) return NextResponse.json({ success: false, message: "Brand aktif tidak ditemukan" }, { status: 400 });
      brandId = brand.id;
    }

    const paidAt = body.paidAt ? new Date(body.paidAt) : new Date();
    const amount = Number(body.amount) || 0;
    if (!(amount > 0)) return NextResponse.json({ success: false, message: "Jumlah pembayaran harus > 0" }, { status: 400 });

    const created = await prisma.$transaction(async (db) => {
      const payment = await db.payment.create({
        data: {
          brandProfileId: brandId!,
          type: body.type as any,
          method: (body.method || "CASH") as any,
          amount,
          paidAt,
          refType: body.refType as any,
          refId: body.refId,
          notes: body.notes || null,
          createdById: auth?.userId || null,
        },
      });

      const number = await generateReceiptNumber(brandId!);
      const receipt = await db.receipt.create({ data: { brandProfileId: brandId!, paymentId: payment.id, receiptNumber: number } });

      // Link to Expense if refType EXPENSE
      if (body.refType === "EXPENSE") {
        try { await db.expense.update({ where: { id: body.refId }, data: { paymentId: payment.id } }); } catch {}
      }

      // Recalc payment status for related refs (SO/INVOICE/PURCHASE)
      if (body.refType !== "EXPENSE") {
        await recalcPaymentStatusForRef(brandId!, body.refType, body.refId);
      }

      return { payment, receipt };
    });

    return NextResponse.json({ success: true, data: created });
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || "Gagal membuat pembayaran" }, { status: 500 });
  }
}

