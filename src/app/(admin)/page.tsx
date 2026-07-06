import type { Metadata } from "next";
import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import Link from "next/link";
import { startOfMonth, subMonths, format } from "date-fns";
import { TrendChart } from "@/components/dashboard/TrendChart";
import EmptyState from "@/components/EmptyState";
import { prisma } from "@/lib/prisma";
import { getAuth } from "@/lib/auth";
import { getActiveBrandProfile, resolveAllowedBrandIds, isOwnerOnly } from "@/lib/brand";
import AutoRefresh from "@/components/dashboard/AutoRefresh";
import { MetricCards, type DashboardCard } from "@/components/dashboard/MetricCards";
import { PipelineSummary, type PipelineGroup } from "@/components/dashboard/PipelineSummary";
import { RecentTransactions, type RecentSection } from "@/components/dashboard/RecentTransactions";
import { TopCustomers } from "@/components/dashboard/TopCustomers";
import { InventorySummary } from "@/components/dashboard/InventorySummary";
import { ActionCenter, type ActionItem } from "@/components/dashboard/ActionCenter";
import { ReceivablesCard, type ReceivablesData } from "@/components/dashboard/ReceivablesCard";
import { unstable_cache } from "next/cache";

const currencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 0,
});

type DashboardData = {
  cards: DashboardCard[];
  trend: {
    categories: string[];
    series: { name: string; data: number[] }[];
  };
  pipeline: PipelineGroup[];
  recent: RecentSection[];
  topCustomers: { id: number; name: string; total: number; invoices: number }[];
  inventory: {
    totalProducts: number;
    lowStock: { id: number; name: string; sku: string; qty: number; unit: string }[];
  };
  actions: ActionItem[];
  receivables: ReceivablesData;
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  confirmed: "Confirmed",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
  canceled: "Cancelled",
  pending: "Pending",
  processing: "Processing",
  completed: "Completed",
  paid: "Paid",
  overdue: "Overdue",
  partially_paid: "Partially Paid",
  issued: "Issued",
};

function formatCurrency(value: number) {
  return currencyFormatter.format(value ?? 0);
}

function formatNumberValue(value: number) {
  return numberFormatter.format(value ?? 0);
}

function normalizeStatus(status: string) {
  return (status ?? "unknown").toLowerCase().replace(/\s+/g, "_");
}

function getStatusLabel(status: string) {
  const normalized = normalizeStatus(status);
  return STATUS_LABELS[normalized] ?? (status || "Unknown");
}

