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
    const productIdStr = url.searchParams.get("productId");

    const dateFrom = dateFromStr ? new Date(dateFromStr) : undefined;
    const dateTo = dateToStr ? new Date(dateToStr) : undefined;
    const requestedBrandIds = parseCsvNumbers(brandIdsCsv);
    const allowedBrandIds = await resolveAllowedBrandIds(auth?.userId ?? null, auth?.roles ?? [], requestedBrandIds);

    if (allowedBrandIds.length === 0) {
      return NextResponse.json({ success: true, data: [], message: "Tidak ada brand yang diizinkan" });
    }

    const where: any = { brandProfileId: { in: allowedBrandIds } };
    const productId = productIdStr ? Number(productIdStr) : undefined;
    if (Number.isFinite(productId)) where.productId = productId;
    if (dateFrom || dateTo) {
      if (dateFrom || dateTo) where.createdAt = {};
      if (dateFrom) where.createdAt.gte = dateFrom;
      if (dateTo) where.createdAt.lte = dateTo;
    }

    const grouped = await prisma.stockMutation.groupBy({
      by: ["brandProfileId", "type"],
      where,
      _sum: { qty: true },
    });

    // Normalize per brand
    const brandMap: Record<number, { brandProfileId: number; in: number; out: number; adjust: number }> = {};
    for (const g of grouped) {
      if (g.brandProfileId == null) continue;
      const bid = g.brandProfileId as number;
      if (!brandMap[bid]) brandMap[bid] = { brandProfileId: bid, in: 0, out: 0, adjust: 0 };
      const sum = Number(g._sum.qty || 0);
      if (g.type === "IN") brandMap[bid].in += sum;
      else if (g.type === "OUT") brandMap[bid].out += sum;
      else brandMap[bid].adjust += sum;
    }

    const rows = Object.values(brandMap);
    return NextResponse.json({ success: true, data: rows });
  } catch (e: any) {
    console.error("[reports/stock-summary]", e);
    return NextResponse.json({ success: false, message: e?.message || "Gagal memuat ringkasan stok" }, { status: 500 });
  }
}

