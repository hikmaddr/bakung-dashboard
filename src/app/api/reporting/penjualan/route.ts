import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveBrandProfile } from "@/lib/brand";

function parseRange(range?: string) {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  let start = new Date(end);
  if (!range || range === "30d") {
    start.setDate(end.getDate() - 30);
  } else if (range === "7d") {
    start.setDate(end.getDate() - 7);
  } else if (range === "90d") {
    start.setDate(end.getDate() - 90);
  } else if (range === "ytd") {
    start = new Date(end.getFullYear(), 0, 1);
  } else {
    // format: YYYY-MM-DD_to_YYYY-MM-DD
    const m = range.match(/^(\d{4}-\d{2}-\d{2})_to_(\d{4}-\d{2}-\d{2})$/);
    if (m) {
      start = new Date(m[1]);
      const e = new Date(m[2]);
      end.setFullYear(e.getFullYear(), e.getMonth(), e.getDate() + 1);
    } else {
      start.setDate(end.getDate() - 30);
    }
  }
  return { start, end };
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const range = url.searchParams.get("range") || undefined;
    const { start, end } = parseRange(range);

    const brand = await getActiveBrandProfile();
    const brandWhere = brand ? { brandProfileId: brand.id } : {};

    // Aggregate totals for invoices in range
    const [agg, invoices, itemsGrouped] = await Promise.all([
      prisma.invoice.aggregate({
        where: { issueDate: { gte: start, lt: end }, ...(brandWhere as any) },
        _sum: { total: true },
        _count: true,
      }),
      prisma.invoice.findMany({
        where: { issueDate: { gte: start, lt: end }, ...(brandWhere as any) },
        select: { issueDate: true, total: true, customerId: true },
        orderBy: { issueDate: "asc" },
      }),
      prisma.invoiceItem.groupBy({
        by: ["productId"],
        _sum: { quantity: true, total: true },
        orderBy: { _sum: { total: "desc" } },
        take: 10,
        where: {
          invoice: { issueDate: { gte: start, lt: end }, ...(brandWhere as any) },
        } as any,
      }),
    ]);

    // Trend by month (JS group)
    const trendMap: Record<string, { total: number; invoices: number }> = {};
    const activeCustomers = new Set<number | null>();
    invoices.forEach((inv) => {
      const key = monthKey(new Date(inv.issueDate as any));
      const bucket = trendMap[key] || { total: 0, invoices: 0 };
      bucket.total += Number(inv.total || 0);
      bucket.invoices += 1;
      trendMap[key] = bucket;
      activeCustomers.add(inv.customerId ?? null);
    });
    const trend = Object.entries(trendMap)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([month, v]) => ({ month, total: v.total, invoices: v.invoices }));

    // Top products detail lookup
    const topProductIds = itemsGrouped.map((g) => g.productId).filter(Boolean) as number[];
    const topProductsInfo = topProductIds.length
      ? await prisma.product.findMany({
          where: { id: { in: topProductIds } },
          select: { id: true, name: true, productCategory: { select: { name: true } } },
        })
      : [];
    const topProducts = itemsGrouped.map((g) => {
      const info = topProductsInfo.find((p) => p.id === g.productId);
      return {
        id: g.productId,
        name: info?.name || `Product #${g.productId}`,
        category: info?.productCategory?.name || null,
        quantity: Number(g._sum.quantity || 0),
        total: Number(g._sum.total || 0),
      };
    });

    const totalSales = Number(agg._sum.total || 0);
    const orderCount = Number(agg._count || 0);
    const avgOrder = orderCount ? Math.round(totalSales / orderCount) : 0;

    return NextResponse.json({
      range: { start, end },
      brand: brand ? { id: brand.id, name: brand.name } : null,
      metrics: {
        totalSales,
        orderCount,
        activeCustomers: Array.from(activeCustomers).filter((v) => v !== null).length,
        avgOrder,
      },
      trend,
      topProducts,
    });
  } catch (error) {
    console.error("[api.reporting.penjualan] GET error", error);
    return NextResponse.json({ error: "Failed to load sales reporting" }, { status: 500 });
  }
}
