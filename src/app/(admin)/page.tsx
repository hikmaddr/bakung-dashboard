import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { format, startOfMonth, subMonths } from "date-fns";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { prisma } from "@/lib/prisma";
import { getAuth } from "@/lib/auth";
import { getActiveBrandProfile } from "@/lib/brand";


const currencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 0,
});

type DashboardCard = {
  key: string;
  title: string;
  value: number;
  format: "currency" | "number";
  lines: string[];
  trend?: number | null;
};

type PipelineStatus = {
  status: string;
  label: string;
  count: number;
  percentage: number;
};

type PipelineGroup = {
  key: string;
  title: string;
  total: number;
  statuses: PipelineStatus[];
};

type RecentItem = {
  id: number;
  number: string;
  customer: string;
  amount: number;
  date: Date;
  status: string;
  link: string;
};

type RecentSection = {
  key: string;
  title: string;
  link: string;
  items: RecentItem[];
};

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

const STATUS_COLOR_MAP: Record<string, string> = {
  draft: "bg-slate-400",
  sent: "bg-blue-500",
  confirmed: "bg-emerald-500",
  approved: "bg-emerald-500",
  rejected: "bg-rose-500",
  cancelled: "bg-rose-400",
  canceled: "bg-rose-400",
  pending: "bg-amber-500",
  processing: "bg-indigo-500",
  completed: "bg-green-500",
  paid: "bg-emerald-600",
  overdue: "bg-orange-500",
  partially_paid: "bg-sky-500",
  issued: "bg-blue-600",
};

const STATUS_BADGE_MAP: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-300",
  sent: "bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300",
  confirmed: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300",
  approved: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300",
  rejected: "bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300",
  cancelled: "bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300",
  canceled: "bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300",
  pending: "bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300",
  processing: "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300",
  completed: "bg-green-100 text-green-600 dark:bg-green-500/10 dark:text-green-300",
  paid: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300",
  overdue: "bg-orange-100 text-orange-600 dark:bg-orange-500/10 dark:text-orange-300",
  partially_paid: "bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300",
  issued: "bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300",
};

const FALLBACK_COLORS = [
  "bg-indigo-500",
  "bg-sky-500",
  "bg-teal-500",
  "bg-fuchsia-500",
  "bg-amber-500",
  "bg-purple-500",
];

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

