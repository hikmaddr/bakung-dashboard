import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveAllowedBrandIds } from "@/lib/brand";
import { logActivity } from "@/lib/activity";
import { createApiHandler } from "@/lib/api-handler";

type CreatePaymentBody = {
  type: "IN" | "OUT";
  method: "CASH" | "BCA" | "BRI" | "OTHER";
  amount: number;
  paidAt?: string | Date;
  refType: "SALES_ORDER" | "INVOICE" | "PURCHASE" | "EXPENSE";
  refId: number;
  notes?: string;
  isDP?: boolean;
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
      where: { brandProfileId: brandId, refType: "SALES_ORDER", refId, type: "IN", isDeleted: false },
    });
    const paid = Number(paidAgg._sum.amount) || 0;
    const total = Number(so.totalAmount) || 0;
    
    let status: any = "UNPAID";
    if (paid + 0.0001 >= total) {
      status = "PAID";
    } else if (paid > 0) {
      const hasDP = await prisma.payment.findFirst({
        where: { brandProfileId: brandId, refType: "SALES_ORDER", refId, type: "IN", isDP: true, isDeleted: false }
      });
      status = hasDP ? "DP" : "PARTIAL";
    }

    await prisma.salesOrder.update({ where: { id: refId }, data: { paidAmount: paid, paymentStatus: status } });
    return;
  }
  if (refType === "INVOICE") {
    const inv = await prisma.invoice.findUnique({ where: { id: refId } });
    if (!inv) return;
    const paidAgg = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: { brandProfileId: brandId, refType: "INVOICE", refId, type: "IN", isDeleted: false },
    });
    const paid = Number(paidAgg._sum.amount) || 0;
    const total = Number(inv.total) || 0;
    
    let status: any = "UNPAID";
    if (paid + 0.0001 >= total) {
      status = "PAID";
    } else if (paid > 0) {
      const hasDP = await prisma.payment.findFirst({
        where: { brandProfileId: brandId, refType: "INVOICE", refId, type: "IN", isDP: true, isDeleted: false }
      });
      status = hasDP ? "DP" : "PARTIAL";
    }

    await prisma.invoice.update({ where: { id: refId }, data: { paidAmount: paid, paymentStatus: status } });
    return;
  }
  if (refType === "PURCHASE") {
    const pd = await prisma.purchaseDirect.findUnique({ where: { id: refId } });
    if (!pd) return;
    const paidAgg = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: { brandProfileId: brandId, refType: "PURCHASE", refId, type: "OUT", isDeleted: false },
    });
    const paid = Number(paidAgg._sum.amount) || 0;
    const total = Number(pd.total) || 0;
    
    let status: any = "UNPAID";
    if (paid + 0.0001 >= total) {
      status = "PAID";
    } else if (paid > 0) {
      const hasDP = await prisma.payment.findFirst({
        where: { brandProfileId: brandId, refType: "PURCHASE", refId, type: "OUT", isDP: true, isDeleted: false }
      });
      status = hasDP ? "DP" : "PARTIAL";
    }

    await prisma.purchaseDirect.update({ where: { id: refId }, data: { paidAmount: paid, paymentStatus: status } });
    return;
  }
}

export const GET = createApiHandler({
  handler: async (req, _, { activeBrand, user }) => {
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

    const allowedBrandIds = await resolveAllowedBrandIds(
      user.userId,
      user.roles || [],
      []
    );

    let brandId: number | null = null;
    if (brandIdStr) {
      const parsed = Number(brandIdStr);
      if (Number.isFinite(parsed) && parsed > 0) brandId = parsed;
    }

    const where: any = { isDeleted: false };
    if (brandId != null) {
      if (allowedBrandIds.length && !allowedBrandIds.includes(brandId)) {
        return NextResponse.json({ success: false, message: "Forbidden: brand scope" }, { status: 403 });
      }
      where.brandProfileId = brandId;
    } else {
      where.brandProfileId = activeBrand.id;
    }

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
  }
});

