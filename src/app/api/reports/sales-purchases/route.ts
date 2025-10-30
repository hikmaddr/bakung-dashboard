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

    const whereSales: any = {};
    const wherePurchase: any = {};
    whereSales.brandProfileId = { in: allowedBrandIds };
    wherePurchase.brandProfileId = { in: allowedBrandIds };

    if (dateFrom || dateTo) {
      if (dateFrom || dateTo) whereSales.date = {};
      if (dateFrom) whereSales.date.gte = dateFrom;
      if (dateTo) whereSales.date.lte = dateTo;

      if (dateFrom || dateTo) wherePurchase.date = {};
      if (dateFrom) wherePurchase.date.gte = dateFrom;
      if (dateTo) wherePurchase.date.lte = dateTo;
    }

    // Aggregate per brand for sales and purchases
    const salesAgg = await prisma.salesOrder.groupBy({
      by: ["brandProfileId"],
      where: whereSales,
      _sum: { totalAmount: true },
      _count: { _all: true },
    });
    const purchaseAgg = await prisma.purchaseDirect.groupBy({
      by: ["brandProfileId"],
      where: wherePurchase,
      _sum: { total: true },
      _count: { _all: true },
    });

    // Merge per brand
    const brandSet = new Set<number>();
    salesAgg.forEach((r) => { if (r.brandProfileId != null) brandSet.add(r.brandProfileId!); });
    purchaseAgg.forEach((r) => { if (r.brandProfileId != null) brandSet.add(r.brandProfileId!); });

    const rows = Array.from(brandSet).map((bid) => {
      const s = salesAgg.find((r) => r.brandProfileId === bid);
      const p = purchaseAgg.find((r) => r.brandProfileId === bid);
      return {
        brandProfileId: bid,
        sales: {
          totalAmount: Number(s?._sum.totalAmount || 0),
          count: Number(s?._count._all || 0),
        },
        purchases: {
          totalAmount: Number(p?._sum.total || 0),
          count: Number(p?._count._all || 0),
        },
      };
    });

    return NextResponse.json({ success: true, data: rows });
  } catch (e: any) {
    console.error("[reports/sales-purchases]", e);
    return NextResponse.json({ success: false, message: e?.message || "Gagal memuat laporan penjualan/pembelian" }, { status: 500 });
  }
}

