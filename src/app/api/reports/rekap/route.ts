import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuth } from "@/lib/auth";

function parseCsvNumbers(val?: string | null): number[] {
  if (!val) return [];
  return val
    .split(",")
    .map((s) => Number(String(s).trim()))
    .filter((n) => !Number.isNaN(n));
}

function isAdminOrOwner(roles?: string[] | null): boolean {
  if (!Array.isArray(roles)) return false;
  return roles.some((r) => {
    const x = r.toLowerCase();
    return x === "admin" || x === "owner";
  });
}

async function resolveAllowedBrandIds(userId: number | null, roles?: string[] | null, requestedBrandIds?: number[]) {
  // Admin/Owner: all brands (or filtered by requestedBrandIds if provided)
  if (isAdminOrOwner(roles)) {
    if (requestedBrandIds && requestedBrandIds.length > 0) return requestedBrandIds;
    const all = await prisma.brandProfile.findMany({ select: { id: true } });
    return all.map((b) => b.id);
  }

  // Non-admin: restrict to user's brand scopes; if request filters intersect, use intersection
  if (!userId) return [];
  const scopes = await prisma.userBrandScope.findMany({ where: { userId }, select: { brandProfileId: true } });
  const scoped = scopes.map((s) => s.brandProfileId);
  if (requestedBrandIds && requestedBrandIds.length > 0) {
    const set = new Set(scoped);
    return requestedBrandIds.filter((id) => set.has(id));
  }
  return scoped;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuth();
    const url = new URL(req.url);
    const dateFromStr = url.searchParams.get("dateFrom");
    const dateToStr = url.searchParams.get("dateTo");
    const brandIdsCsv = url.searchParams.get("brandIds");
    const aggregateMode = (url.searchParams.get("aggregateMode") || "ALL").toUpperCase(); // ALL | PER_BRAND
    const clientIdStr = url.searchParams.get("clientId");
    const clientName = url.searchParams.get("client");
    const supplier = url.searchParams.get("supplier");
    const pageStr = url.searchParams.get("page") || "1";
    const pageSizeStr = url.searchParams.get("pageSize") || "50";

    const page = Math.max(1, parseInt(pageStr));
    const pageSize = Math.max(1, Math.min(200, parseInt(pageSizeStr)));

    const dateFrom = dateFromStr ? new Date(dateFromStr) : undefined;
    const dateTo = dateToStr ? new Date(dateToStr) : undefined;
    const requestedBrandIds = parseCsvNumbers(brandIdsCsv);

    const allowedBrandIds = await resolveAllowedBrandIds(auth?.userId ?? null, auth?.roles ?? [], requestedBrandIds);

    // where fragments
    const whereSales: any = {};
    const whereInvoice: any = {};
    const wherePurchase: any = {};
    const whereExpense: any = {};
    const whereStock: any = {};

    if (allowedBrandIds.length > 0) {
      whereSales.brandProfileId = { in: allowedBrandIds };
      whereInvoice.brandProfileId = { in: allowedBrandIds };
      wherePurchase.brandProfileId = { in: allowedBrandIds };
      whereExpense.brandProfileId = { in: allowedBrandIds };
      whereStock.brandProfileId = { in: allowedBrandIds };
    }

    if (dateFrom || dateTo) {
      if (dateFrom || dateTo) whereSales.date = {};
      if (dateFrom) whereSales.date.gte = dateFrom;
      if (dateTo) whereSales.date.lte = dateTo;

      if (dateFrom || dateTo) whereInvoice.issueDate = {};
      if (dateFrom) whereInvoice.issueDate.gte = dateFrom;
      if (dateTo) whereInvoice.issueDate.lte = dateTo;

      if (dateFrom || dateTo) wherePurchase.date = {};
      if (dateFrom) wherePurchase.date.gte = dateFrom;
      if (dateTo) wherePurchase.date.lte = dateTo;

      if (dateFrom || dateTo) whereExpense.paidAt = {};
      if (dateFrom) whereExpense.paidAt.gte = dateFrom;
      if (dateTo) whereExpense.paidAt.lte = dateTo;

      if (dateFrom || dateTo) whereStock.createdAt = {};
      if (dateFrom) whereStock.createdAt.gte = dateFrom;
      if (dateTo) whereStock.createdAt.lte = dateTo;
    }

    // client filter for sales/invoice
    const clientId = clientIdStr ? Number(clientIdStr) : undefined;
    if (clientId && !Number.isNaN(clientId)) {
      whereSales.customerId = clientId;
      whereInvoice.customerId = clientId;
    } else if (clientName && clientName.trim()) {
      // Filter by customer relation name contains
      whereSales.customer = { name: { contains: clientName } };
      whereInvoice.customer = { name: { contains: clientName } };
    }

    // supplier filter for purchases
    if (supplier && supplier.trim()) wherePurchase.supplierName = { contains: supplier };

    // Aggregations and rows
    const [salesAgg, salesRows, purchaseAgg, purchaseRows, expenseAgg, expenseRows, invoiceAgg] = await Promise.all([
      prisma.salesOrder.aggregate({ where: whereSales, _sum: { totalAmount: true }, _count: true }),
      prisma.salesOrder.findMany({
        where: whereSales,
        include: { customer: true, brand: true },
        orderBy: { date: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.purchaseDirect.aggregate({ where: wherePurchase, _sum: { total: true }, _count: true }),
      prisma.purchaseDirect.findMany({
        where: wherePurchase,
        include: { brand: true },
        orderBy: { date: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.expense.aggregate({ where: whereExpense, _sum: { amount: true }, _count: true }),
      prisma.expense.findMany({ where: whereExpense, include: { brand: true, payment: true }, orderBy: { paidAt: "desc" }, skip: 0, take: Math.min(200, pageSize) }),
      prisma.invoice.aggregate({ where: whereInvoice, _sum: { total: true }, _count: true }),
    ]);

    // AR (A/R) = order/invoice unpaid
    const [soAr, invAr] = await Promise.all([
      prisma.salesOrder.findMany({
        where: { ...whereSales, AND: [{}, { totalAmount: { gt: 0 } }] },
        select: { id: true, orderNumber: true, date: true, totalAmount: true, paidAmount: true, brandProfileId: true, customer: { select: { name: true } }, brand: { select: { name: true } } },
      }),
      prisma.invoice.findMany({
        where: { ...whereInvoice, AND: [{}, { total: { gt: 0 } }] },
        select: { id: true, invoiceNumber: true, issueDate: true, total: true, paidAmount: true, brandProfileId: true, customer: { select: { name: true } }, brand: { select: { name: true } } },
      }),
    ]);
    const arRows: any[] = [];
    for (const r of soAr) {
      const due = Number(r.totalAmount || 0) - Number(r.paidAmount || 0);
      if (due > 0.0001) arRows.push({
        type: "SO",
        id: r.id,
        number: r.orderNumber,
        date: r.date,
        customer: r.customer?.name ?? "",
        brandId: r.brandProfileId,
        brandName: r.brand?.name ?? "",
        total: r.totalAmount,
        paid: r.paidAmount,
        due,
      });
    }
    for (const r of invAr) {
      const due = Number(r.total || 0) - Number(r.paidAmount || 0);
      if (due > 0.0001) arRows.push({
        type: "INV",
        id: r.id,
        number: r.invoiceNumber,
        date: r.issueDate,
        customer: r.customer?.name ?? "",
        brandId: r.brandProfileId,
        brandName: r.brand?.name ?? "",
        total: r.total,
        paid: r.paidAmount,
        due,
      });
    }
    const arTotalDue = arRows.reduce((s, r) => s + Number(r.due || 0), 0);

    // AP (A/P) = purchase/expense unpaid
    const purchaseApRowsRaw = await prisma.purchaseDirect.findMany({
      where: wherePurchase,
      select: { id: true, purchaseNumber: true, date: true, supplierName: true, total: true, paidAmount: true, brandProfileId: true, brand: { select: { name: true } } },
    });
    const apRows: any[] = [];
    for (const p of purchaseApRowsRaw) {
      const due = Number(p.total || 0) - Number(p.paidAmount || 0);
      if (due > 0.0001) apRows.push({
        type: "PURCHASE",
        id: p.id,
        number: p.purchaseNumber,
        date: p.date,
        supplier: p.supplierName,
        brandId: p.brandProfileId,
        brandName: p.brand?.name ?? "",
        total: p.total,
        paid: p.paidAmount,
        due,
      });
    }
    const expenseUnpaidRows = await prisma.expense.findMany({
      where: { ...whereExpense, paymentId: null },
      select: { id: true, category: true, paidAt: true, amount: true, brandProfileId: true, brand: { select: { name: true } } },
    });
    for (const e of expenseUnpaidRows) {
      const due = Number(e.amount || 0);
      if (due > 0.0001) apRows.push({
        type: "EXPENSE",
        id: e.id,
        number: `EXP-${e.id}`,
        date: e.paidAt,
        supplier: e.category,
        brandId: e.brandProfileId,
        brandName: e.brand?.name ?? "",
        total: e.amount,
        paid: 0,
        due,
      });
    }
    const apTotalDue = apRows.reduce((s, r) => s + Number(r.due || 0), 0);

    // Stock recap per product (saldo sampai end date)
    const stockGroup = await prisma.stockMutation.groupBy({
      by: ["productId"],
      where: whereStock,
      _sum: { qty: true },
    });
    const productIds = stockGroup.map((g) => g.productId);
    const products = await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, sku: true, name: true, unit: true, brandProfileId: true, brand: { select: { name: true } } } });
    const productMap = new Map(products.map((p) => [p.id, p]));
    const stockRows = stockGroup.map((g) => {
      const p = productMap.get(g.productId);
      return {
        productId: g.productId,
        sku: p?.sku ?? "",
        name: p?.name ?? "",
        unit: p?.unit ?? "pcs",
        brandId: p?.brandProfileId ?? null,
        brandName: p?.brand?.name ?? "",
        qty: Number(g._sum.qty || 0),
      };
    });
    const stockTotalQty = stockRows.reduce((sum, r) => sum + Number(r.qty || 0), 0);

    // Brand summary if requested
    let brandSummary: any = { mode: aggregateMode, rows: [] as any[] };
    if (aggregateMode === "PER_BRAND") {
      const rows: any[] = [];
      const brands = await prisma.brandProfile.findMany({ where: allowedBrandIds.length ? { id: { in: allowedBrandIds } } : undefined, select: { id: true, name: true } });
      const brandIdList = brands.map((b) => b.id);

      // Aggregate per brand using groupBy
      const soByBrand = await prisma.salesOrder.groupBy({ by: ["brandProfileId"], where: { ...whereSales, brandProfileId: { in: brandIdList } }, _sum: { totalAmount: true } });
      const invByBrand = await prisma.invoice.groupBy({ by: ["brandProfileId"], where: { ...whereInvoice, brandProfileId: { in: brandIdList } }, _sum: { total: true } });
      const purByBrand = await prisma.purchaseDirect.groupBy({ by: ["brandProfileId"], where: { ...wherePurchase, brandProfileId: { in: brandIdList } }, _sum: { total: true } });
      const expByBrand = await prisma.expense.groupBy({ by: ["brandProfileId"], where: { ...whereExpense, brandProfileId: { in: brandIdList } }, _sum: { amount: true } });

      const soMap = new Map(soByBrand.map((r) => [r.brandProfileId ?? 0, Number(r._sum.totalAmount || 0)]));
      const invMap = new Map(invByBrand.map((r) => [r.brandProfileId ?? 0, Number(r._sum.total || 0)]));
      const purMap = new Map(purByBrand.map((r) => [r.brandProfileId ?? 0, Number(r._sum.total || 0)]));
      const expMap = new Map(expByBrand.map((r) => [r.brandProfileId ?? 0, Number(r._sum.amount || 0)]));

      for (const b of brands) {
        const salesTotal = (soMap.get(b.id) || 0) + (invMap.get(b.id) || 0);
        const purchaseTotal = purMap.get(b.id) || 0;
        const expenseTotal = expMap.get(b.id) || 0;
        rows.push({ brandId: b.id, brandName: b.name, salesTotal, purchaseTotal, expenseTotal, grossProfit: salesTotal - purchaseTotal - expenseTotal });
      }
      brandSummary = { mode: "PER_BRAND", rows };
    }

    const salesTotal = Number(salesAgg._sum.totalAmount || 0) + Number(invoiceAgg._sum.total || 0);
    const purchaseTotal = Number(purchaseAgg._sum.total || 0);
    const expenseTotal = Number(expenseAgg._sum.amount || 0);
    const grossProfit = salesTotal - purchaseTotal - expenseTotal;

    return NextResponse.json({
      success: true,
      filters: {
        dateFrom: dateFrom?.toISOString() ?? null,
        dateTo: dateTo?.toISOString() ?? null,
        brandIds: allowedBrandIds,
        aggregateMode,
      },
      sales: {
        total: salesTotal,
        count: Number(salesAgg._count || 0) + Number(invoiceAgg._count || 0),
        rows: salesRows.map((r) => ({ id: r.id, number: r.orderNumber, date: r.date, customer: r.customer?.name ?? "", total: r.totalAmount, paid: r.paidAmount, due: Number(r.totalAmount || 0) - Number(r.paidAmount || 0), brandId: r.brandProfileId, brandName: r.brand?.name ?? "" })),
      },
      purchases: {
        total: purchaseTotal,
        count: Number(purchaseAgg._count || 0),
        rows: purchaseRows.map((r) => ({ id: r.id, number: r.purchaseNumber, date: r.date, supplier: r.supplierName, total: r.total, paid: r.paidAmount, due: Number(r.total || 0) - Number(r.paidAmount || 0), brandId: r.brandProfileId, brandName: r.brand?.name ?? "" })),
      },
      expenses: {
        total: expenseTotal,
        count: Number(expenseAgg._count || 0),
        rows: expenseRows.map((e) => ({ id: e.id, category: e.category, date: e.paidAt, amount: e.amount, paid: Boolean(e.payment), brandId: e.brandProfileId, brandName: e.brand?.name ?? "" })),
      },
      ar: { totalDue: arTotalDue, count: arRows.length, rows: arRows },
      ap: { totalDue: apTotalDue, count: apRows.length, rows: apRows },
      grossProfit: { amount: grossProfit, components: { salesTotal, purchaseTotal, expenseTotal } },
      stock: { rows: stockRows, totalProducts: stockRows.length, totalQty: stockTotalQty },
      brandSummary,
    });
  } catch (err: any) {
    console.error("[reports/rekap][GET]", err);
    return NextResponse.json({ success: false, message: err?.message || "Gagal memuat rekap" }, { status: 500 });
  }
}

