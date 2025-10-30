import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuth } from "@/lib/auth";
import { resolveAllowedBrandIds } from "@/lib/brand";

function parseCsvNumbers(v: string | null): number[] {
  if (!v) return [];
  return v
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuth();
    const url = new URL(req.url);
    const dateFromStr = url.searchParams.get("dateFrom");
    const dateToStr = url.searchParams.get("dateTo");
    const brandIdsCsv = url.searchParams.get("brandIds");

    const dateFrom = dateFromStr ? new Date(dateFromStr) : undefined;
    const dateTo = dateToStr ? new Date(dateToStr) : undefined;
    const requestedBrandIds = parseCsvNumbers(brandIdsCsv);
    const allowedBrandIds = await resolveAllowedBrandIds(auth?.userId ?? null, auth?.roles ?? [], requestedBrandIds);

    if (allowedBrandIds.length === 0) {
      return NextResponse.json({ success: true, data: [], message: "Tidak ada brand yang diizinkan" });
    }

    // Filters
    const whereInvoice: any = { brandProfileId: { in: allowedBrandIds } };
    const wherePurchase: any = { brandProfileId: { in: allowedBrandIds } };
    const wherePayInInv: any = { brandProfileId: { in: allowedBrandIds }, refType: "INVOICE", type: "IN" };
    const wherePayInSO: any = { brandProfileId: { in: allowedBrandIds }, refType: "SALES_ORDER", type: "IN" };
    const wherePayOutPurchase: any = { brandProfileId: { in: allowedBrandIds }, refType: "PURCHASE", type: "OUT" };

    if (dateFrom || dateTo) {
      if (dateFrom || dateTo) whereInvoice.issueDate = {};
      if (dateFrom) whereInvoice.issueDate.gte = dateFrom;
      if (dateTo) whereInvoice.issueDate.lte = dateTo;

      if (dateFrom || dateTo) wherePurchase.date = {};
      if (dateFrom) wherePurchase.date.gte = dateFrom;
      if (dateTo) wherePurchase.date.lte = dateTo;

      if (dateFrom || dateTo) wherePayInInv.paidAt = {};
      if (dateFrom) wherePayInInv.paidAt.gte = dateFrom;
      if (dateTo) wherePayInInv.paidAt.lte = dateTo;

      if (dateFrom || dateTo) wherePayInSO.paidAt = {};
      if (dateFrom) wherePayInSO.paidAt.gte = dateFrom;
      if (dateTo) wherePayInSO.paidAt.lte = dateTo;

      if (dateFrom || dateTo) wherePayOutPurchase.paidAt = {};
      if (dateFrom) wherePayOutPurchase.paidAt.gte = dateFrom;
      if (dateTo) wherePayOutPurchase.paidAt.lte = dateTo;
    }

    // AR: Invoice totals and Payments IN
    const invAgg = await prisma.invoice.groupBy({
      by: ["brandProfileId"],
      where: whereInvoice,
      _sum: { total: true },
      _count: { _all: true },
    });
    const payInvAgg = await prisma.payment.groupBy({
      by: ["brandProfileId"],
      where: wherePayInInv,
      _sum: { amount: true },
    });
    // Optionally include Sales Order AR
    const paySOAgg = await prisma.payment.groupBy({
      by: ["brandProfileId"],
      where: wherePayInSO,
      _sum: { amount: true },
    });

    // AP: Purchase totals and Payments OUT
    const purchaseAgg = await prisma.purchaseDirect.groupBy({
      by: ["brandProfileId"],
      where: wherePurchase,
      _sum: { total: true },
      _count: { _all: true },
    });
    const payOutAgg = await prisma.payment.groupBy({
      by: ["brandProfileId"],
      where: wherePayOutPurchase,
      _sum: { amount: true },
    });

    const byBrand = new Set<number>(allowedBrandIds);
    const rows = Array.from(byBrand).map((bid) => {
      const inv = invAgg.find((r) => r.brandProfileId === bid);
      const pinv = payInvAgg.find((r) => r.brandProfileId === bid);
      const pso = paySOAgg.find((r) => r.brandProfileId === bid);
      const pur = purchaseAgg.find((r) => r.brandProfileId === bid);
      const pout = payOutAgg.find((r) => r.brandProfileId === bid);

      const invoiceTotal = Number(inv?._sum.total || 0);
      const paymentsInInvoice = Number(pinv?._sum.amount || 0);
      const paymentsInSalesOrder = Number(pso?._sum.amount || 0);
      const arOutstanding = Math.max(0, invoiceTotal - paymentsInInvoice);

      const purchaseTotal = Number(pur?._sum.total || 0);
      const paymentsOutPurchase = Number(pout?._sum.amount || 0);
      const apOutstanding = Math.max(0, purchaseTotal - paymentsOutPurchase);

      return {
        brandProfileId: bid,
        ar: {
          invoiceTotal,
          paymentsInInvoice,
          paymentsInSalesOrder,
          outstanding: arOutstanding,
          invoiceCount: Number(inv?._count._all || 0),
        },
        ap: {
          purchaseTotal,
          paymentsOutPurchase,
          outstanding: apOutstanding,
          purchaseCount: Number(pur?._count._all || 0),
        },
      };
    });

    return NextResponse.json({ success: true, data: rows });
  } catch (e: any) {
    console.error("[reports/ar-ap]", e);
    return NextResponse.json({ success: false, message: e?.message || "Gagal memuat laporan AR/AP" }, { status: 500 });
  }
}

