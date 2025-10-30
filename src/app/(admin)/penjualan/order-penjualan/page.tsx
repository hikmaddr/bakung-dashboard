"use client";

import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import Pagination from "@/components/tables/Pagination";
import { useEffect, useState, useRef, useMemo } from "react"; 
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";
import {
  PlusCircle,
  ChevronDown,
  Eye,
  Edit,
  Copy,
  Trash2,
  Paperclip,
  Download,
} from "lucide-react";
import { PDFDocument, rgb } from "pdf-lib";
import { downloadCSV, downloadXLSX } from "@/lib/exporters";
import FeatureGuard from "@/components/FeatureGuard";

// ================== TYPES ==================
interface SalesOrder {
  id: number;
  orderNumber: string;
  status: string;
  customer: {
    pic: string;
    company: string;
  };
  date: string;
  totalAmount: number;
  quotationNumber?: string;
}

// Opsi Status
const STATUS_OPTIONS = ["Approved", "Declined"] as const;

// ================== HELPER: GET STATUS COLOR ==================
const getStatusColor = (status: string) => {
  switch (status) {
    case "Confirmed":
      return "bg-green-100 text-green-700";
    case "Sent":
      return "bg-blue-100 text-blue-700";
    case "Approved":
      return "bg-yellow-100 text-yellow-800";
    case "Declined":
      return "bg-red-100 text-red-700";
    case "Draft":
      return "bg-gray-100 text-gray-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
};

// ================== KOMPONEN STATUS DROPDOWN ==================
function StatusDropdown({
  order,
  handleStatusChange,
  options,
  getStatusColor,
}: {
  order: SalesOrder;
  handleStatusChange: (id: number, nextStatus: string) => void;
  options: (typeof STATUS_OPTIONS[number])[];
  getStatusColor: (status: string) => string;
}) {
    const [openStatus, setOpenStatus] = useState(false);
    const statusRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (statusRef.current && !statusRef.current.contains(e.target as Node)) {
                setOpenStatus(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    return (
      <div className="relative inline-block" ref={statusRef}>
        <button
          onClick={() => setOpenStatus((v) => !v)}
          className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(order.status)}`}
        >
          {order.status}
          <ChevronDown className="h-3 w-3" />
        </button>

        {openStatus && (
          <div className="absolute mt-1 w-36 rounded-lg border bg-white shadow-lg z-50">
            {options.map((opt) => (
              <button
                key={opt}
                onClick={() => {
                  handleStatusChange(order.id, opt);
                  setOpenStatus(false);
                }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-100"
              >
                {opt}
              </button>
            ))}
          </div>
        )}
      </div>
    );
}

// ================== PAGE ==================
export default function SalesOrderListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

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
        const url = qs.toString() ? `/api/sales-orders?${qs.toString()}` : "/api/sales-orders";
        const res = await fetch(url, { cache: "no-store" });
        const data = await res.json();
        
        const ordersData = data.success ? data.data : data;

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
  }, [router, searchParams]);

  // 🔍 Filter + Pagination
  const filtered = useMemo(
    () => {
      const lower = searchTerm.toLowerCase();
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

  const totalPages = Math.ceil(filtered.length / limit);
  const paginatedOrders = filtered.slice((page - 1) * limit, page * limit);


  // 🟥 Delete
  const handleDelete = async (id: number) => {
    if (!confirm("Yakin ingin menghapus Sales Order ini?")) return;
    try {
      const res = await fetch(`/api/sales-orders/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      
      setOrders(orders.filter((o) => o.id !== id));
      toast.success("Sales Order berhasil dihapus");
    } catch (e) {
      toast.error("Gagal menghapus Sales Order");
    }
  };


  // 🧾 Generate PDF (Dipertahankan)
  const generatePDF = async (order: SalesOrder) => {
    try {
      const res = await fetch(`/api/sales-orders/${order.id}/pdf`);
      if (!res.ok) throw new Error('Gagal mengambil PDF');
      const blob = await res.blob();
      const safePicName = order.customer.pic.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9-_]/g, "");
      const fileName = `${order.orderNumber} - ${safePicName}.pdf`;
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

      // 1. Ubah status di database
      const res = await fetch(`/api/sales-orders/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Sent" }),
      });
      if (!res.ok) throw new Error();

      // 2. Update state di frontend
      setOrders((prev) =>
        prev.map((o) => (o.id === id ? { ...o, status: "Sent" } : o))
      );

      // 3. Aksi pengiriman
      if (method === "pdf") {
        await generatePDF(orderToSend);
        toast.success("PDF disimpan & status diubah ke Sent");
      } else {
        toast.success(
          `Sales Order dikirim via ${
            method === "wa" ? "WhatsApp" : "Email"
          } (dummy) & status diubah ke Sent`
        );
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
          <LoadingSpinner label="Memuat data Sales Order..." />
        </div>
      </FeatureGuard>
    );

  return (
    <FeatureGuard feature="sales.order">
    <div className="sales-scope p-6 min-h-screen">
      {/* Breadcrumb yang diperbaiki */}
      <PageBreadcrumb
        pageTitle="Order Penjualan"
        items={[
          { label: "Penjualan", href: "/penjualan" },
          { label: "Order Penjualan", href: "/penjualan/order-penjualan" },
        ]}
      />

      {/* Kontainer Card Box */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] min-h-[70vh] overflow-visible flex flex-col gap-4">

        {/* Toolbar atas */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            type="text"
            placeholder="Cari pelanggan / nomor order..."
            value={searchTerm}
            onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1); 
            }}
            className="dark:bg-dark-900 shadow-theme-xs focus:border-brand-300 focus:ring-brand-500/10 dark:focus:border-brand-800 h-11 w-full sm:w-64 rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:ring-3 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30"
          />

          <div className="flex items-center gap-3">
            {activeFiltersLabel ? (
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                Aktif: {activeFiltersLabel}
              </span>
            ) : null}
            <div className="relative">
              <button
                onClick={() => setShowExport((v) => !v)}
                className="border px-4 py-2 rounded-md flex items-center gap-2 hover:bg-gray-50"
              >
                <Download className="h-4 w-4" />
                Unduh & Bagikan
                <ChevronDown className="h-4 w-4" />
              </button>
              {showExport && (
                <div className="absolute right-0 mt-2 w-52 bg-white shadow-lg rounded-md border z-10">
                  <ul className="py-2 text-sm text-gray-700">
                    <li
                      className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
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
                      className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
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

        {/* Tabel Sales Order */}
        {paginatedOrders.length === 0 && filtered.length > 0 ? (
           <div className="py-20 text-center text-gray-600">
                Data tidak ditemukan pada halaman ini.
           </div>
        ) : paginatedOrders.length === 0 ? (
          // Jika kosong
          <div className="mt-20 flex flex-col items-center justify-center text-center text-gray-600">
             <img src="/empty-state.svg" alt="Empty State" className="mb-4 w-64 opacity-90" />
             <p className="text-lg font-medium">Belum ada data yang ditampilkan</p>
             <p className="mt-2 max-w-md text-sm">
                 Buat sales order yang dapat Anda akses dari semua perangkat Anda.
             </p>
             <Link
                 href="/penjualan/order-penjualan/add"
                 className="mt-4 inline-flex items-center rounded-full bg-blue-600 px-4 py-2 text-white shadow-sm transition hover:bg-blue-700"
             >
                 <PlusCircle className="mr-2 h-4 w-4" />
                 <span>Buat Sales Order Baru</span>
             </Link>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto overflow-y-visible rounded-lg border bg-white shadow-sm min-h-[50vh] flex-1">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-700">
                  <tr>
                    {/* TUKAR POSISI: Customer dulu, baru No. Order */}
                    <th className="px-4 py-3 text-left">Customer</th>
                    <th className="px-4 py-3 text-left">No. Order</th>
                    
                    <th className="px-4 py-3 text-left">Tanggal</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-right">Tindakan</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="border-t hover:bg-gray-50 transition"
                    >
                      {/* TUKAR POSISI: Customer dulu, baru No. Order */}
                      <td className="px-4 py-3">
                        {order.customer.pic} - {order.customer.company}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{order.orderNumber}</div>
                        {order.quotationNumber && (
                          <div className="mt-0.5 text-[11px] text-gray-500">
                            Ref Quotation: <span className="font-medium">{order.quotationNumber}</span>
                          </div>
                        )}
                      </td>
                      
                      <td className="px-4 py-3">
                        {new Date(order.date).toLocaleDateString("id-ID")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        Rp {order.totalAmount.toLocaleString("id-ID")}
                      </td>

                      {/* Status Dropdown */}
                      <td className="px-4 py-3">
                        <StatusDropdown 
                            order={order} 
                            handleStatusChange={handleStatusChange} 
                            options={[...STATUS_OPTIONS]}
                            getStatusColor={getStatusColor}
                        />
                      </td>

                      {/* Tindakan */}
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-2">
                          <Link
                            href={`/penjualan/order-penjualan/${order.id}`}
                            className="p-2 rounded-full hover:bg-gray-100"
                          >
                            <Eye className="h-4 w-4 text-gray-600" />
                          </Link>
                          <Link
                            href={`/penjualan/order-penjualan/edit/${order.id}?from=list`}
                            className="p-2 rounded-full hover:bg-gray-100"
                          >
                            <Edit className="h-4 w-4 text-gray-600" />
                          </Link>
                          <button
                            onClick={() => generatePDF(order)}
                            title="Download PDF"
                            className="p-2 rounded-full hover:bg-gray-100"
                          >
                            <Download className="h-4 w-4 text-emerald-600" />
                          </button>
                          <button
                            onClick={() => handleDelete(order.id)}
                            className="p-2 rounded-full hover:bg-gray-100"
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              limit={limit}
              onLimitChange={(value) => {
                setLimit(value);
                setPage(1);
              }}
            />
          </>
        )}
      </div>

      {/* Modal Kirim (Dipertahankan) */}
      {sendModalOpen && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-lg font-semibold">Kirim Sales Order</h2>
              <button
                onClick={() => {
                  setSendModalOpen(false);
                  setSendMethod("email");
                }}
                className="text-gray-400 hover:text-gray-600 text-xl"
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
    </div>
    </FeatureGuard>
  );
}
