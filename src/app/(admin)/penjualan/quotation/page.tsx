"use client";

import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation"; 
import toast from "react-hot-toast";
import {
  PlusCircle,
  Eye,
  Download,
  Edit,
  Trash2,
  Paperclip,
  X,
  // ChevronDown dan Copy dihapus karena tidak lagi digunakan pada Tindakan
} from "lucide-react";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import Skeleton from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import Pagination from "@/components/tables/Pagination";
import FeatureGuard from "@/components/FeatureGuard";
import { formatDownloadFileName } from "@/utils/downloadFilename";
import { StatusBadge, getQuotationStatusLabel } from "@/components/ui/StatusBadge";

// ================== TYPES ==================
type Quotation = {
  id: number;
  quotationNumber: string;
  status: string;
  date: string;
  validUntil?: string;
  total: number;
  customer: string;
  attachmentUrl?: string | null;
  hasInvoice?: boolean;
  hasSalesOrder?: boolean;
};

// ================== EMPTY STATE ==================
function EmptyState() {
  return (
    <div className="mt-20 flex flex-col items-center justify-center text-center text-gray-600 dark:text-gray-300">
      <img src="/empty-state.svg" alt="Empty State" className="mb-4 w-64 opacity-90" />
      <p className="text-lg font-medium">Belum ada data yang ditampilkan</p>
      <p className="mt-2 max-w-md text-sm">
        Buat quotation penawaran yang dapat Anda akses dari semua perangkat Anda.
      </p>
      <Link
        href="/penjualan/quotation/add"
        className="mt-4 inline-flex items-center rounded-full bg-blue-600 px-4 py-2 text-white shadow-sm transition hover:bg-blue-700"
      >
        <PlusCircle className="mr-2 h-4 w-4" />
        <span>Buat Quotation Baru</span>
      </Link>
    </div>
  );
}

// ================== ROW ITEM (Diubah: Menggunakan Ikon Tindakan & Urutan Kolom Baru) ==================
function RowItem({
  quotation,
  handleAction,
  setIsPreviewOpen,
  setPreviewUrl,
  setPreviewType,
}: {
  quotation: Quotation;
  handleAction: (action: string, id: number) => void;
  setIsPreviewOpen: (open: boolean) => void;
  setPreviewUrl: (url: string) => void;
  setPreviewType: (type: "image" | "pdf") => void;
}) {
  const quoStatusLabel = getQuotationStatusLabel({
    status: quotation.status,
    validUntil: quotation.validUntil || null,
    hasInvoice: quotation.hasInvoice,
    hasSalesOrder: quotation.hasSalesOrder,
  });
  return (
    <tr className="border-t border-gray-200 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/5">
      <td className="p-3 dark:text-gray-200">{quotation.customer}</td>

      <td className="p-3 dark:text-gray-200">
        <span className="mr-2">{quotation.quotationNumber}</span>
        {(quotation.hasInvoice || quotation.hasSalesOrder) ? (
          <StatusBadge status="Converted" className="inline-flex !px-2 !py-0.5 !text-[10px] align-middle" />
        ) : null}
      </td>

      <td className="p-3 text-right dark:text-gray-200">
        {quotation.total
          ? quotation.total.toLocaleString("id-ID", {
              style: "currency",
              currency: "IDR",
            })
          : "Rp 0"}
      </td>

      <td className="p-3 dark:text-gray-200">{quotation.date}</td>

      <td className="p-3">
        <StatusBadge status={quoStatusLabel as any} />
      </td>

      <td className="p-3 text-center dark:text-gray-300">
        {quotation.attachmentUrl ? (
          <button
            onClick={() => {
              const url = quotation.attachmentUrl!;
              const isImage = /\.(jpg|jpeg|png)$/i.test(url);
              const isPdf = /\.pdf$/i.test(url);
              if (isImage) {
                setPreviewType("image");
                setPreviewUrl(url);
                setIsPreviewOpen(true);
              } else if (isPdf) {
                setPreviewType("pdf");
                setPreviewUrl(url);
                setIsPreviewOpen(true);
              } else {
                // Fallback to open in new tab for unsupported types
                window.open(url, "_blank");
              }
            }}
            className="inline-flex items-center justify-center text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            title="Preview Lampiran"
          >
            <Paperclip className="h-4 w-4" />
          </button>
        ) : (
          "-"
        )}
      </td>

      <td className="p-3 text-right">
        <div className="inline-flex gap-1">
          <Link
            href={`/penjualan/quotation/${quotation.id}`}
            title="Lihat"
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/5"
          >
            <Eye className="h-4 w-4 text-gray-600 dark:text-gray-300" />
          </Link>

          <button
            onClick={() => handleAction("edit", quotation.id)}
            title="Ubah"
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/5"
          >
            <Edit className="h-4 w-4 text-gray-600 dark:text-gray-300" />
          </button>

          <button
            onClick={() => handleAction("download", quotation.id)}
            title="Unduh PDF"
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/5"
          >
            <Download className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </button>

          <button
            onClick={() => handleAction("delete", quotation.id)}
            title="Hapus"
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/5"
          >
            <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
          </button>
        </div>
      </td>
    </tr>
  );
}


