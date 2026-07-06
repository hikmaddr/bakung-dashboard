"use client";

import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import Skeleton from "@/components/ui/skeleton";
import Pagination from "@/components/tables/Pagination";
import { useEffect, useState, useRef, useMemo } from "react"; 
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import {
  PlusCircle,
  ChevronDown,
  Eye,
  Edit,
  Trash2,
  Download,
} from "lucide-react";
import { downloadCSV, downloadXLSX } from "@/lib/exporters";
import FeatureGuard from "@/components/FeatureGuard";
import { formatDownloadFileName } from "@/utils/downloadFilename";
import { ModalConfirmation } from "@/components/ui/ModalConfirmation";
import { StatusBadge, getInvoiceStatusLabel } from "@/components/ui/StatusBadge";
import EmptyState from "@/components/EmptyState";
import { Search } from "lucide-react";

// ================== TYPES ==================
interface SalesOrder {
  id: number;
  orderNumber: string;
  status: any;
  paymentStatus: any;
  customer: {
    pic: string;
    company: string;
    phone?: string;
  };
  date: string;
  totalAmount: number;
  quotationNumber?: string;
}


// ================== PAGE ==================
export default function SalesOrderListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const page = Number(searchParams?.get("page") || "1");
  const limit = Number(searchParams?.get("limit") || "10");
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);

  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null);
  const [sendMethod, setSendMethod] = useState<"wa" | "email" | "pdf">("email");
  const [showExport, setShowExport] = useState(false);
  const rangeParam = (searchParams?.get("range") || "").trim();
  const statusParam = (searchParams?.get("status") || "").trim();
  const activeFiltersLabel = useMemo(() => {
    const parts: string[] = [];
    if (statusParam) parts.push(`Status=${statusParam}`);
    if (rangeParam) parts.push(`Range=${rangeParam}`);
    return parts.join(" • ");
  }, [rangeParam, statusParam]);

  // 🟡 Fetch Orders
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const range = (searchParams?.get("range") || "").trim();
        const status = (searchParams?.get("status") || "").trim();
        const qs = new URLSearchParams();
        if (range) qs.set("range", range);
        if (status) qs.set("status", status);
        qs.set("page", page.toString());
        qs.set("limit", limit.toString());
        const url = `/api/sales-orders?${qs.toString()}`;
        const res = await fetch(url, { cache: "no-store" });
        const data = await res.json();
        
        const ordersData = data.success ? data.data : data;
        if (data.pagination) {
          setTotal(data.pagination.total);
          setTotalPages(data.pagination.totalPages);
        }

        const mapped: SalesOrder[] = ordersData.map((item: any) => {
          const normalizedStatus = (() => {
            const s = (item.status || "").toString();
            if (!s || s === "Draft") return "Confirmed";
            return s;
          })();

          return {
            ...item,
            status: normalizedStatus,
            totalAmount: item.totalAmount ?? 0,
            customer:
              typeof item.customer === "object"
                ? item.customer
                : { pic: item.customer_pic ?? "Tidak diketahui", company: item.customer ?? "Tidak diketahui" },
            date: item.date || item.createdAt,
            quotationNumber: item?.quotation?.quotationNumber ?? undefined,
          };
        });
        setOrders(mapped);
      } catch (e) {
        console.error("Gagal mengambil data sales order:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, [router, searchParams, refreshKey]);

  // Refetch saat daftar brand berubah
  useEffect(() => {
    const handler = () => setRefreshKey((k) => k + 1);
    window.addEventListener("brand-list:updated", handler);
    return () => window.removeEventListener("brand-list:updated", handler);
  }, []);

  // Refetch saat brand aktif berganti
  useEffect(() => {
    const handler = () => setRefreshKey((k) => k + 1);
    window.addEventListener("brand-modules:updated", handler);
    return () => window.removeEventListener("brand-modules:updated", handler);
  }, []);

  // 🔍 Filter + Pagination
  const filtered = useMemo(
    () => {
      const lower = searchTerm.toLowerCase();
      // Server-side filtering is preferred but for now we filter what's loaded
      // Since we use pagination, we should probably add search to the API too
      return orders.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(lower) ||
          o.customer.company.toLowerCase().includes(lower) ||
          o.customer.pic.toLowerCase().includes(lower) ||
          o.status.toLowerCase().includes(lower) ||
          (o.quotationNumber ? o.quotationNumber.toLowerCase().includes(lower) : false)
      );
    },
    [orders, searchTerm]
  );

  // If we have server-side pagination, 'orders' IS the paginated list
  const displayOrders = searchTerm ? filtered : orders;



  // 🟥 Delete
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const handleDelete = (id: number) => {
    setConfirmDeleteId(id);
    setDeleteModalOpen(true);
  };


  // 🧾 Generate PDF (Dipertahankan)
  const generatePDF = async (order: SalesOrder) => {
    try {
      const res = await fetch(`/api/sales-orders/${order.id}/pdf`);
      if (!res.ok) throw new Error('Gagal mengambil PDF');
      const blob = await res.blob();
      const fileName = formatDownloadFileName(
        order.orderNumber,
        order.customer?.pic || order.customer?.company,
        `SO-${order.id}`,
        order.customer?.pic || order.customer?.company || "Customer"
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error((e as any)?.message || 'Gagal menyimpan PDF');
    }
  };

  // 🟦 Kirim
  const handleSend = async (id: number, method: "wa" | "email" | "pdf") => {
    try {
      const orderToSend = orders.find(o => o.id === id);
      if (!orderToSend) return;

      // 1. Ubah status di database (Gunakan status yang valid sesuai Enum)
      const statusValue = "Confirmed"; 
      const res = await fetch(`/api/sales-orders/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: statusValue }),
      });
      if (!res.ok) throw new Error();

      // 2. Update state di frontend
      setOrders((prev) =>
        prev.map((o) => (o.id === id ? { ...o, status: statusValue } : o))
      );

      // 3. Aksi pengiriman
      if (method === "pdf") {
        await generatePDF(orderToSend);
        toast.success("PDF disimpan & status: Sent via PDF");
      } else if (method === "wa") {
        const win = typeof window !== 'undefined' ? window.open('about:blank') : null;
        try {
          const resUpload = await fetch(`/api/share/drive-upload`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "sales-order", id }),
          });
          const data = await resUpload.json();
          if (!data?.success) throw new Error();
          const link = data.shortUrl || data.url || data.webViewLink || data.webContentLink || (data.fileId ? `https://drive.google.com/file/d/${data.fileId}/view` : "");
          const phone = (orderToSend.customer?.phone || "").replace(/^0/, "62");
          const msg = encodeURIComponent(
            `Hi ${orderToSend.customer?.pic || "Customer"},\nAnda telah menerima Sales Order ${orderToSend.orderNumber}.\nTotal: Rp ${orderToSend.totalAmount.toLocaleString("id-ID")}\n\nLink dokumen: ${link}`
          );
          const waUrl = phone ? `https://wa.me/${phone}?text=${msg}` : `https://wa.me/?text=${msg}`;
          if (win) win.location.href = waUrl; else window.location.href = waUrl;
          toast.success("Sales Order dikirim via WhatsApp & status: Sent via WhatsApp");
        } catch {
          const phone = (orderToSend.customer?.phone || "").replace(/^0/, "62");
          const msg = encodeURIComponent(
            `Hi ${orderToSend.customer?.pic || "Customer"},\nSales Order ${orderToSend.orderNumber}.\nTotal: Rp ${orderToSend.totalAmount.toLocaleString("id-ID")}\n\nLink dokumen tidak tersedia. Silakan hubungi kami.`
          );
          const waUrl = phone ? `https://wa.me/${phone}?text=${msg}` : `https://wa.me/?text=${msg}`;
          if (win) win.location.href = waUrl; else window.location.href = waUrl;
          toast.error("Gagal membuat link dokumen, tetap membuka WhatsApp");
        }
      } else {
        toast.success("Sales Order dikirim via Email & status: Sent via Email");
      }
    } catch (e) {
      console.error(e);
      toast.error("Gagal mengirim Sales Order");
    } finally {
      setSendModalOpen(false);
      setSelectedOrder(null);
      setSendMethod("email");
    }
  };

  // Modal Konfirmasi Hapus
  const DeleteConfirmationModal = (
    <ModalConfirmation
      isOpen={deleteModalOpen}
      onClose={() => { setDeleteModalOpen(false); setConfirmDeleteId(null); }}
      title="Hapus Sales Order ini?"
      description="Tindakan ini akan menghapus Sales Order dari daftar."
      confirmLabel="Hapus"
      destructive
      loading={deleteLoading}
      onConfirm={async () => {
        if (confirmDeleteId == null) return;
        setDeleteLoading(true);
        try {
          const res = await fetch(`/api/sales-orders/${confirmDeleteId}`, { method: "DELETE" });
          if (!res.ok) throw new Error();
          setOrders((prev) => prev.filter((o) => o.id !== confirmDeleteId));
          toast.success("Sales Order berhasil dihapus");
        } catch (e) {
          toast.error("Gagal menghapus Sales Order");
        } finally {
          setDeleteLoading(false);
          setDeleteModalOpen(false);
          setConfirmDeleteId(null);
        }
      }}
    />
  );

  // 🟢 Status Dropdown
  const handleStatusChange = async (id: number, nextStatus: string) => {
    try {
      const res = await fetch(`/api/sales-orders/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error();

      setOrders((prev) =>
        prev.map((o) => (o.id === id ? { ...o, status: nextStatus } : o))
      );
      toast.success(`Status berhasil diubah menjadi ${nextStatus}`);
    } catch (e) {
      toast.error("Gagal mengubah status");
    }
  };

  if (loading)
    return (
      <FeatureGuard feature="sales.order">
        <div className="p-6 min-h-screen">
          <PageBreadcrumb
            pageTitle="Order Penjualan"
            items={[
              { label: "Penjualan", href: "/penjualan" },
              { label: "Order Penjualan", href: "/penjualan/order-penjualan" },
            ]}
          />
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm mt-4 dark:border-gray-800 dark:bg-gray-900">
            {/* Toolbar skeleton */}
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Skeleton className="h-11 w-full sm:w-64 rounded-lg" />
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-40 rounded-full" />
                <Skeleton className="h-9 w-40 rounded-full" />
              </div>
            </div>

            {/* Table skeleton */}
            <div className="overflow-x-auto overflow-y-visible rounded-lg border bg-white shadow-sm min-h-[50vh] dark:border-gray-800 dark:bg-gray-900">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-white/5 dark:text-white/80">
                  <tr>
                    <th className="px-4 py-3 text-left">Customer</th>
                    <th className="px-4 py-3 text-left">No. Order</th>
                    <th className="px-4 py-3 text-left">Tanggal</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-right">Tindakan</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-4 py-3"><Skeleton className="h-4 w-48" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
                      <td className="px-4 py-3 text-right"><Skeleton className="ml-auto h-4 w-24" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-5 w-20 rounded-full" /></td>
                      <td className="px-4 py-3 text-right"><Skeleton className="ml-auto h-4 w-24" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </FeatureGuard>
    );

  return (
    <FeatureGuard feature="sales.order">
    <div className="sales-scope p-6 min-h-screen">
      <PageBreadcrumb
        pageTitle="Order Penjualan"
        items={[
          { label: "Penjualan", href: "/penjualan" },
          { label: "Order Penjualan", href: "/penjualan/order-penjualan" },
        ]}
      />

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-4 border-b border-gray-100 px-6 py-5 lg:flex-row lg:items-center lg:justify-between dark:border-gray-800">
          <div>
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Daftar Sales Order</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Kelola pesanan penjualan Anda, dari draft hingga pengiriman.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <button
                onClick={() => setShowExport((v) => !v)}
                className="flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
              >
                <Download className="h-4 w-4" />
                Unduh & Bagikan
                <ChevronDown className="h-4 w-4" />
              </button>
              {showExport && (
                <div className="absolute right-0 mt-2 w-52 bg-white shadow-lg rounded-xl border border-gray-100 z-50 dark:bg-gray-900 dark:border-gray-800">
                  <ul className="py-2 text-sm text-gray-700 dark:text-gray-300">
                    <li
                      className="px-4 py-2 hover:bg-gray-100 cursor-pointer dark:hover:bg-white/5"
                      onClick={() => {
                        const rows = filtered.map((o) => ({
                          orderNumber: o.orderNumber,
                          customer: `${o.customer.pic} - ${o.customer.company}`,
                          date: o.date,
                          totalAmount: o.totalAmount,
                          status: o.status,
                        }));
                        if (rows.length === 0) {
                          toast.error("Tidak ada data untuk diekspor");
                          return;
                        }
                        downloadCSV(rows, "sales-orders.csv");
                        setShowExport(false);
                      }}
                    >
                      Ekspor data CSV
                    </li>
                    <li
                      className="px-4 py-2 hover:bg-gray-100 cursor-pointer dark:hover:bg-white/5"
                      onClick={async () => {
                        const rows = filtered.map((o) => ({
                          orderNumber: o.orderNumber,
                          customer: `${o.customer.pic} - ${o.customer.company}`,
                          date: o.date,
                          totalAmount: o.totalAmount,
                          status: o.status,
                        }));
                        if (rows.length === 0) {
                          toast.error("Tidak ada data untuk diekspor");
                          return;
                        }
                        await downloadXLSX(rows, "sales-orders.xlsx", "SalesOrders");
                        setShowExport(false);
                      }}
                    >
                      Ekspor data XLSX
                    </li>
                  </ul>
                </div>
              )}
            </div>
            <Link
              href="/penjualan/order-penjualan/add"
              className="flex items-center rounded-full bg-blue-600 px-4 py-2 text-white shadow-sm transition hover:bg-blue-700"
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Buat Sales Order Baru
            </Link>
          </div>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Cari pelanggan / nomor order..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                  }}
                  className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm text-gray-700 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:placeholder:text-gray-500 dark:focus:border-blue-500"
                />
              </div>
            </div>
            {activeFiltersLabel ? (
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                Aktif: {activeFiltersLabel}
              </span>
            ) : null}
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800">
            {displayOrders.length === 0 ? (
              <EmptyState
                title="Belum ada data sales order"
                description="Buat sales order untuk mulai mencatat pesanan dari pelanggan Anda."
              />
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-700 dark:bg-white/5 dark:text-white/80">
                  <tr>
                    <th className="px-4 py-3 text-left">Customer</th>
                    <th className="px-4 py-3 text-left">No. Order</th>
                    <th className="px-4 py-3 text-left">Tanggal</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-right">Tindakan</th>
                  </tr>
                </thead>
                <tbody>
                  {displayOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="border-t hover:bg-gray-50 transition dark:border-gray-800 dark:hover:bg-white/5"
                    >
                      <td className="px-4 py-3 text-gray-800 dark:text-gray-200">
                        {order.customer.pic} - {order.customer.company}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800 dark:text-gray-200">{order.orderNumber}</div>
                        {order.quotationNumber && (
                          <div className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                            Ref Quotation: <span className="font-medium">{order.quotationNumber}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {new Date(order.date).toLocaleDateString("id-ID")}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">
                        Rp {order.totalAmount.toLocaleString("id-ID")}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={getInvoiceStatusLabel({ status: order.status, paymentStatus: order.paymentStatus })} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-2">
                          <Link
                            href={`/penjualan/order-penjualan/${order.id}`}
                            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/5"
                          >
                            <Eye className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                          </Link>
                          <Link
                            href={`/penjualan/order-penjualan/edit/${order.id}?from=list`}
                            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/5"
                          >
                            <Edit className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                          </Link>
                          <button
                            onClick={() => generatePDF(order)}
                            title="Download PDF"
                            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/5"
                          >
                            <Download className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          </button>
                          <button
                            onClick={() => handleDelete(order.id)}
                            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/5"
                          >
                            <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={(p) => {
                const params = new URLSearchParams(searchParams?.toString());
                params.set("page", p.toString());
                router.push(`?${params.toString()}`);
              }}
              limit={limit}
              onLimitChange={(l) => {
                const params = new URLSearchParams(searchParams?.toString());
                params.set("limit", l.toString());
                params.set("page", "1");
                router.push(`?${params.toString()}`);
              }}
            />
          </div>

      {sendModalOpen && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden dark:bg-gray-900 dark:text-white">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-lg font-semibold">Kirim Sales Order</h2>
              <button
                onClick={() => {
                  setSendModalOpen(false);
                  setSendMethod("email");
                }}
                className="text-gray-400 hover:text-gray-600 text-xl dark:text-gray-300 dark:hover:text-gray-200"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x">
              <div className="p-6 space-y-3">
                <p className="font-medium text-gray-800 mb-2">Pilih metode</p>

                <label
                  onClick={() => setSendMethod("wa")}
                  className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition ${
                    sendMethod === "wa"
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" />
                  <span>WhatsApp</span>
                </label>

                <label
                  onClick={() => setSendMethod("email")}
                  className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition ${
                    sendMethod === "email"
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" />
                  <span>Email</span>
                </label>

                <label
                  onClick={() => setSendMethod("pdf")}
                  className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition ${
                    sendMethod === "pdf"
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-gray-500" />
                  <span>Simpan sebagai PDF</span>
                </label>
              </div>

              <div className="p-6">
                <p className="font-medium text-gray-800 mb-2">Preview Pesan</p>
                <textarea
                  className="w-full h-56 resize-none rounded-lg border border-gray-300 p-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  readOnly
                  value={
                    `Hi ${selectedOrder.customer.pic},\n` +
                    `Anda telah menerima Sales Order:\n` +
                    `No: ${selectedOrder.orderNumber}\n` +
                    `Tanggal: ${new Date(
                      selectedOrder.date
                    ).toLocaleDateString("id-ID")}\n` +
                    `Total: ${selectedOrder.totalAmount.toLocaleString(
                      "id-ID",
                      { style: "currency", currency: "IDR" }
                    )}\n\n` +
                    `Untuk info lebih lanjut hubungi kami.\nTerima kasih.`
                  }
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t px-6 py-4">
              <button
                onClick={() => {
                  setSendModalOpen(false);
                  setSendMethod("email");
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Batal
              </button>
              <button
                onClick={() => handleSend(selectedOrder.id, sendMethod)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                {sendMethod === "wa"
                  ? "Kirim via WhatsApp"
                  : sendMethod === "email"
                  ? "Kirim via Email"
                  : "Simpan PDF"}
              </button>
            </div>
          </div>
        </div>
      )}
      {DeleteConfirmationModal}
    </div>
    </FeatureGuard>
  );
}