function getStatusColorClass(status: string, index: number) {
  const normalized = normalizeStatus(status);
  return STATUS_COLOR_MAP[normalized] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

function getStatusBadgeClass(status: string) {
  const normalized = normalizeStatus(status);
  return STATUS_BADGE_MAP[normalized] ?? "bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-300";
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

async function getDashboardData(brandId?: number, rangeDays: number = 30): Promise<DashboardData> {
  const now = new Date();
  const currentMonthStart = startOfMonth(now);
  const previousMonthStart = startOfMonth(subMonths(now, 1));
  const trendStart = subMonths(currentMonthStart, 5);
  const currentStart = new Date(now.getTime() - rangeDays * 24 * 60 * 60 * 1000);
  const previousStart = new Date(currentStart.getTime() - rangeDays * 24 * 60 * 60 * 1000);

  const brandWhere: Record<string, number> | {} = brandId ? { brandProfileId: brandId } : {};

  const [
    customerCount,
    newCustomersCount,
    productCount,
    quotationMonthly,
    quotationPrev,
    quotationStatusesRaw,
    recentQuotationsRaw,
    salesOrderMonthly,
    salesOrderPrev,
    salesOrderStatusesRaw,
    recentSalesOrdersRaw,
    salesOrderTrendRaw,
    invoiceMonthly,
    invoicePrev,
    invoiceStatusesRaw,
    recentInvoicesRaw,
    outstandingInvoices,
    invoiceTrendRaw,
    topCustomersRaw,
    lowStockProductsRaw,
    // Alerts & notifications
    pendingApprovalCount,
    invoiceDueRows,
    orderUnshippedCount,
    purchaseUnreceivedCount,
  ] = await Promise.all([
    prisma.customer.count({ where: { ...(brandWhere as any) } }),
    prisma.customer.count({ where: { createdAt: { gte: currentStart }, ...(brandWhere as any) } }),
    prisma.product.count({ where: { ...(brandWhere as any) } }),
    prisma.quotation.aggregate({
      where: { date: { gte: currentStart }, ...(brandWhere as any) },
      _sum: { totalAmount: true },
      _count: true,
    }),
    prisma.quotation.aggregate({
      where: { date: { gte: previousStart, lt: currentStart }, ...(brandWhere as any) },
      _sum: { totalAmount: true },
      _count: true,
    }),
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
    prisma.salesOrder.aggregate({
      where: { date: { gte: currentStart }, ...(brandWhere as any) },
      _sum: { totalAmount: true },
      _count: true,
    }),
    prisma.salesOrder.aggregate({
      where: { date: { gte: previousStart, lt: currentStart }, ...(brandWhere as any) },
      _sum: { totalAmount: true },
      _count: true,
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
    prisma.salesOrder.findMany({
      where: { date: { gte: trendStart }, ...(brandWhere as any) },
      select: { date: true, totalAmount: true },
    }),
    prisma.invoice.aggregate({
      where: { issueDate: { gte: currentStart }, ...(brandWhere as any) },
      _sum: { total: true },
      _count: true,
    }),
    prisma.invoice.aggregate({
      where: { issueDate: { gte: previousStart, lt: currentStart }, ...(brandWhere as any) },
      _sum: { total: true },
      _count: true,
    }),
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
    prisma.invoice.aggregate({
      where: {
        status: {
          notIn: [
            "Paid",
            "paid",
            "PAID",
            "Lunas",
            "lunas",
            "Completed",
            "completed",
            "Cancelled",
            "cancelled",
            "Canceled",
            "canceled",
          ],
        },
        ...(brandWhere as any),
      },
      _sum: { total: true },
      _count: true,
    }),
    prisma.invoice.findMany({
      where: { issueDate: { gte: trendStart }, ...(brandWhere as any) },
      select: { issueDate: true, total: true },
    }),
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
    // Pending approval — SO with status Pending
    prisma.salesOrder.count({
      where: {
        ...(brandWhere as any),
        status: { in: ["Pending", "pending"] },
      },
    }),
    // Invoice due — overdue and not fully paid
    prisma.invoice.findMany({
      where: {
        ...(brandWhere as any),
        dueDate: { lt: now },
        paymentStatus: { notIn: ["PAID", "Paid", "paid"] },
      },
      select: { id: true, total: true, paidAmount: true },
    }),
    // Orders not yet shipped — exclude shipped-like and canceled statuses
    prisma.salesOrder.count({
      where: {
        ...(brandWhere as any),
        status: {
          notIn: [
            "shipped",
            "Shipped",
            "sent",
            "Sent",
            "dikirim",
            "Dikirim",
            "cancelled",
            "Cancelled",
            "canceled",
            "Canceled",
          ],
        },
      },
    }),
    // Purchases not received — exclude Received and canceled
    prisma.purchaseDirect.count({
      where: {
        ...(brandWhere as any),
        status: { notIn: ["Received", "Canceled"] },
      },
    }),
  ]);

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
      key: "pendingApproval",
      title: "Pending Approval",
      value: pendingApprovalCount,
      format: "number",
      lines: [
        pendingApprovalCount
          ? `${formatNumberValue(pendingApprovalCount)} order menunggu persetujuan`
          : "Tidak ada order menunggu persetujuan",
      ],
    },
    {
      key: "customers",
      title: "Total Customers",
      value: customerCount,
      format: "number",
      lines: [
        newCustomersCount
          ? `${formatNumberValue(newCustomersCount)} pelanggan baru periode ini`
          : "Belum ada pelanggan baru periode ini",
      ],
    },
    {
      key: "quotations",
      title: "Quotation Volume",
      value: Number(quotationMonthly._sum.totalAmount ?? 0),
      format: "currency",
      lines: [
        `${formatNumberValue(quotationMonthly._count ?? 0)} dokumen periode ini`,
      ],
      trend: calcTrend(
        Number(quotationMonthly._sum.totalAmount ?? 0),
        Number(quotationPrev._sum.totalAmount ?? 0),
      ),
    },
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
    // Alerts following revenue cards
    {
      key: "invoiceDue",
      title: "Invoice Jatuh Tempo",
      value: Array.isArray(invoiceDueRows) ? invoiceDueRows.length : 0,
      format: "number",
      lines: [
        (() => {
          const totalOutstanding = (Array.isArray(invoiceDueRows) ? invoiceDueRows : []).reduce(
            (acc, it) => acc + Math.max(0, Number(it.total || 0) - Number(it.paidAmount || 0)),
            0,
          );
          return totalOutstanding > 0
            ? `Tunggakan ${formatCurrency(totalOutstanding)}`
            : "Tidak ada tunggakan";
        })(),
      ],
    },
    {
      key: "orderUnshipped",
      title: "Order Belum Dikirim",
      value: orderUnshippedCount,
      format: "number",
      lines: [
        orderUnshippedCount
          ? `${formatNumberValue(orderUnshippedCount)} order perlu pengiriman`
          : "Tidak ada order menunggu pengiriman",
      ],
    },
    {
      key: "purchaseUnreceived",
      title: "Pembelian Belum Diterima",
      value: purchaseUnreceivedCount,
      format: "number",
      lines: [
        purchaseUnreceivedCount
          ? `${formatNumberValue(purchaseUnreceivedCount)} pembelian menunggu penerimaan`
          : "Tidak ada pembelian menunggu penerimaan",
      ],
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
    const key = format(startOfMonth(item.date), "yyyy-MM");
    ordersByMonth.set(key, (ordersByMonth.get(key) ?? 0) + Number(item.totalAmount ?? 0));
  });

  const invoicesByMonth = new Map<string, number>(monthKeys.map((key) => [key, 0]));
  invoiceTrendRaw.forEach((item) => {
    const key = format(startOfMonth(item.issueDate), "yyyy-MM");
    invoicesByMonth.set(key, (invoicesByMonth.get(key) ?? 0) + Number(item.total ?? 0));
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
  };
}

export const metadata: Metadata = {
  title: "Dashboard Overview | TailAdmin",
  description:
    "Ringkasan pipeline penjualan, faktur, dan status inventori untuk membantu pemantauan performa bisnis.",
};

export const revalidate = 60;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const auth = await getAuth();
  if (!auth?.userId) {
    return redirect(`/signin?redirect=/`);
  }
  const activeBrand = await getActiveBrandProfile();
  const rangeParamRaw = searchParams?.range;
  const rangeParam = Array.isArray(rangeParamRaw)
    ? String(rangeParamRaw[0])
    : String(rangeParamRaw ?? "30d");
  const rangeDays =
    rangeParam === "90d" ? 90 : rangeParam === "180d" ? 180 : 30;
  const data = await getDashboardData(activeBrand?.id ?? undefined, rangeDays);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white/90">
            Dashboard Overview
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Ringkasan penjualan, pipeline, dan kesehatan inventori perusahaan Anda.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/?range=30d`}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              rangeDays === 30
                ? "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
            }`}
          >
            30 hari
          </Link>
          <Link
            href={`/?range=90d`}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              rangeDays === 90
                ? "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
            }`}
          >
            90 hari
          </Link>
          <Link
            href={`/?range=180d`}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              rangeDays === 180
                ? "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
            }`}
          >
            180 hari
          </Link>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {data.cards.map((card) => {
          const displayValue =
            card.format === "currency"
              ? formatCurrency(card.value)
              : formatNumberValue(card.value);

          return (
            <div
              key={card.key}
              className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    <Link
                      href={
                        card.key === "customers"
                          ? `/${"client/list"}?range=${rangeDays}d`
                          : card.key === "quotations"
                          ? `/penjualan/quotation?range=${rangeDays}d&status=Confirmed`
                          : card.key === "salesOrders"
                          ? `/penjualan/order-penjualan?range=${rangeDays}d&status=Approved`
                          : card.key === "invoices"
                          ? `/penjualan/invoice-penjualan?range=${rangeDays}d&status=Sent`
                          : card.key === "pendingApproval"
                          ? `/penjualan/order-penjualan?status=Pending`
                          : card.key === "invoiceDue"
                          ? `/penjualan/invoice-penjualan?status=Sent`
                          : card.key === "orderUnshipped"
                          ? `/penjualan/order-penjualan?status=Approved`
                          : card.key === "purchaseUnreceived"
                          ? `/pembelian/pembelian-langsung?status=Draft`
                          : "/"
                      }
                      className="hover:text-blue-600 dark:hover:text-blue-300"
                    >
                      {card.title}
                    </Link>
                  </p>
                  <p className="mt-3 text-2xl font-semibold text-gray-900 dark:text-white/90">
                    {displayValue}
                  </p>
                </div>
                {typeof card.trend === "number" ? (
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${
                      card.trend >= 0
                        ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300"
                        : "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300"
                    }`}
                  >
                    {card.trend >= 0 ? "+" : ""}
                    {card.trend.toFixed(1)}%
                  </span>
                ) : null}
              </div>
              <ul className="mt-4 space-y-1 text-sm text-gray-500 dark:text-gray-400">
                {card.lines.map((line, index) => (
                  <li key={`${card.key}-line-${index}`}>{line}</li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">
                Cashflow 6 Bulan Terakhir
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Perbandingan nilai sales order dan invoice.
              </p>
            </div>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:bg-gray-800 dark:text-gray-300">
              Diperbarui {format(new Date(), "dd MMM yyyy")}
            </span>
          </div>
          <div className="mt-4">
            <TrendChart
              categories={data.trend.categories}
              series={data.trend.series}
              valueType="currency"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">
              Pipeline Status
            </h2>
            <span className="text-xs uppercase tracking-wide text-gray-400">
              Live data
            </span>
          </div>

          <div className="mt-4 space-y-5">
            {data.pipeline.map((group) => (
              <div key={group.key}>
                <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                  <span className="font-semibold text-gray-700 dark:text-white/90">
                    {group.title}
                  </span>
                  <span>{formatNumberValue(group.total)} total</span>
                </div>
                <ul className="mt-3 space-y-3">
                  {group.statuses.map((status, index) => (
                    <li key={`${group.key}-${status.status}-${index}`}>
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2 w-2 rounded-full ${getStatusColorClass(
                              status.status,
                              index,
                            )}`}
                          />
                          <span className="text-gray-700 dark:text-white/90">
                            {status.label}
                          </span>
                        </div>
                        <span className="text-gray-500 dark:text-gray-400">
                          {formatNumberValue(status.count)} •{" "}
                          {status.percentage.toFixed(1)}%
                        </span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-gray-100 dark:bg-gray-800">
                        <div
                          className={`h-2 rounded-full ${getStatusColorClass(
                            status.status,
                            index,
                          )}`}
                          style={{ width: `${status.percentage}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {data.recent.map((section) => (
          <div
            key={section.key}
            className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">
                  {section.title}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Transaksi terbaru untuk ditindaklanjuti.
                </p>
              </div>
              <Link
                href={`${section.link}?range=${rangeDays}d`}
                className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600 transition hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/20"
              >
                Lihat semua
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>

            {section.items.length ? (
              <ul className="mt-4 space-y-3">
                {section.items.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3 transition hover:border-blue-200 hover:bg-blue-50/60 dark:border-gray-800 dark:bg-white/[0.02] dark:hover:border-blue-500/40 dark:hover:bg-blue-500/5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <Link
                          href={item.link}
                          className="font-semibold text-gray-800 hover:text-blue-600 dark:text-white/90 dark:hover:text-blue-300"
                        >
                          {item.number}
                        </Link>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {item.customer}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${getStatusBadgeClass(
                          item.status,
                        )}`}
                      >
                        {getStatusLabel(item.status)}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                      <span>{format(item.date, "dd MMM yyyy")}</span>
                      <span className="font-semibold text-gray-900 dark:text-white/90">
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
                Belum ada data terbaru.
              </p>
            )}
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">
                Top Customers
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Berdasarkan total nilai invoice yang diterbitkan.
              </p>
            </div>
          </div>

          {data.topCustomers.length ? (
            <ul className="mt-4 space-y-3">
              {data.topCustomers.map((customer, index) => (
                <li
                  key={customer.id}
                  className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3 dark:border-gray-800 dark:bg-white/[0.02]"
                >
                  <div>
                    <p className="font-semibold text-gray-800 dark:text-white/90">
                      {index + 1}. {customer.name}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {formatNumberValue(customer.invoices)} faktur
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white/90">
                    {formatCurrency(customer.total)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
              Belum ada invoice yang tercatat.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">
                Inventory Snapshot
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Produk dengan stok rendah (≤ 10).
              </p>
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
              {formatNumberValue(data.inventory.totalProducts)} produk
            </span>
          </div>

          {data.inventory.lowStock.length ? (
            <ul className="mt-4 space-y-3">
              {data.inventory.lowStock.map((product) => (
                <li
                  key={product.id}
                  className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3 dark:border-gray-800"
                >
                  <div>
                    <p className="font-semibold text-gray-800 dark:text-white/90">
                      {product.name}
                    </p>
                    <p className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">
                      {product.sku}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900 dark:text-white/90">
                      {formatNumberValue(product.qty)} {product.unit}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Sisa stok
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
              Tidak ada produk dengan stok rendah.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
