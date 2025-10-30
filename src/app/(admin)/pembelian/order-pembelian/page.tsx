"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { Modal } from "@/components/ui/modal";
import {
  CalendarCheck,
  CalendarClock,
  CheckCheck,
  Download,
  Filter,
  MoreHorizontal,
  PlusCircle,
  RefreshCcw,
  Search,
  Truck,
} from "lucide-react";

type PurchaseOrderStatus =
  | "Draft"
  | "Menunggu Persetujuan"
  | "Sedang Diproses"
  | "Menunggu Pengiriman"
  | "Selesai"
  | "Dibatalkan";

type PurchaseOrder = {
  id: number;
  orderNumber: string;
  supplier: { name: string; pic: string; phone: string };
  createdAt: string;
  eta: string;
  status: PurchaseOrderStatus;
  total: number;
  internalNotes?: string;
  items: Array<{ sku: string; name: string; qty: number; unit: string; price: number }>;
};

const ORDERS: PurchaseOrder[] = [
  {
    id: 1,
    orderNumber: "PO-25007",
    supplier: { name: "PT Nusantara Chemical", pic: "Budi Santoso", phone: "+62 812-5555-111" },
    createdAt: "2025-10-12",
    eta: "2025-10-20",
    status: "Menunggu Persetujuan",
    total: 18250000,
    internalNotes: "Prioritaskan pengiriman bahan baku untuk batch produksi 03.",
    items: [
      { sku: "RM-001", name: "Resin A65", qty: 400, unit: "kg", price: 25000 },
      { sku: "RM-219", name: "Catalyst X-12", qty: 25, unit: "ltr", price: 185000 },
    ],
  },
  {
    id: 2,
    orderNumber: "PO-25006",
    supplier: { name: "CV Mega Plastik", pic: "Sinta Putri", phone: "+62 811-8009-321" },
    createdAt: "2025-10-09",
    eta: "2025-10-18",
    status: "Sedang Diproses",
    total: 9450000,
    internalNotes: "Supplier meminta DP 40% sebelum produksi.",
    items: [
      { sku: "PK-110", name: "Packaging Box 40x20", qty: 200, unit: "pcs", price: 19000 },
      { sku: "LB-009", name: "Label Anti UV", qty: 200, unit: "set", price: 4500 },
    ],
  },
  {
    id: 3,
    orderNumber: "PO-25005",
    supplier: { name: "PT Solusi Tekstil", pic: "Andi Wijaya", phone: "+62 812-9080-111" },
    createdAt: "2025-10-06",
    eta: "2025-10-14",
    status: "Menunggu Pengiriman",
    total: 12800000,
    items: [
      { sku: "TX-411", name: "Polyester Roll 120gsm", qty: 180, unit: "roll", price: 48000 },
      { sku: "TX-502", name: "Benang High Tenacity", qty: 90, unit: "cone", price: 95000 },
    ],
  },
  {
    id: 4,
    orderNumber: "PO-25004",
    supplier: { name: "PT Prima Metal", pic: "Iwan Nugroho", phone: "+62 823-600-700" },
    createdAt: "2025-10-02",
    eta: "2025-10-11",
    status: "Selesai",
    total: 22780000,
    items: [
      { sku: "MT-122", name: "Aluminium Sheet 1.2mm", qty: 160, unit: "lembar", price: 82000 },
      { sku: "MT-711", name: "Baut Stainless M6", qty: 1200, unit: "pcs", price: 750 },
    ],
  },
  {
    id: 5,
    orderNumber: "PO-25003",
    supplier: { name: "CV Global Kargo", pic: "Maria Gunawan", phone: "+62 877-1100-220" },
    createdAt: "2025-09-29",
    eta: "2025-10-08",
    status: "Draft",
    total: 5150000,
    internalNotes: "Menunggu revisi spesifikasi pallet sebelum dikirim ke supplier.",
    items: [
      { sku: "LG-440", name: "Logistik Pallet Kayu", qty: 60, unit: "pcs", price: 78000 },
      { sku: "LG-990", name: "Shrink Wrap Heavy Duty", qty: 15, unit: "roll", price: 88000 },
    ],
  },
];