function calcTrend(current: number, previous: number) {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

function buildPipelineGroup(
  key: string,
  title: string,
  raw: { status: string | null; _count: { _all: number } }[],
): PipelineGroup {
  const total = raw.reduce((sum, item) => sum + (item._count._all ?? 0), 0);
  const statuses = raw
    .map((item) => ({
      status: item.status ?? "Unknown",
      label: getStatusLabel(item.status ?? "Unknown"),
      count: item._count._all ?? 0,
      percentage: total ? Math.round(((item._count._all ?? 0) / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return { key, title, total, statuses };
}


const getCachedDashboardData = unstable_cache(
  async (brandId?: number, rangeDays: number = 30): Promise<DashboardData> => {
    const now = new Date();

  const currentMonthStart = startOfMonth(now);
  const previousMonthStart = startOfMonth(subMonths(now, 1));
  const trendStart = subMonths(currentMonthStart, 5);
  const currentStart = new Date(now.getTime() - rangeDays * 24 * 60 * 60 * 1000);
  const previousStart = new Date(currentStart.getTime() - rangeDays * 24 * 60 * 60 * 1000);

  const brandFilter = brandId ? Prisma.sql`AND "brandProfileId" = ${brandId}` : Prisma.empty;
  const brandWhere = brandId ? { brandProfileId: brandId } : {};

  const [statsRaw] = await prisma.$queryRaw<any[]>(Prisma.sql`
    SELECT
      (SELECT COUNT(*) FROM customer WHERE "isDeleted" = false ${brandFilter}) as customerCount,
      (SELECT COUNT(*) FROM customer WHERE "isDeleted" = false AND "createdAt" >= ${currentStart} ${brandFilter}) as newCustomersCount,
      (SELECT COUNT(*) FROM product WHERE "isDeleted" = false ${brandFilter}) as productCount,
      (SELECT SUM("totalAmount") FROM quotation WHERE "isDeleted" = false AND "date" >= ${currentStart} ${brandFilter}) as quotationMonthlySum,
      (SELECT COUNT(*) FROM quotation WHERE "isDeleted" = false AND "date" >= ${currentStart} ${brandFilter}) as quotationMonthlyCount,
      (SELECT SUM("totalAmount") FROM quotation WHERE "isDeleted" = false AND "date" >= ${previousStart} AND "date" < ${currentStart} ${brandFilter}) as quotationPrevSum,
      (SELECT SUM("totalAmount") FROM salesorder WHERE "isDeleted" = false AND "date" >= ${currentStart} ${brandFilter}) as salesOrderMonthlySum,
      (SELECT COUNT(*) FROM salesorder WHERE "isDeleted" = false AND "date" >= ${currentStart} ${brandFilter}) as salesOrderMonthlyCount,
      (SELECT SUM("totalAmount") FROM salesorder WHERE "isDeleted" = false AND "date" >= ${previousStart} AND "date" < ${currentStart} ${brandFilter}) as salesOrderPrevSum,
      (SELECT SUM("total") FROM invoice WHERE "isDeleted" = false AND "issueDate" >= ${currentStart} ${brandFilter}) as invoiceMonthlySum,
      (SELECT COUNT(*) FROM invoice WHERE "isDeleted" = false AND "issueDate" >= ${currentStart} ${brandFilter}) as invoiceMonthlyCount,
      (SELECT SUM("total") FROM invoice WHERE "isDeleted" = false AND "issueDate" >= ${previousStart} AND "issueDate" < ${currentStart} ${brandFilter}) as invoicePrevSum,
      (SELECT SUM("total") FROM invoice WHERE "isDeleted" = false AND status NOT IN ('Paid', 'Void', 'Canceled') ${brandFilter}) as outstandingSum,
      (SELECT COUNT(*) FROM salesorder WHERE "isDeleted" = false AND status IN ('Draft', 'Confirmed') ${brandFilter}) as pendingApprovalCount,
      (SELECT COUNT(*) FROM invoice WHERE "isDeleted" = false AND "dueDate" < ${now} AND "paymentStatus" != 'PAID' ${brandFilter}) as invoiceDueCount,
      (SELECT COUNT(*) FROM salesorder WHERE "isDeleted" = false AND status NOT IN ('Shipping', 'Delivered', 'Completed', 'Canceled') ${brandFilter}) as orderUnshippedCount,
      (SELECT COUNT(*) FROM purchasedirect WHERE "isDeleted" = false AND status NOT IN ('Received', 'Canceled') ${brandFilter}) as purchaseUnreceivedCount,
      (SELECT SUM(
          (COALESCE("supplierCost", 0) + COALESCE("titipanCostAdjustment", 0) + COALESCE("taxAdjustment", 0)) * "quantity"
        ) FROM salesorderitem soi 
        JOIN salesorder so ON soi."salesOrderId" = so.id 
        WHERE so."isDeleted" = false AND so."date" >= ${currentStart} ${brandFilter}
      ) as totalSalesCost
  `);

  const [
    quotationStatusesRaw,
    recentQuotationsRaw,
    salesOrderStatusesRaw,
    recentSalesOrdersRaw,
    salesOrderTrendRaw,
    invoiceStatusesRaw,
    recentInvoicesRaw,
    invoiceTrendRaw,
    topCustomersRaw,
    lowStockProductsRaw,
    invoiceDueRowsRaw,
  ] = await Promise.all([
    prisma.quotation.groupBy({
      by: ["status"],
      _count: { _all: true },
      where: brandId ? { brandProfileId: brandId } : undefined,
    }),
    prisma.quotation.findMany({
      orderBy: { date: "desc" },
      take: 6,
      include: { customer: { select: { company: true } } },
      where: brandId ? { brandProfileId: brandId } : undefined,
    }),
    prisma.salesOrder.groupBy({
      by: ["status"],
      _count: { _all: true },
      where: brandId ? { brandProfileId: brandId } : undefined,
    }),
    prisma.salesOrder.findMany({
      orderBy: { date: "desc" },
      take: 6,
      include: { customer: { select: { company: true } } },
      where: brandId ? { brandProfileId: brandId } : undefined,
    }),
    prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT TO_CHAR("date", 'YYYY-MM') as month, SUM("totalAmount") as total
      FROM salesorder
      WHERE "isDeleted" = false AND "date" >= ${trendStart} ${brandFilter}
      GROUP BY 1 ORDER BY 1 ASC
    `),
    prisma.invoice.groupBy({
      by: ["status"],
      _count: { _all: true },
      where: brandId ? { brandProfileId: brandId } : undefined,
    }),
    prisma.invoice.findMany({
      orderBy: { issueDate: "desc" },
      take: 6,
      include: { customer: { select: { company: true } } },
      where: brandId ? { brandProfileId: brandId } : undefined,
    }),
    prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT TO_CHAR("issueDate", 'YYYY-MM') as month, SUM("total") as total
      FROM invoice
      WHERE "isDeleted" = false AND "issueDate" >= ${trendStart} ${brandFilter}
      GROUP BY 1 ORDER BY 1 ASC
    `),
    prisma.invoice.groupBy({
      by: ["customerId"],
      _sum: { total: true },
      _count: { _all: true },
      orderBy: { _sum: { total: "desc" } },
      take: 10,
      where: brandId ? { brandProfileId: brandId } : undefined,
    }),
    prisma.product.findMany({
      where: brandId
        ? { trackStock: true, qty: { lte: 10 }, brandProfileId: brandId }
        : { trackStock: true, qty: { lte: 10 } },
      orderBy: { qty: "asc" },
      take: 10,
      select: { id: true, name: true, sku: true, qty: true, unit: true },
    }),
    prisma.invoice.findMany({
      where: {
        ...brandWhere,
        dueDate: { lt: now },
        paymentStatus: { notIn: ["PAID"] },
      },
      select: { id: true, total: true, paidAmount: true, dueDate: true },
    }),
  ]);

  // Map raw stats back to variables
  const stats = statsRaw?.[0] || {};
  const customerCount = Number(stats.customerCount || 0);
  const newCustomersCount = Number(stats.newCustomersCount || 0);
  const productCount = Number(stats.productCount || 0);
  const quotationMonthly = { _sum: { totalAmount: stats.quotationMonthlySum || 0 }, _count: stats.quotationMonthlyCount || 0 };
  const quotationPrev = { _sum: { totalAmount: stats.quotationPrevSum || 0 } };
  const salesOrderMonthly = { _sum: { totalAmount: stats.salesOrderMonthlySum || 0 }, _count: stats.salesOrderMonthlyCount || 0 };
  const salesOrderPrev = { _sum: { totalAmount: stats.salesOrderPrevSum || 0 } };
  const invoiceMonthly = { _sum: { total: stats.invoiceMonthlySum || 0 }, _count: stats.invoiceMonthlyCount || 0 };
  const invoicePrev = { _sum: { total: stats.invoicePrevSum || 0 } };
  const outstandingInvoices = { _sum: { total: stats.outstandingSum || 0 } };
  const pendingApprovalCount = Number(stats.pendingApprovalCount || 0);
  const invoiceDueRows = invoiceDueRowsRaw;
  const orderUnshippedCount = Number(stats.orderUnshippedCount || 0);
  const purchaseUnreceivedCount = Number(stats.purchaseUnreceivedCount || 0);
  const totalSalesCost = Number(stats.totalSalesCost || 0);
  const netMargin = Number(salesOrderMonthly._sum.totalAmount || 0) - totalSalesCost;
  const marginPercent = salesOrderMonthly._sum.totalAmount ? (netMargin / Number(salesOrderMonthly._sum.totalAmount)) * 100 : 0;

  // --- Piutang & aging (cash flow) ---
  const nowTs = now.getTime();
  const agingBuckets = [
    { label: "1\u201330 hari", amount: 0, count: 0 },
    { label: "31\u201360 hari", amount: 0, count: 0 },
    { label: "> 60 hari", amount: 0, count: 0 },
  ];
  let overdueTotal = 0;
  const dueRows = Array.isArray(invoiceDueRows) ? invoiceDueRows : [];
  dueRows.forEach((row: any) => {
    const remaining = Math.max(0, Number(row.total || 0) - Number(row.paidAmount || 0));
    if (remaining <= 0) return;
    overdueTotal += remaining;
    const days = row.dueDate ? Math.floor((nowTs - new Date(row.dueDate).getTime()) / 86400000) : 0;
    const bucket = days <= 30 ? agingBuckets[0] : days <= 60 ? agingBuckets[1] : agingBuckets[2];
    bucket.amount += remaining;
    bucket.count += 1;
  });
  const receivables: ReceivablesData = {
    outstandingTotal: Number(outstandingInvoices._sum.total ?? 0),
    overdueTotal,
    overdueCount: dueRows.length,
    aging: agingBuckets,
  };
  const actions: ActionItem[] = [
    { key: "pendingApproval", count: pendingApprovalCount },
    { key: "invoiceDue", count: dueRows.length, amount: overdueTotal },
    { key: "orderUnshipped", count: orderUnshippedCount },
    { key: "purchaseUnreceived", count: purchaseUnreceivedCount },
  ];

  let topCustomers: DashboardData["topCustomers"] = [];

  if (topCustomersRaw.length) {
    const customerIds = topCustomersRaw.map((item) => item.customerId);
    const customerRows = await prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, company: true },
    });
    const nameMap = new Map(customerRows.map((row) => [row.id, row.company]));
    topCustomers = topCustomersRaw.map((item) => ({
      id: item.customerId,
      name: nameMap.get(item.customerId) ?? `Customer #${item.customerId}`,
      total: Number(item._sum.total ?? 0),
      invoices: item._count._all ?? 0,
    }));
  }

  const cards: DashboardCard[] = [
    {
      key: "salesOrders",
      title: "Sales Order Revenue",
      value: Number(salesOrderMonthly._sum.totalAmount ?? 0),
      format: "currency",
      lines: [
        `${formatNumberValue(salesOrderMonthly._count ?? 0)} order periode ini`,
        salesOrderMonthly._count
          ? `Rata-rata ${formatCurrency(
              Number(salesOrderMonthly._sum.totalAmount ?? 0) /
                (salesOrderMonthly._count ?? 1),
            )}`
          : "Belum ada order periode ini",
      ],
      trend: calcTrend(
        Number(salesOrderMonthly._sum.totalAmount ?? 0),
        Number(salesOrderPrev._sum.totalAmount ?? 0),
      ),
    },
    {
      key: "invoices",
      title: "Invoice Issued",
      value: Number(invoiceMonthly._sum.total ?? 0),
      format: "currency",
      lines: [
        `${formatNumberValue(invoiceMonthly._count ?? 0)} faktur periode ini`,
        `Outstanding ${formatCurrency(Number(outstandingInvoices._sum.total ?? 0))}`,
      ],
      trend: calcTrend(
        Number(invoiceMonthly._sum.total ?? 0),
        Number(invoicePrev._sum.total ?? 0),
      ),
    },
    {
      key: "netMargin",
      title: "Net Margin",
      value: netMargin,
      format: "currency",
      lines: [
        `HPP + biaya: ${formatCurrency(totalSalesCost)}`,
        `${marginPercent.toFixed(1)}% dari total revenue`,
      ],
      trend: marginPercent > 20 ? 1 : marginPercent > 0 ? 0 : -1,
    },
    {
      key: "quotations",
      title: "Quotation Volume",
      value: Number(quotationMonthly._sum.totalAmount ?? 0),
      format: "currency",
      lines: [
        `${formatNumberValue(quotationMonthly._count ?? 0)} dokumen periode ini`,
        newCustomersCount
          ? `${formatNumberValue(newCustomersCount)} pelanggan baru (total ${formatNumberValue(customerCount)})`
          : `Total ${formatNumberValue(customerCount)} pelanggan`,
      ],
      trend: calcTrend(
        Number(quotationMonthly._sum.totalAmount ?? 0),
        Number(quotationPrev._sum.totalAmount ?? 0),
      ),
    },
  ];

  const pipeline: PipelineGroup[] = [
    buildPipelineGroup("quotation", "Quotation", quotationStatusesRaw),
    buildPipelineGroup("sales-order", "Sales Order", salesOrderStatusesRaw),
    buildPipelineGroup("invoice", "Invoice", invoiceStatusesRaw),
  ];

  const months: Date[] = [];
  for (let offset = 5; offset >= 0; offset -= 1) {
    months.push(subMonths(currentMonthStart, offset));
  }
  const monthKeys = months.map((date) => format(date, "yyyy-MM"));
  const categories = months.map((date) => format(date, "MMM yy"));

  const ordersByMonth = new Map<string, number>(monthKeys.map((key) => [key, 0]));
  salesOrderTrendRaw.forEach((item) => {
    ordersByMonth.set(item.month, Number(item.total ?? 0));
  });

  const invoicesByMonth = new Map<string, number>(monthKeys.map((key) => [key, 0]));
  invoiceTrendRaw.forEach((item) => {
    invoicesByMonth.set(item.month, Number(item.total ?? 0));
  });

  const trend = {
    categories,
    series: [
      {
        name: "Sales Orders",
        data: monthKeys.map((key) => Math.round(ordersByMonth.get(key) ?? 0)),
      },
      {
        name: "Invoices",
        data: monthKeys.map((key) => Math.round(invoicesByMonth.get(key) ?? 0)),
      },
    ],
  };

  const recent: RecentSection[] = [
    {
      key: "quotations",
      title: "Quotation Terbaru",
      link: "/penjualan/quotation",
      items: recentQuotationsRaw.map((item) => ({
        id: item.id,
        number: item.quotationNumber,
        customer: item.customer?.company ?? "-",
        amount: Number(item.totalAmount ?? 0),
        date: item.date,
        status: item.status ?? "Unknown",
        link: `/penjualan/quotation/${item.id}`,
      })),
    },
    {
      key: "sales-orders",
      title: "Order Penjualan Terbaru",
      link: "/penjualan/order-penjualan",
      items: recentSalesOrdersRaw.map((item) => ({
        id: item.id,
        number: item.orderNumber,
        customer: item.customer?.company ?? "-",
        amount: Number(item.totalAmount ?? 0),
        date: item.date,
        status: item.status ?? "Unknown",
        link: `/penjualan/order-penjualan/${item.id}`,
      })),
    },
    {
      key: "invoices",
      title: "Invoice Terbaru",
      link: "/penjualan/invoice-penjualan",
      items: recentInvoicesRaw.map((item) => ({
        id: item.id,
        number: item.invoiceNumber,
        customer: item.customer?.company ?? "-",
        amount: Number(item.total ?? 0),
        date: item.issueDate,
        status: item.status ?? "Unknown",
        link: `/penjualan/invoice-penjualan/${item.id}`,
      })),
    },
  ];

    return {
      cards,
      trend,
      pipeline,
      recent,
      topCustomers,
      inventory: {
        totalProducts: productCount,
        lowStock: lowStockProductsRaw,
      },
      actions,
      receivables,
    };
  },
  ["dashboard-data"],
  { revalidate: 60, tags: ["dashboard"] }
);

async function getDashboardData(brandId?: number, rangeDays: number = 30) {
  return getCachedDashboardData(brandId, rangeDays);
}


export const metadata: Metadata = {
  title: "Dashboard Overview | Bakung Dashboard",
  description:
    "Ringkasan pipeline penjualan, faktur, dan status inventori untuk membantu pemantauan performa bisnis.",
};

export const revalidate = 60;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const auth = await getAuth();
  if (!auth?.userId) {
    return redirect(`/signin?redirect=/`);
  }
  
  try {
    const allowed = await resolveAllowedBrandIds(auth.userId, (auth.roles as string[]) ?? [], []);
    const isOwner = isOwnerOnly(auth.roles);
    if (!isOwner && (!allowed || allowed.length === 0)) {
      return (
        <EmptyState
          title="Akses brand belum diatur"
          description="Akun Anda belum diassign ke brand mana pun. Hubungi Owner untuk meminta akses brand agar dapat membuka modul dan melihat data."
        />
      );
    }
  } catch (err) {}

  let activeBrand: Awaited<ReturnType<typeof getActiveBrandProfile>> | null = null;
  try {
    activeBrand = await getActiveBrandProfile();
  } catch (err) {
    activeBrand = null;
  }

  const rangeParamRaw = sp?.range;
  const rangeParam = Array.isArray(rangeParamRaw)
    ? String(rangeParamRaw[0])
    : String(rangeParamRaw ?? "30d");
  const rangeDays = rangeParam === "90d" ? 90 : rangeParam === "180d" ? 180 : 30;

  let data: Awaited<ReturnType<typeof getDashboardData>> | null = null;
  try {
    data = await getDashboardData(activeBrand?.id ?? undefined, rangeDays);
  } catch (err) {
    console.error("Dashboard data load failed.", err);
    return (
      <EmptyState
        title="Database tidak terhubung"
        description="Aplikasi tidak dapat terhubung ke server database. Pastikan MySQL/MariaDB berjalan dan variabel .env (DATABASE_URL) telah dikonfigurasi."
      />
    );
  }

  return (
    <div className="space-y-6">
      <AutoRefresh intervalMs={60_000} />
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white/90 flex items-center gap-2">
            Dashboard Overview
            {activeBrand?.name && (
              <span
                className="ml-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium text-gray-700 dark:text-gray-300"
                style={{ borderColor: activeBrand?.primaryColor || "#0EA5E9" }}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: activeBrand?.primaryColor || "#0EA5E9" }}
                />
                {activeBrand.name}
              </span>
            )}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Ringkasan penjualan, pipeline, dan kesehatan inventori perusahaan Anda
            {activeBrand?.name ? ` — brand aktif: ${activeBrand.name}.` : "."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {["30d", "90d", "180d"].map((r) => (
            <Link
              key={r}
              href={`/?range=${r}`}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                rangeParam === r
                  ? "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
              }`}
            >
              {r === "30d" ? "30 hari" : r === "90d" ? "90 hari" : "180 hari"}
            </Link>
          ))}
        </div>
      </header>

      <ActionCenter items={data.actions} />

      <MetricCards cards={data.cards} rangeDays={rangeDays} />

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">
                Tren Performa Penjualan
              </h2>
              <p className="text-sm text-gray-500">Nilai transaksi 6 bulan terakhir</p>
            </div>
          </div>
          <div className="mt-6 h-80">
            <TrendChart categories={data.trend.categories} series={data.trend.series} valueType="currency" />
          </div>
        </div>

        <div className="space-y-6">
          <ReceivablesCard data={data.receivables} />
          <PipelineSummary pipeline={data.pipeline} />
          <TopCustomers topCustomers={data.topCustomers} />
          <InventorySummary inventory={data.inventory} />
        </div>
      </section>

      <RecentTransactions recent={data.recent} />
    </div>
  );
}