export const POST = createApiHandler({
  actionName: "PAYMENT_CREATE",
  entityType: "payment",
  handler: async (req, body: CreatePaymentBody, { activeBrand, user }) => {
    const brandId = activeBrand.id;
    const paidAt = body.paidAt ? new Date(body.paidAt) : new Date();
    const amount = Number(body.amount) || 0;
    if (!(amount > 0)) return NextResponse.json({ success: false, message: "Jumlah pembayaran harus > 0" }, { status: 400 });

    // Validasi referensi
    if (body.refType === "SALES_ORDER") {
      const so = await prisma.salesOrder.findFirst({ where: { id: body.refId, brandProfileId: brandId, isDeleted: false } });
      if (!so) return NextResponse.json({ success: false, message: "Referensi Sales Order tidak ditemukan" }, { status: 400 });
    } else if (body.refType === "INVOICE") {
      const inv = await prisma.invoice.findFirst({ where: { id: body.refId, brandProfileId: brandId, isDeleted: false } });
      if (!inv) return NextResponse.json({ success: false, message: "Referensi Invoice tidak ditemukan" }, { status: 400 });
    } else if (body.refType === "PURCHASE") {
      const pd = await prisma.purchaseDirect.findFirst({ where: { id: body.refId, brandProfileId: brandId, isDeleted: false } });
      if (!pd) return NextResponse.json({ success: false, message: "Referensi Purchase tidak ditemukan" }, { status: 400 });
    } else if (body.refType === "EXPENSE") {
      const ex = await prisma.expense.findFirst({ where: { id: body.refId, brandProfileId: brandId, isDeleted: false } });
      if (!ex) return NextResponse.json({ success: false, message: "Referensi Expense tidak ditemukan" }, { status: 400 });
    }

    // Overpayment validation
    const EPS = 0.0001;
    if (body.type === "IN" && body.refType === "INVOICE") {
      const inv = await prisma.invoice.findFirst({ where: { id: body.refId, brandProfileId: brandId }, select: { paidAmount: true, total: true, invoiceNumber: true } });
      if (inv && amount > (Number(inv.total) - Number(inv.paidAmount)) + EPS) {
        return NextResponse.json({ success: false, message: `Pembayaran melebihi sisa tagihan invoice ${inv.invoiceNumber}. Sisa: ${Math.max(0, inv.total - inv.paidAmount).toFixed(2)}` }, { status: 400 });
      }
    }
    if (body.type === "IN" && body.refType === "SALES_ORDER") {
      const so = await prisma.salesOrder.findFirst({ where: { id: body.refId, brandProfileId: brandId }, select: { paidAmount: true, totalAmount: true, orderNumber: true } });
      if (so && amount > (Number(so.totalAmount) - Number(so.paidAmount)) + EPS) {
        return NextResponse.json({ success: false, message: `Pembayaran melebihi sisa tagihan SO ${so.orderNumber}. Sisa: ${Math.max(0, so.totalAmount - so.paidAmount).toFixed(2)}` }, { status: 400 });
      }
    }
    if (body.type === "OUT" && body.refType === "PURCHASE") {
      const pd = await prisma.purchaseDirect.findFirst({ where: { id: body.refId, brandProfileId: brandId }, select: { paidAmount: true, total: true, purchaseNumber: true } });
      if (pd && amount > (Number(pd.total) - Number(pd.paidAmount)) + EPS) {
        return NextResponse.json({ success: false, message: `Pembayaran melebihi sisa tagihan pembelian ${pd.purchaseNumber}. Sisa: ${Math.max(0, pd.total - pd.paidAmount).toFixed(2)}` }, { status: 400 });
      }
    }

    // Snapshot before status transition logs
    let prevInvoiceStatus: string | null = null;
    if (body.refType === "INVOICE") {
      const prev = await prisma.invoice.findUnique({ where: { id: body.refId }, select: { paymentStatus: true } });
      prevInvoiceStatus = prev?.paymentStatus ?? null;
    }

    const created = await prisma.$transaction(async (db) => {
      const payment = await db.payment.create({
        data: {
          brandProfileId: brandId,
          type: body.type as any,
          method: (body.method || "CASH") as any,
          amount,
          paidAt,
          refType: body.refType as any,
          refId: body.refId,
          notes: body.notes || null,
          isDP: body.isDP || false,
          createdById: user.userId,
        },
      });

      const number = await generateReceiptNumber(brandId);
      const receipt = await db.receipt.create({ data: { brandProfileId: brandId, paymentId: payment.id, receiptNumber: number } });

      if (body.refType === "EXPENSE") {
        await db.expense.update({ where: { id: body.refId }, data: { paymentId: payment.id } });
      }

      if (body.refType !== "EXPENSE") {
        await recalcPaymentStatusForRef(brandId, body.refType, body.refId);
      }

      return { payment, receipt };
    });

    // Post-transaction logs for status transition
    if (body.refType === "INVOICE") {
      const nowInv = await prisma.invoice.findUnique({ where: { id: body.refId }, select: { paymentStatus: true, invoiceNumber: true, paidAmount: true, total: true } });
      const nowStatus = nowInv?.paymentStatus;
      if (nowStatus === "PAID" && prevInvoiceStatus !== "PAID") {
        await logActivity(req, {
          userId: user.userId,
          action: "INVOICE_PAID",
          entity: "invoice",
          entityId: body.refId,
          metadata: { brandProfileId: brandId, invoiceNumber: nowInv?.invoiceNumber, amount, method: body.method, receiptNumber: created.receipt.receiptNumber }
        });
      } else if (nowStatus === "PARTIAL" && prevInvoiceStatus !== "PARTIAL") {
        await logActivity(req, {
          userId: user.userId,
          action: "INVOICE_PARTIAL",
          entity: "invoice",
          entityId: body.refId,
          metadata: { brandProfileId: brandId, invoiceNumber: nowInv?.invoiceNumber, amount, method: body.method, receiptNumber: created.receipt.receiptNumber }
        });
      }
    }

    return NextResponse.json({ success: true, data: created });
  }
});