// ================== PAGE ==================
export default function QuotationPageWithTemplate() {
  const router = useRouter(); 
  const searchParams = useSearchParams();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  
  // PERUBAHAN 1: Default limit diubah dari 5 menjadi 10
  const [limit, setLimit] = useState(10); 
  const [refreshKey, setRefreshKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<Quotation | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [previewType, setPreviewType] = useState<"image" | "pdf">("image");
  const rangeParam = (searchParams?.get("range") || "").trim();
  const statusParam = (searchParams?.get("status") || "").trim();
  const activeFiltersLabel = useMemo(() => {
    const parts: string[] = [];
    if (statusParam) parts.push(`Status=${statusParam}`);
    if (rangeParam) parts.push(`Range=${rangeParam}`);
    return parts.join(" • ");
  }, [rangeParam, statusParam]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/quotations/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Quotation berhasil dihapus");
      setQuotations((prev) => prev.filter((q) => q.id !== deleteTarget.id));
      setDeleteTarget(null);
      router.refresh();
    } catch {
      toast.error("Gagal menghapus quotation");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleAction = async (action: string, id: number) => {
    switch (action) {
      case "download": {
        const target = quotations.find((q) => q.id === id);
        const customerPic = target?.customer
          ? target.customer.split(" - ")[0]?.trim() || target.customer?.trim()
          : undefined;
        const fileName = formatDownloadFileName(
          target?.quotationNumber,
          customerPic,
          `QUO-${id}`,
          customerPic || "Customer"
        );
        try {
          // Samakan UI PDF dengan preview di halaman detail (default: tampilkan gambar, deskripsi, dan overview proyek)
          const query = new URLSearchParams({
            showImage: "true",
            showDescription: "true",
            showProjectDesc: "true",
            showSignature: "true",
          });
          const apiUrl = `/api/quotations/${id}/pdf?${query.toString()}`;
          // Metode utama: unduh via fetch -> blob
          const res = await fetch(apiUrl);
          if (!res.ok) throw new Error("download-failed");
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          link.remove();
          URL.revokeObjectURL(url);
          toast.success("PDF quotation berhasil diunduh");
        } catch (err) {
          // Fallback: buka langsung endpoint agar browser tangani Content-Disposition
          try {
            const query = new URLSearchParams({
              showImage: "true",
              showDescription: "true",
              showProjectDesc: "true",
              showSignature: "true",
            });
            const directUrl = `/api/quotations/${id}/pdf?${query.toString()}`;
            const a = document.createElement("a");
            a.href = directUrl;
            a.target = "_blank";
            a.rel = "noopener";
            document.body.appendChild(a);
            a.click();
            a.remove();
            toast.success("Mengunduh PDF via fallback berhasil dibuka");
          } catch {
            toast.error("Gagal mengunduh PDF quotation");
          }
        }
        break;
      }

      case "edit":
        router.push(`/penjualan/quotation/edit/${id}`);
        break;

      case "duplicate":
        // Logika duplicate dipertahankan dari versi sebelumnya
        try {
          const res = await fetch(`/api/quotations/${id}/duplicate`, { method: "POST" });
          if (!res.ok) throw new Error();
          toast.success("Quotation berhasil diduplikasi");
          router.refresh();
        } catch {
          toast.error("Gagal menduplikasi quotation");
        }
        break;

      case "delete": {
        const target = quotations.find((q) => q.id === id);
        setDeleteTarget(
          target ?? {
            id,
            quotationNumber: `QUO-${id}`,
            status: "",
            date: "",
            total: 0,
            customer: "",
            attachmentUrl: null,
          }
        );
        break;
      }

      default:
        break;
    }
  };

  useEffect(() => {
    const fetchQuotations = async () => {
      try {
        const range = (searchParams?.get("range") || "").trim();
        const status = (searchParams?.get("status") || "").trim();
        const qs = new URLSearchParams();
        if (range) qs.set("range", range);
        if (status) qs.set("status", status);
        const url = qs.toString() ? `/api/quotations?${qs.toString()}` : "/api/quotations";
        const res = await fetch(url, { cache: "no-store" });
        const data = await res.json();
        const list = Array.isArray(data)
          ? data
          : Array.isArray((data as Record<string, unknown>)?.data)
          ? ((data as Record<string, unknown>).data as unknown[])
          : [];
        const mapped = list.map((entry) => {
          const item = entry as Record<string, unknown>;
          const rawCustomer = item["customer"];
          // Ambil nama PIC dan perusahaan, lalu gabungkan jadi "Nama - Perusahaan"
          const picName =
            typeof rawCustomer === "object" && rawCustomer && "pic" in rawCustomer
              ? String((rawCustomer as Record<string, unknown>).pic ?? "")
              : "";
          const companyName =
            typeof rawCustomer === "string"
              ? rawCustomer
              : typeof rawCustomer === "object" && rawCustomer && "company" in rawCustomer
              ? String((rawCustomer as Record<string, unknown>).company ?? "")
              : "";
          const name = picName.trim();
          const company = companyName.trim();
          const customerText = name && company ? `${name} - ${company}` : name || company || "Tidak diketahui";
          const status = typeof item["status"] === "string" ? item["status"] : "Draft";
          const dateValue = item["date"];
          const formattedDate =
            typeof dateValue === "string" && dateValue
              ? new Date(dateValue).toLocaleDateString("id-ID")
              : "-";
          const validUntilValue = item["validUntil"];
          const validUntil =
            typeof validUntilValue === "string" && validUntilValue
              ? new Date(validUntilValue).toISOString()
              : undefined;
          const totalValue =
            typeof item["total"] === "number"
              ? item["total"]
              : typeof item["totalAmount"] === "number"
              ? item["totalAmount"]
              : 0;

          const hasInvoice = typeof item["hasInvoice"] === "boolean" ? (item["hasInvoice"] as boolean) : false;
          const hasSalesOrder = typeof item["hasSalesOrder"] === "boolean" ? (item["hasSalesOrder"] as boolean) : false;

          return {
            id: Number(item["id"] ?? 0),
            quotationNumber: String(item["quotationNumber"] ?? ""),
            status,
            date: formattedDate,
            validUntil,
            total: Number(totalValue || 0),
            customer: customerText,
            attachmentUrl:
              typeof item["projectFileUrl"] === "string" ? (item["projectFileUrl"] as string) : null,
            hasInvoice,
            hasSalesOrder,
          };
        });
        setQuotations(mapped);

      } catch (err) {
        console.error("Gagal ambil quotation:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchQuotations();
  }, [router, searchParams, refreshKey]);

  // Dengarkan perubahan daftar brand untuk memicu refetch
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

  // Filter + Pagination
  const filtered = useMemo(
    () =>
      quotations.filter(
        (q) =>
          q.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
          q.quotationNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
          q.status.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [quotations, searchTerm]
  );

  const totalPages = Math.ceil(filtered.length / limit);
  const paginated = filtered.slice((page - 1) * limit, page * limit);

  return (
    <FeatureGuard feature="sales.quotation">
    <div>
      <PageBreadcrumb pageTitle="Quotation Penjualan" />

      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        {/* Toolbar atas */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            type="text"
            placeholder="Cari pelanggan / nomor quotation..."
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
            <Link
              href="/penjualan/quotation/add"
              className="flex items-center rounded-full bg-blue-600 px-4 py-2 text-white shadow-sm transition hover:bg-blue-700"
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Buat Quotation Baru
            </Link>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="overflow-x-auto rounded-lg border bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="p-4 space-y-4">
              {/* Header skeleton */}
              <div className="grid grid-cols-7 gap-3">
                <Skeleton className="h-5 w-24 col-span-2" />
                <Skeleton className="h-5 w-28 col-span-2" />
                <Skeleton className="h-5 w-20 col-span-1" />
                <Skeleton className="h-5 w-20 col-span-1" />
                <Skeleton className="h-5 w-16 col-span-1" />
              </div>
              {/* Rows skeleton */}
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="grid grid-cols-7 gap-3">
                    <Skeleton className="h-4 w-full col-span-2" />
                    <Skeleton className="h-4 w-full col-span-2" />
                    <Skeleton className="h-4 w-full col-span-1" />
                    <Skeleton className="h-4 w-full col-span-1" />
                    <Skeleton className="h-4 w-full col-span-1" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : paginated.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-700 dark:bg-white/5 dark:text-white/80">
                  <tr>
                    <th className="p-3 text-left">Customer</th>
                    <th className="p-3 text-left">No. Quotation</th>
                    
                    {/* Urutan kolom: Jumlah (kanan) */}
                    <th className="p-3 text-right">Jumlah</th> 

                    <th className="p-3 text-left">Tanggal</th>
                    
                    {/* Urutan kolom: Status (kiri) */}
                    <th className="p-3 text-left">Status</th> 

                    <th className="p-3 text-center">Lampiran</th>
                    <th className="p-3 text-right">Tindakan</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((q) => (
                    <RowItem
                      key={q.id}
                      quotation={q}
                      handleAction={handleAction}
                      setIsPreviewOpen={setIsPreviewOpen}
                      setPreviewUrl={setPreviewUrl}
                      setPreviewType={setPreviewType}
                    />
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

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-900 dark:text-white">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">Konfirmasi Hapus</h3>
              <button
                type="button"
                onClick={() => !deleteLoading && setDeleteTarget(null)}
                className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">
              Apakah Anda yakin ingin menghapus quotation
              <span className="font-medium text-gray-800 dark:text-gray-100"> {deleteTarget.quotationNumber}</span>? Tindakan ini tidak
              dapat dibatalkan.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteLoading}
              >
                Batal
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={confirmDelete}
                loading={deleteLoading}
                loadingText="Menghapus..."
              >
                Hapus
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Preview Modal */}
      {isPreviewOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setIsPreviewOpen(false)}
        >
          <div
            className="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-lg bg-white shadow-2xl dark:bg-gray-900"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setIsPreviewOpen(false)}
              className="absolute right-2 top-2 z-10 rounded-full bg-gray-800 p-1 text-white hover:bg-gray-700"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="p-4">
              {previewType === "image" ? (
                <img
                  src={previewUrl}
                  alt="Lampiran Preview"
                  className="max-h-[80vh] max-w-full object-contain"
                />
              ) : (
                <iframe
                  src={previewUrl}
                  className="h-[80vh] w-[80vw] max-w-4xl"
                  title="PDF Preview"
                />
              )}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
    </FeatureGuard>
  );
}
