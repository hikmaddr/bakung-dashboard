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
import { StatusBadge } from "@/components/ui/StatusBadge";

type PurchaseOrderStatus =
  | "Draft"
  | "PendingApproval"
  | "Ordered"
  | "Processing"
  | "Shipping"
  | "Received"
  | "Completed"
  | "Canceled";

import { useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { useSearchParams, useRouter } from "next/navigation";

// Real types from Prisma
type PurchaseOrder = {
  id: number;
  orderNumber: string;
  supplierName: string;
  date: string;
  status: string;
  totalAmount: number;
  notes?: string;
  items: Array<{ product: string; quantity: number; unit: string; price: number; subtotal: number; description?: string }>;
  brand?: { name: string };
};

const STATUS_OPTIONS = [
  { label: "Semua Status", value: "Semua" },
  { label: "Draft", value: "Draft" },
  { label: "Ordered", value: "Ordered" },
  { label: "Received", value: "Received" },
  { label: "Canceled", value: "Canceled" },
];

const currency = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const formatDate = (value: string | Date) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
};

export default function PurchaseOrderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "Semua");
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "Semua") params.set("status", statusFilter);
      if (search) params.set("q", search);
      
      const res = await fetch(`/api/purchases/orders?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setOrders(json.data);
      } else {
        toast.error(json.message || "Gagal memuat data");
      }
    } catch (err) {
      toast.error("Terjadi kesalahan saat memuat data");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const metrics = useMemo(() => {
    const draftCount = orders.filter((x) => x.status === "Draft").length;
    const orderedCount = orders.filter((x) => x.status === "Ordered").length;
    const receivedCount = orders.filter((x) => x.status === "Received").length;
    const outstandingValue = orders
      .filter((x) => x.status !== "Received" && x.status !== "Canceled")
      .reduce((acc, item) => acc + item.totalAmount, 0);

    return {
      draftCount,
      orderedCount,
      receivedCount,
      outstandingValue,
    };
  }, [orders]);


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
          title="Status Draft"
          value={metrics.draftCount}
          helper="PO yang belum dikirim ke supplier"
        />
        <StatCard
          icon={<Truck className="h-5 w-5" />}
          title="Status Ordered"
          value={metrics.orderedCount}
          helper="PO yang sudah dikirim ke supplier"
        />
        <StatCard
          icon={<CalendarCheck className="h-5 w-5" />}
          title="Status Received"
          value={metrics.receivedCount}
          helper="PO yang sudah diterima"
        />
        <StatCard
          icon={<CalendarClock className="h-5 w-5" />}
          title="Nilai Outstanding"
          value={currency.format(metrics.outstandingValue)}
          helper="Total PO yang belum selesai"
        />
      </section>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-gray-100 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">Daftar Order Pembelian</h2>
            <p className="mt-1 text-sm text-gray-500">
              Kelola siklus pembelian: monitoring status, pengiriman, dan nilai outstanding.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
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
                  placeholder="Cari No. PO, Supplier..."
                  className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm text-gray-700 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
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
              <RefreshCcw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              {orders.length} order ditampilkan
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-100">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">PO</th>
                  <th className="px-4 py-3 text-left font-semibold">Supplier</th>
                  <th className="px-4 py-3 text-left font-semibold">Tanggal</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Total</th>
                  <th className="px-4 py-3 text-left font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-sm text-gray-700">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50/60">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-800">{order.orderNumber}</div>
                      <div className="text-xs text-gray-500">#{order.id}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{order.supplierName}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDate(order.date)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-800">
                      {currency.format(order.totalAmount)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-sm">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:border-blue-200 hover:bg-blue-50"
                        >
                          Lihat detail
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-500">
                      Belum ada Purchase Order.
                    </td>
                  </tr>
                )}
                {loading && (
                   <tr>
                   <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-500">
                     Memuat data...
                   </td>
                 </tr>
                )}
              </tbody>
            </table>
          </div>
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
                  Dibuat {formatDate(selectedOrder.date)}
                </p>
              </div>
              <StatusBadge status={selectedOrder.status} />
            </div>

            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <div className="space-y-3 rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Supplier</p>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{selectedOrder.supplierName}</p>
                </div>
                <div className="text-xs text-gray-500">
                  Catatan:{" "}
                  <span className="font-medium text-gray-700">
                    {selectedOrder.notes || "Tidak ada catatan"}
                  </span>
                </div>
              </div>
              <div className="space-y-3 rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Nilai Transaksi</p>
                <p className="text-2xl font-semibold text-gray-900">{currency.format(selectedOrder.totalAmount)}</p>
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border border-gray-100">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Produk</th>
                    <th className="px-4 py-3 text-right font-semibold">Qty</th>
                    <th className="px-4 py-3 text-right font-semibold">Harga</th>
                    <th className="px-4 py-3 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {selectedOrder.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-3 font-medium">{item.product}</td>
                      <td className="px-4 py-3 text-right text-sm">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="px-4 py-3 text-right text-sm">{currency.format(item.price)}</td>
                      <td className="px-4 py-3 text-right font-medium">
                        {currency.format(item.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-end">
              <div className="flex gap-2">
                <button 
                  onClick={() => setSelectedOrder(null)}
                  className="rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:border-blue-200 hover:bg-blue-50">
                  Tutup
                </button>
                {selectedOrder.status === "Ordered" && (
                   <button className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700">
                    Buat Invoice Pembelian
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
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
