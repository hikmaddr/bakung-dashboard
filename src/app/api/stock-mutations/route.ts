import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createApiHandler } from "@/lib/api-handler";
import { resolveAllowedBrandIds } from "@/lib/brand";

export const GET = createApiHandler({
  handler: async (req, _, { activeBrand, user }) => {
    const search = req.nextUrl.searchParams;
    const page = Math.max(1, parseInt(search.get("page") || "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(search.get("pageSize") || "20")));
    const typeParam = (search.get("type") || "").trim().toUpperCase();
    const productIdParam = search.get("productId");
    const productName = (search.get("productName") || "").trim();
    const brandIdParam = search.get("brandId");
    const dateFrom = (search.get("dateFrom") || "").trim();
    const dateTo = (search.get("dateTo") || "").trim();
    const includeProduct = (search.get("includeProduct") || "").toLowerCase() === "true";

    const allowedBrandIds = await resolveAllowedBrandIds(
      user.userId,
      user.roles || [],
      []
    );

    let brandId: number | null = null;
    if (brandIdParam) {
      const parsed = Number(brandIdParam);
      if (Number.isFinite(parsed) && parsed > 0) brandId = parsed;
    }

    const where: any = {};
    if (brandId != null) {
      if (allowedBrandIds.length && !allowedBrandIds.includes(brandId)) {
        return NextResponse.json({ success: false, message: "Forbidden: brand scope" }, { status: 403 });
      }
      where.brandProfileId = brandId;
    } else {
      where.brandProfileId = activeBrand.id;
    }

    if (typeParam === "IN" || typeParam === "OUT" || typeParam === "ADJUST") where.type = typeParam as any;
    if (productIdParam) {
      const parsed = Number(productIdParam);
      if (Number.isFinite(parsed) && parsed > 0) where.productId = parsed;
    }
    if (dateFrom || dateTo) {
      where.createdAt = {} as any;
      if (dateFrom) (where.createdAt as any).gte = new Date(dateFrom);
      if (dateTo) (where.createdAt as any).lte = new Date(dateTo);
    }

    const include: any = {};
    if (includeProduct || productName) {
      include.product = { select: { id: true, name: true, sku: true } };
    }

    const nameFilter = productName
      ? {
          product: {
            name: { contains: productName, mode: "insensitive" as const },
          },
        }
      : {};

    const [count, rows, totalInAgg, totalOutAgg] = await Promise.all([
      prisma.stockMutation.count({ where: { ...where, ...nameFilter } }),
      prisma.stockMutation.findMany({
        where: { ...where, ...nameFilter },
        include,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.stockMutation.aggregate({ _sum: { qty: true }, where: { ...where, type: "IN", ...nameFilter } }),
      prisma.stockMutation.aggregate({ _sum: { qty: true }, where: { ...where, type: "OUT", ...nameFilter } }),
    ]);

    const totalIn = Number(totalInAgg?._sum?.qty || 0);
    const totalOut = Number(totalOutAgg?._sum?.qty || 0);

    return NextResponse.json({ success: true, data: rows, page, pageSize, count, totalIn, totalOut });
  }
});