const STATUS_OPTIONS: Array<{ label: string; value: PurchaseOrderStatus | "Semua" }> = [
  { label: "Semua Status", value: "Semua" },
  { label: "Draft", value: "Draft" },
  { label: "Menunggu Persetujuan", value: "Menunggu Persetujuan" },
  { label: "Sedang Diproses", value: "Sedang Diproses" },
  { label: "Menunggu Pengiriman", value: "Menunggu Pengiriman" },
  { label: "Selesai", value: "Selesai" },
  { label: "Dibatalkan", value: "Dibatalkan" },
];

const statusTheme: Record<PurchaseOrderStatus, string> = {
  Draft: "bg-gray-100 text-gray-700",
  "Menunggu Persetujuan": "bg-amber-100 text-amber-700",
  "Sedang Diproses": "bg-sky-100 text-sky-700",
  "Menunggu Pengiriman": "bg-blue-100 text-blue-700",
  Selesai: "bg-emerald-100 text-emerald-700",
  Dibatalkan: "bg-rose-100 text-rose-600",
};

const currency = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("id-ID", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));

export default function PurchaseOrderPage() {
  const [statusFilter, setStatusFilter] = useState<PurchaseOrderStatus | "Semua">("Semua");
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [deliveryWindow, setDeliveryWindow] = useState<"all" | "thisWeek" | "late">("all");

  const filteredOrders = useMemo(() => {
    const query = search.toLowerCase();
    return ORDERS.filter((order) => {
      const matchStatus = statusFilter === "Semua" || order.status === statusFilter;
      const matchDelivery =
        deliveryWindow === "all"
          ? true
          : deliveryWindow === "thisWeek"
          ? new Date(order.eta) <= addDays(new Date(), 7)
          : new Date(order.eta) < new Date();
      const matchSearch =
        !query ||
        [order.orderNumber, order.supplier.name, order.supplier.pic]
          .join(" ")
          .toLowerCase()
          .includes(query);
      return matchStatus && matchDelivery && matchSearch;
    });
  }, [search, statusFilter, deliveryWindow]);

  const metrics = useMemo(() => {
    const waitingApproval = filteredOrders.filter((x) => x.status === "Menunggu Persetujuan").length;
    const inProgress = filteredOrders.filter((x) => x.status === "Sedang Diproses").length;
    const awaitingDelivery = filteredOrders.filter((x) => x.status === "Menunggu Pengiriman").length;
    const outstandingValue = filteredOrders
      .filter((x) => x.status !== "Selesai" && x.status !== "Dibatalkan")
      .reduce((acc, item) => acc + item.total, 0);

    return {
      waitingApproval,
      inProgress,
      awaitingDelivery,
      outstandingValue,
    };
  }, [filteredOrders]);

  return (
    <div className="space-y-6 p-6">
      <PageBreadcrumb
        pageTitle="Order Pembelian"
        items={[
          { label: "Pembelian" },
          { label: "Order Pembelian", href: "/pembelian/order-pembelian" },
        ]}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<Filter className="h-5 w-5" />}
          title="Menunggu Persetujuan"
          value={metrics.waitingApproval}
          helper="PO dengan status pending approval"
        />
        <StatCard
          icon={<Truck className="h-5 w-5" />}
          title="Dalam Proses Supplier"
          value={metrics.inProgress}
          helper="PO yang sedang disiapkan supplier"
        />
        <StatCard
          icon={<CalendarClock className="h-5 w-5" />}
          title="Menunggu Pengiriman"
          value={metrics.awaitingDelivery}
          helper="PO dengan ETA minggu ini"
        />
        <StatCard
          icon={<CalendarCheck className="h-5 w-5" />}
          title="Nilai Outstanding"
          value={currency.format(metrics.outstandingValue)}
          helper="Belum diterima / belum ditagihkan"
        />
      </section>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-gray-100 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">Daftar Order Pembelian</h2>
            <p className="mt-1 text-sm text-gray-500">
              Kelola siklus pembelian: monitoring approval, pengiriman, dan nilai outstanding.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              className="flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:border-gray-300 hover:bg-gray-50"
              onClick={() => setShowAdvancedFilter((prev) => !prev)}
            >
              <Filter className="h-4 w-4" />
              Filter lanjutan
            </button>
            <button className="flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:border-gray-300 hover:bg-gray-50">
              <Download className="h-4 w-4" />
              Export
            </button>
            <Link
              href="/pembelian/order-pembelian/add"
              className="flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              <PlusCircle className="h-4 w-4" />
              Buat PO Baru
            </Link>
          </div>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Cari PO, supplier, PIC"
                  className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm text-gray-700 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value === "Semua" ? "Semua" : (event.target.value as PurchaseOrderStatus))
                }
                className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-dashed border-gray-200 px-3 py-2 text-xs text-gray-500">
              <RefreshCcw className="h-3.5 w-3.5" />
              {filteredOrders.length} order ditampilkan
            </div>
          </div>

          {showAdvancedFilter && (
            <div className="grid gap-3 rounded-2xl border border-dashed border-blue-200 bg-blue-50/40 p-4 text-sm text-blue-700 md:grid-cols-3">
              <p className="font-medium text-blue-800">Pengiriman</p>
              {(["all", "thisWeek", "late"] as const).map((variant) => (
                <button
                  key={variant}
                  onClick={() => setDeliveryWindow(variant)}
                  className={`rounded-full border px-3 py-1.5 font-medium transition ${
                    deliveryWindow === variant
                      ? "border-blue-500 bg-white text-blue-600 shadow-sm"
                      : "border-transparent hover:border-blue-200 hover:bg-blue-100/80"
                  }`}
                >
                  {variant === "all"
                    ? "Semua jadwal"
                    : variant === "thisWeek"
                    ? "ETA 7 hari ke depan"
                    : "Lewat dari ETA"}
                </button>
              ))}
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-gray-100">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">PO</th>
                  <th className="px-4 py-3 text-left font-semibold">Supplier</th>
                  <th className="px-4 py-3 text-left font-semibold">Tanggal</th>
                  <th className="px-4 py-3 text-left font-semibold">ETA</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Total</th>
                  <th className="px-4 py-3 text-left font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-sm text-gray-700">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50/60">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-800">{order.orderNumber}</div>
                      <div className="text-xs text-gray-500">#{order.id.toString().padStart(4, "0")}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{order.supplier.name}</div>
                      <div className="text-xs text-gray-500">
                        PIC: {order.supplier.pic} · {order.supplier.phone}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDate(order.createdAt)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDate(order.eta)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${statusTheme[order.status]}`}>
                        {order.status === "Selesai" ? (
                          <CheckCheck className="h-3.5 w-3.5" />
                        ) : order.status === "Menunggu Pengiriman" ? (
                          <Truck className="h-3.5 w-3.5" />
                        ) : (
                          <CalendarClock className="h-3.5 w-3.5" />
                        )}
                        {order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-800">
                      {currency.format(order.total)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-sm">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:border-blue-200 hover:bg-blue-50"
                        >
                          Lihat detail
                        </button>
                        <button className="rounded-full border border-gray-200 p-1.5 text-gray-500 transition hover:border-gray-300 hover:text-gray-700">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredOrders.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-500">
                      Tidak ada order yang cocok dengan filter saat ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm md:col-span-1 xl:col-span-2">
          <h3 className="text-base font-semibold text-gray-800">Prioritas Minggu Ini</h3>
          <div className="mt-4 space-y-4">
            {ORDERS.slice(0, 3).map((order) => (
              <div key={order.id} className="flex items-start justify-between rounded-xl border border-gray-100 p-4">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{order.orderNumber}</p>
                  <p className="text-xs text-gray-500">
                    {order.supplier.name} · ETA {formatDate(order.eta)}
                  </p>
                  {order.internalNotes && (
                    <p className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-xs leading-relaxed text-blue-700">
                      {order.internalNotes}
                    </p>
                  )}
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTheme[order.status]}`}>
                  {order.status}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-gray-800">Checklist Buyer</h3>
          <ol className="mt-4 space-y-3 text-sm text-gray-600">
            <li className="flex items-start gap-3 rounded-xl border border-dashed border-emerald-200 bg-emerald-50/60 p-3">
              <CheckCheck className="mt-0.5 h-4 w-4 text-emerald-600" />
              <div>
                <p className="font-medium text-gray-800">Approve PO dengan status pending</p>
                <p className="text-xs text-gray-500">Pastikan kuantitas dan jadwal produksi sudah valid.</p>
              </div>
            </li>
            <li className="flex items-start gap-3 rounded-xl border border-dashed border-amber-200 bg-amber-50/60 p-3">
              <CalendarClock className="mt-0.5 h-4 w-4 text-amber-600" />
              <div>
                <p className="font-medium text-gray-800">Konfirmasi jadwal pengiriman supplier</p>
                <p className="text-xs text-gray-500">Hubungi supplier yang ETA-nya minggu ini untuk memastikan slot gudang.</p>
              </div>
            </li>
            <li className="flex items-start gap-3 rounded-xl border border-dashed border-sky-200 bg-sky-50/60 p-3">
              <Truck className="mt-0.5 h-4 w-4 text-sky-600" />
              <div>
                <p className="font-medium text-gray-800">Update status penerimaan barang</p>
                <p className="text-xs text-gray-500">
                  Segera input GR ketika barang diterima agar stok dan akuntansi sinkron.
                </p>
              </div>
            </li>
          </ol>
        </div>
      </div>

      <Modal isOpen={!!selectedOrder} onClose={() => setSelectedOrder(null)} className="w-[95vw] max-w-3xl">
        {selectedOrder && (
          <div className="px-6 pt-8 pb-6">
            <div className="flex flex-col gap-4 border-b border-gray-100 pb-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600">
                  Purchase Order
                  <span className="font-semibold text-gray-800">{selectedOrder.orderNumber}</span>
                </div>
                <h3 className="mt-3 text-2xl font-semibold text-gray-900">Ringkasan Order</h3>
                <p className="text-sm text-gray-500">
                  Dibuat {formatDate(selectedOrder.createdAt)} · ETA {formatDate(selectedOrder.eta)}
                </p>
              </div>
              <span className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold ${statusTheme[selectedOrder.status]}`}>
                <Truck className="h-4 w-4" />
                {selectedOrder.status}
              </span>
            </div>

            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <div className="space-y-3 rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Supplier</p>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{selectedOrder.supplier.name}</p>
                  <p className="text-sm text-gray-600">
                    {selectedOrder.supplier.pic} · {selectedOrder.supplier.phone}
                  </p>
                </div>
                <div className="text-xs text-gray-500">
                  Catatan internal:{" "}
                  <span className="font-medium text-gray-700">
                    {selectedOrder.internalNotes || "Tidak ada catatan"}
                  </span>
                </div>
              </div>
              <div className="space-y-3 rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Nilai Transaksi</p>
                <p className="text-2xl font-semibold text-gray-900">{currency.format(selectedOrder.total)}</p>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <CalendarCheck className="h-4 w-4 text-blue-500" />
                  ETA pengiriman {formatDate(selectedOrder.eta)}
                </div>
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border border-gray-100">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">SKU</th>
                    <th className="px-4 py-3 text-left font-semibold">Deskripsi Item</th>
                    <th className="px-4 py-3 text-right font-semibold">Qty</th>
                    <th className="px-4 py-3 text-right font-semibold">Harga</th>
                    <th className="px-4 py-3 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {selectedOrder.items.map((item) => (
                    <tr key={item.sku}>
                      <td className="px-4 py-3 font-mono text-xs">{item.sku}</td>
                      <td className="px-4 py-3 font-medium">{item.name}</td>
                      <td className="px-4 py-3 text-right text-sm">
                        {item.qty} {item.unit}
                      </td>
                      <td className="px-4 py-3 text-right text-sm">{currency.format(item.price)}</td>
                      <td className="px-4 py-3 text-right font-medium">
                        {currency.format(item.price * item.qty)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Download className="h-4 w-4" />
                Draft PDF PO siap dikirim ke supplier.
              </div>
              <div className="flex gap-2">
                <button className="rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:border-blue-200 hover:bg-blue-50">
                  Kirim ke Supplier
                </button>
                <button className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700">
                  Buat Penerimaan Barang
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function addDays(date: Date, days: number) {
  const clone = new Date(date);
  clone.setDate(clone.getDate() + days);
  return clone;
}

type StatCardProps = {
  icon: ReactNode;
  title: string;
  value: string | number;
  helper: string;
};

function StatCard({ icon, title, value, helper }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          {icon}
        </div>
        <CheckCheck className="h-4 w-4 text-gray-300" />
      </div>
      <p className="mt-5 text-sm font-medium text-gray-500">{title}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
      <p className="mt-3 text-xs text-gray-400">{helper}</p>
    </div>
  );
}
