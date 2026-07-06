"use client";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { PlusCircle, Download, ChevronDown, Eye, Edit, Send, Trash2, Receipt, RotateCcw, Search } from "lucide-react";
import toast from "react-hot-toast";
import Skeleton from "@/components/ui/skeleton";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import EmptyState from "@/components/EmptyState";
import Pagination from "@/components/tables/Pagination";
import { downloadCSV, downloadXLSX } from "@/lib/exporters";
import FeatureGuard from "@/components/FeatureGuard";
import { formatDownloadFileName } from "@/utils/downloadFilename";
import { StatusBadge, getInvoiceStatusLabel } from "@/components/ui/StatusBadge";
import { DocumentStatusBadge, type DocStatus } from "@/components/ui/DocumentStatusBadge";
import { ModalConfirmation } from "@/components/ui/ModalConfirmation";

type InvoiceRow = {
  id: number;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  status: string;
  total: number;
  customer?: { company?: string; pic?: string };
  downPayment?: number;
  quotation?: { id: number; quotationNumber?: string | null } | null;
  deletedAt?: string | null;
};

// Normalisasi status dokumen ke salah satu nilai DocStatus
const normalizeDocStatus = (raw: string): DocStatus => {
  const v = String(raw || "").trim().toLowerCase();
  if (v === "sent") return "Sent";
  if (v === "approved") return "Approved";
  if (v === "declined") return "Declined";
  if (v === "canceled" || v === "cancelled") return "Canceled";
  if (v === "final") return "Final";
  return "Draft";
};

function InvoicePageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [showDropdown, setShowDropdown] = useState(false);
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const page = Number(searchParams?.get("page") || "1");
  const limit = Number(searchParams?.get("limit") || "10");
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [tab, setTab] = useState<"list" | "payment" | "deleted">((searchParams?.get('tab') as any) === 'payment' ? 'payment' : ((searchParams?.get('tab') as any) === 'deleted' ? 'deleted' : 'list'));
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const rangeParam = (searchParams?.get("range") || "").trim();
  const statusParam = (searchParams?.get("status") || "").trim();
  const activeFiltersLabel = useMemo(() => {
    const parts: string[] = [];
    if (statusParam) parts.push(`Status=${statusParam}`);
    if (rangeParam) parts.push(`Range=${rangeParam}`);
    return parts.join(" • ");
  }, [rangeParam, statusParam]);

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const range = (searchParams?.get("range") || "").trim();
      const status = (searchParams?.get("status") || "").trim();
      const qs = new URLSearchParams();
      if (range) qs.set("range", range);
      if (status) qs.set("status", status);
      if (tab === 'deleted') qs.set("includeDeleted", "1");
      qs.set("page", page.toString());
      qs.set("limit", limit.toString());
      const url = `/api/invoices?${qs.toString()}`;
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || json?.success === false) throw new Error(json?.message || "Gagal mengambil data");
      const data: any[] = Array.isArray(json?.data) ? json.data : [];
      const mapped = data.map((r) => ({
        id: r.id,
        invoiceNumber: r.invoiceNumber,
        issueDate: r.issueDate,
        dueDate: r.dueDate,
        status: r.status,
        total: r.total,
        customer: r.customer,
        downPayment: r.downPayment,
        quotation: r.quotation,
        deletedAt: r.deletedAt,
      }));
      setRows(mapped);
      if (json.pagination) {
        setTotal(json.pagination.total);
        setTotalPages(json.pagination.totalPages);
      }
    } catch (e: any) {
      setError(e?.message || "Gagal mengambil data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRows(); }, [searchParams, tab]);

  // Refetch saat daftar brand berubah (gunakan ref agar selalu pakai fungsi terbaru)
  const fetchRef = useRef<() => void>(() => {});
  useEffect(() => {
    fetchRef.current = fetchRows;
  }, [fetchRows]);
  useEffect(() => {
    const handler = () => fetchRef.current();
    window.addEventListener("brand-list:updated", handler);
    return () => window.removeEventListener("brand-list:updated", handler);
  }, []);

  // Refetch saat brand aktif berganti
  useEffect(() => {
    const handler = () => fetchRef.current();
    window.addEventListener("brand-modules:updated", handler);
    return () => window.removeEventListener("brand-modules:updated", handler);
  }, []);

  const fmt = useCallback((n: number) => (Number(n) || 0).toLocaleString("id-ID", { style: "currency", currency: "IDR" }), []);
  const fmtDate = useCallback((s: string) => (s ? new Date(s).toLocaleDateString("id-ID") : "-"), []);
  const filteredAll = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.invoiceNumber.toLowerCase().includes(q) || (r.customer?.company || '').toLowerCase().includes(q) || (r.customer?.pic || '').toLowerCase().includes(q));
  }, [rows, searchTerm]);
  const filteredList = useMemo(() => filteredAll.filter(r => !r.deletedAt && Number(r.downPayment || 0) <= 0 && r.status !== 'DP'), [filteredAll]);
  const filteredDP = useMemo(() => filteredAll.filter(r => !r.deletedAt && (Number(r.downPayment || 0) > 0 || r.status === 'DP')), [filteredAll]);
  const filteredDeleted = useMemo(() => filteredAll.filter(r => !!r.deletedAt), [filteredAll]);
  const activeData = useMemo(() => (tab === "list" ? filteredList : (tab === 'payment' ? filteredDP : filteredDeleted)), [tab, filteredList, filteredDP, filteredDeleted]);
  
  // Since we use server-side pagination, activeData is already paged
  const paged = activeData;


  const markAsSent = useCallback(async (id: number) => {
    try {
      const statusValue = 'Sent';
      const res = await fetch(`/api/invoices/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: statusValue }) });
      if (!res.ok) throw new Error();
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: statusValue } : r)));
      toast.success(`Invoice ditandai sebagai ${statusValue}`);
    } catch { toast.error('Gagal mengubah status'); }
  }, []);

  const deleteInvoice = useCallback(async (id: number) => {
    const toastId = toast.loading('Menghapus invoice...');
    try {
      const res = await fetch(`/api/invoices/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setRows((prev) => prev.filter((r) => r.id !== id));
      toast.success('Invoice dipindahkan ke tab Terhapus', { id: toastId });
    } catch {
      toast.error('Gagal menghapus invoice', { id: toastId });
    }
  }, []);

  const confirmDelete = useCallback((id: number) => {
    setConfirmDeleteId(id);
    setDeleteModalOpen(true);
  }, []);

  const restoreRow = useCallback(async (id: number) => {
    // Buka modal konfirmasi Pulihkan
    setConfirmRestoreId(id);
    setRestoreModalOpen(true);
  }, []);

  const downloadInvoice = useCallback(async (row: InvoiceRow) => {
    try {
      const res = await fetch(`/api/invoices/${row.id}/pdf`, { method: 'GET' });
      if (!res.ok) throw new Error('Gagal mengunduh PDF');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const fileName = formatDownloadFileName(
        row.invoiceNumber,
        row.customer?.pic || row.customer?.company,
        `INV-${row.id}`,
        row.customer?.pic || row.customer?.company || "Customer"
      );
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(e?.message || 'Gagal mengunduh PDF');
    }
  }, []);

  // Modal Pulihkan
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [confirmRestoreId, setConfirmRestoreId] = useState<number | null>(null);
  const [restoreLoading, setRestoreLoading] = useState(false);

  // Modal kirim (WA/Email/PDF)
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [sendMethod, setSendMethod] = useState<"wa" | "email" | "pdf">("email");
  const [selectedRow, setSelectedRow] = useState<InvoiceRow | null>(null);
  const openSend = useCallback((row: InvoiceRow) => { setSelectedRow(row); setSendMethod("email"); setSendModalOpen(true); }, []);

  // Modal pembayaran (Lunas / Tambah Pembayaran)
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payMode, setPayMode] = useState<"paid" | "add">("add");
  const [payAmount, setPayAmount] = useState<string>("");
  const [selectedPayRow, setSelectedPayRow] = useState<InvoiceRow | null>(null);
  const openPay = useCallback((row: InvoiceRow) => { setSelectedPayRow(row); setPayMode("add"); setPayAmount(""); setPayModalOpen(true); }, []);

  // Modal posting ke Kwitansi (untuk Paid)
  const [kwModalOpen, setKwModalOpen] = useState(false);
  const [kwMakeDelivery, setKwMakeDelivery] = useState(false);
  const [selectedKwRow, setSelectedKwRow] = useState<InvoiceRow | null>(null);
  const openKw = useCallback((row: InvoiceRow) => { setSelectedKwRow(row); setKwMakeDelivery(false); setKwModalOpen(true); }, []);

  // Modal View PDF (view-only)
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [selectedPdfRow, setSelectedPdfRow] = useState<InvoiceRow | null>(null);
  const openPdf = useCallback((row: InvoiceRow) => { setSelectedPdfRow(row); setPdfModalOpen(true); }, []);

  return (
    <div className="sales-scope p-6 min-h-screen">
      <PageBreadcrumb pageTitle="Invoice Penjualan" />

      {/* Kontainer utama */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-4 border-b border-gray-100 px-6 py-5 lg:flex-row lg:items-center lg:justify-between dark:border-gray-800">
          <div>
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Monitoring Invoice</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Tracking status pembayaran vendor dan keterhubungan dengan PO maupun GR.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              className="flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
              onClick={() => setShowDropdown(!showDropdown)}
            >
              <Download className="h-4 w-4" />
              Export & Bagikan
              <ChevronDown className="h-4 w-4" />
            </button>
            <Link
              href="/penjualan/invoice-penjualan/add"
              className="flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              <PlusCircle className="h-4 w-4" />
              Buat Invoice Baru
            </Link>
          </div>
        </div>
        {/* Tabs with underline */}
        <div>
          <div className="flex gap-6 border-b dark:border-gray-800">
            <button
              className={`relative -mb-px px-1 py-3 text-sm font-medium ${tab==='list' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-100'}`}
              onClick={() => {
                const params = new URLSearchParams(searchParams?.toString());
                params.set("tab", "list");
                params.set("page", "1");
                router.push(`?${params.toString()}`);
                setTab("list");
              }}
            >
              List Invoice
              {tab==='list' && <span className="absolute left-0 right-0 -bottom-[1px] h-0.5 bg-blue-600 dark:bg-blue-400" />}
            </button>
            <button
              className={`relative -mb-px px-1 py-3 text-sm font-medium ${tab==='payment' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-100'}`}
              onClick={() => {
                const params = new URLSearchParams(searchParams?.toString());
                params.set("tab", "payment");
                params.set("page", "1");
                router.push(`?${params.toString()}`);
                setTab("payment");
              }}
            >
              Invoice Pembayaran
              {tab==='payment' && <span className="absolute left-0 right-0 -bottom-[1px] h-0.5 bg-blue-600 dark:bg-blue-400" />}
            </button>
            <button
              className={`relative -mb-px px-1 py-3 text-sm font-medium ${tab==='deleted' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-100'}`}
              onClick={() => {
                const params = new URLSearchParams(searchParams?.toString());
                params.set("tab", "deleted");
                params.set("page", "1");
                router.push(`?${params.toString()}`);
                setTab("deleted");
              }}
            >
              Terhapus
              {tab==='deleted' && <span className="absolute left-0 right-0 -bottom-[1px] h-0.5 bg-blue-600 dark:bg-blue-400" />}
            </button>
          </div>
        </div>
        {/* Toolbar */}
        <div className="space-y-4 px-6 py-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Cari pelanggan / nomor invoice..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); }}
                  className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm text-gray-700 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:placeholder:text-gray-500 dark:focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-dashed border-gray-200 px-3 py-2 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
              <Receipt className="h-3.5 w-3.5" />
              {activeData.length} invoice aktif
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800">
          {loading ? (
            <>
              {/* Toolbar skeleton */}
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Skeleton className="h-11 w-full sm:w-64 rounded-lg" />
                <div className="flex items-center gap-3">
                  <Skeleton className="h-9 w-40 rounded-full" />
                  <Skeleton className="h-9 w-40 rounded-full" />
                </div>
              </div>
              {/* Table skeleton */}
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-white/5">
                  <tr>
                    <th className="px-4 py-3 text-left">Customer</th>
                    <th className="px-4 py-3 text-left">No. Invoice</th>
                    <th className="px-4 py-3 text-left">Issued</th>
                    <th className="px-4 py-3 text-left">Status Dokumen</th>
                    <th className="px-4 py-3 text-left">Status Invoice</th>
                    <th className="px-4 py-3 text-right">Jumlah</th>
                    <th className="px-4 py-3 text-right">Tindakan</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-t dark:border-gray-800">
                      <td className="px-4 py-3"><Skeleton className="h-4 w-48" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-5 w-24 rounded-full" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-5 w-24 rounded-full" /></td>
                      <td className="px-4 py-3 text-right"><Skeleton className="ml-auto h-4 w-24" /></td>
                      <td className="px-4 py-3 text-right"><Skeleton className="ml-auto h-4 w-24" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : error ? (
            <div className="p-6 text-center text-red-600">{error}</div>
          ) : activeData.length === 0 ? (
            <EmptyState
              title={tab === 'list' ? 'Belum ada invoice' : (tab === 'payment' ? 'Belum ada invoice dengan DP' : 'Tidak ada invoice terhapus')}
              description={tab === 'list' ? 'Buat invoice penjualan untuk menagihkan pelanggan Anda.' : (tab === 'payment' ? 'Tambahkan DP melalui halaman detail invoice agar tampil di sini.' : 'Tidak ada invoice yang dihapus dalam periode ini.')}
              actions={
                <Link href="/penjualan/invoice-penjualan/add" className="flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-white shadow-sm transition hover:bg-blue-700">
                  <PlusCircle className="h-4 w-4" />
                  Buat Invoice Baru
                </Link>
              }
            />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-700 dark:bg-white/5 dark:text-white/80">
                {tab === 'list' && (
                  <tr>
                    <th className="px-4 py-3 text-left">Customer</th>
                    <th className="px-4 py-3 text-left">No. Invoice</th>
                    <th className="px-4 py-3 text-left">Ref. Quotation</th>
                    <th className="px-4 py-3 text-left">Issued</th>
                    <th className="px-4 py-3 text-left">Status Dokumen</th>
                    <th className="px-4 py-3 text-left">Status Invoice</th>
                    <th className="px-4 py-3 text-right">Jumlah</th>
                    <th className="px-4 py-3 text-right">Tindakan</th>
                  </tr>
                )}
                {tab === 'payment' && (
                  <tr>
                    <th className="px-4 py-3 text-left">Customer</th>
                    <th className="px-4 py-3 text-left">No. Invoice</th>
                    <th className="px-4 py-3 text-left">Status Invoice</th>
                    <th className="px-4 py-3 text-right">Jumlah Dibayar</th>
                    <th className="px-4 py-3 text-right">Sisa Tagihan</th>
                    <th className="px-4 py-3 text-left">Tgl Invoice</th>
                    <th className="px-4 py-3 text-left">Jatuh Tempo</th>
                    <th className="px-4 py-3 text-right">Tindakan</th>
                  </tr>
                )}
                {tab === 'deleted' && (
                  <tr>
                    <th className="px-4 py-3 text-left">Customer</th>
                    <th className="px-4 py-3 text-left">No. Invoice</th>
                    <th className="px-4 py-3 text-left">Tgl Dihapus</th>
                    <th className="px-4 py-3 text-left">Issued</th>
                    <th className="px-4 py-3 text-left">Status Dokumen</th>
                    <th className="px-4 py-3 text-left">Status Invoice</th>
                    <th className="px-4 py-3 text-right">Jumlah</th>
                    <th className="px-4 py-3 text-right">Tindakan</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {paged.map((r) => {
                  const paid = Number(r.downPayment || 0);
                  const due = Math.max(0, Number(r.total || 0) - paid);
                  const rawStatus = String(r.status || '').trim();
                  const docStatus: DocStatus = normalizeDocStatus(rawStatus || 'Draft');
                  const invStatusLabel = getInvoiceStatusLabel(r);
                  return (
                    <tr key={r.id} className="border-t hover:bg-gray-50 transition dark:border-gray-800 dark:hover:bg-white/5">
                      {tab === 'list' && (
                        <>
                          <td className="px-4 py-3 text-gray-800 dark:text-gray-200">{r.customer?.pic ? `${r.customer.pic} - ` : ''}{r.customer?.company || '-'}</td>
                          <td className="px-4 py-3 text-gray-800 dark:text-gray-200">{r.invoiceNumber}</td>
                          <td className="px-4 py-3">{r.quotation?.id ? (<Link href={`/penjualan/quotation/${r.quotation.id}`} className="text-blue-600 hover:underline dark:text-blue-400">{r.quotation.quotationNumber || `Q-${r.quotation.id}`}</Link>) : ('-')}</td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{fmtDate(r.issueDate)}</td>
                          <td className="px-4 py-3"><DocumentStatusBadge status={docStatus} /></td>
                          <td className="px-4 py-3"><StatusBadge status={invStatusLabel} /></td>
                          <td className="px-4 py-3 text-right text-gray-800 dark:text-gray-200">{fmt(r.total)}</td>
                        </>
                      )}
                      {tab === 'payment' && (
                        <>
                          <td className="px-4 py-3 text-gray-800 dark:text-gray-200">{r.customer?.pic ? `${r.customer.pic} - ` : ''}{r.customer?.company || '-'}</td>
                          <td className="px-4 py-3 text-gray-800 dark:text-gray-200">{r.invoiceNumber}</td>
                          <td className="px-4 py-3"><StatusBadge status={invStatusLabel} /></td>
                          <td className="px-4 py-3 text-right text-gray-800 dark:text-gray-200">{fmt(paid)}</td>
                          <td className="px-4 py-3 text-right text-gray-800 dark:text-gray-200">{fmt(due)}</td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{fmtDate(r.issueDate)}</td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{fmtDate(r.dueDate)}</td>
                        </>
                      )}
                      {tab === 'deleted' && (
                        <>
                          <td className="px-4 py-3 text-gray-800 dark:text-gray-200">{r.customer?.pic ? `${r.customer.pic} - ` : ''}{r.customer?.company || '-'}</td>
                          <td className="px-4 py-3 text-gray-800 dark:text-gray-200">{r.invoiceNumber}</td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{fmtDate(r.deletedAt || '')}</td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{fmtDate(r.issueDate)}</td>
                          <td className="px-4 py-3"><DocumentStatusBadge status={docStatus} /></td>
                          <td className="px-4 py-3"><StatusBadge status={invStatusLabel} /></td>
                          <td className="px-4 py-3 text-right text-gray-800 dark:text-gray-200">{fmt(r.total)}</td>
                        </>
                      )}
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center justify-end gap-2">
                          {tab === 'payment' && (
                            invStatusLabel === 'Paid' ? (
                              <>
                                <button onClick={() => openPdf(r)} title="Lihat PDF" className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/5">
                                  <Eye className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                                </button>
                                <button onClick={() => openKw(r)} title="Kirim ke Kwitansi" className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/5">
                                  <Receipt className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                                </button>
                              </>
                            ) : (
                              <button onClick={() => openPay(r)} title="Lihat" className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/5">
                                <Eye className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                              </button>
                            )
                          )}
                          {tab === 'deleted' && (
                            <button onClick={() => restoreRow(r.id)} title="Pulihkan" className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/5">
                              <RotateCcw className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            </button>
                          )}
                          {tab === 'list' && (
                            <Link
                              href={`/penjualan/invoice-penjualan/${r.id}`}
                              title="Lihat"
                              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/5"
                            >
                              <Eye className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                            </Link>
                          )}
                          {tab === 'list' && (
                            <Link
                              href={`/penjualan/invoice-penjualan/edit/${r.id}?from=list`}
                              title="Edit"
                              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/5"
                            >
                              <Edit className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                            </Link>
                          )}
                          <button onClick={() => downloadInvoice(r)} title="Download PDF" className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/5">
                            <Download className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          </button>
                          {tab !== 'deleted' && !(tab==='payment' && invStatusLabel==='Paid') && (
                            <button onClick={() => confirmDelete(r.id)} title="Hapus" className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/5">
                              <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          </div>
        </div>

        {/* Pagination (komponen template) */}
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
      {/* Modal Kirim */}
      {sendModalOpen && selectedRow && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={(e)=>{ if(e.target===e.currentTarget) setSendModalOpen(false); }}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden dark:bg-gray-900">
            <div className="flex items-center justify-between border-b px-6 py-4 dark:border-gray-800">
              <h2 className="text-lg font-semibold dark:text-gray-100">Kirim Invoice</h2>
              <button onClick={()=>setSendModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl dark:text-gray-400 dark:hover:text-gray-300">×</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x dark:divide-gray-800">
              <div className="p-6 space-y-3">
                <p className="font-medium text-gray-800 mb-2 dark:text-gray-200">Pilih metode</p>
                <label onClick={()=>setSendMethod('wa')} className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition ${sendMethod==='wa' ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20' : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'} dark:text-gray-200`}>
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" /> WhatsApp
                </label>
                <label onClick={()=>setSendMethod('email')} className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition ${sendMethod==='email' ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20' : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'} dark:text-gray-200`}>
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" /> Email
                </label>
                <label onClick={()=>setSendMethod('pdf')} className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition ${sendMethod==='pdf' ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20' : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'} dark:text-gray-200`}>
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-gray-500" /> Simpan sebagai PDF
                </label>
              </div>
              <div className="p-6">
                <p className="font-medium text-gray-800 mb-2 dark:text-gray-200">Preview Pesan</p>
                <textarea className="w-full h-56 resize-none rounded-lg border border-gray-300 p-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:focus:ring-blue-400" readOnly value={`Hi ${selectedRow.customer?.pic || '-'},\nAnda menerima invoice ${selectedRow.invoiceNumber}. Total ${fmt(selectedRow.total)}.`} />
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t px-6 py-4 dark:border-gray-800">
              <button onClick={()=>setSendModalOpen(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5">Batal</button>
              <button onClick={async ()=>{
                try {
                  if (sendMethod==='wa') {
                    const phone = '';
                    const msg = encodeURIComponent(`Invoice ${selectedRow.invoiceNumber} total ${fmt(selectedRow.total)}`);
                    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
                  } else if (sendMethod==='email') {
                    const subject = encodeURIComponent(`Invoice ${selectedRow.invoiceNumber}`);
                    const body = encodeURIComponent(`Invoice ${selectedRow.invoiceNumber} total ${fmt(selectedRow.total)}`);
                    window.location.href = `mailto:?subject=${subject}&body=${body}`;
                  } else {
                    window.open(`/penjualan/invoice-penjualan/${selectedRow.id}`, '_blank');
                  }
                  await markAsSent(selectedRow.id);
                } finally { setSendModalOpen(false); }
              }} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Kirim</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pembayaran (Invoice Pembayaran) */}
      {payModalOpen && selectedPayRow && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={(e)=>{ if(e.target===e.currentTarget) setPayModalOpen(false); }}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden dark:bg-gray-900 dark:text-gray-100">
            <div className="flex items-center justify-between border-b px-6 py-4 dark:border-gray-800">
              <h2 className="text-lg font-semibold">Pembayaran Invoice</h2>
              <button onClick={()=>setPayModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl dark:text-gray-400 dark:hover:text-gray-300">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="text-sm text-gray-700 dark:text-gray-300">
                <div className="font-medium">{selectedPayRow.invoiceNumber}</div>
                <div>Total: {fmt(selectedPayRow.total)} | Dibayar: {fmt(Number(selectedPayRow.downPayment||0))}</div>
                <div>Sisa: {fmt(Math.max(0, Number(selectedPayRow.total) - Number(selectedPayRow.downPayment||0)))}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={()=>setPayMode('paid')} className={`px-3 py-2 rounded border ${payMode==='paid'?'border-blue-500 bg-blue-50':''} dark:border-gray-700 dark:bg-transparent`}>Tandai Lunas</button>
                <button onClick={()=>setPayMode('add')} className={`px-3 py-2 rounded border ${payMode==='add'?'border-blue-500 bg-blue-50':''} dark:border-gray-700 dark:bg-transparent`}>Rekam Tambahan</button>
              </div>
              {payMode==='add' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Jumlah Tambahan (Rp)</label>
                  <input value={payAmount} onChange={(e)=>setPayAmount(e.target.value)} placeholder="0" className="w-full rounded border px-3 py-2 dark:border-gray-700 dark:bg-transparent dark:text-gray-200" />
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 border-t px-6 py-4 dark:border-gray-800">
              <button onClick={()=>setPayModalOpen(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5">Batal</button>
              <button onClick={async ()=>{
                try {
                  let payload:any = {};
                  const totalAmt = Number(selectedPayRow.total);
                  if (payMode==='paid') {
                    payload = { status: 'Paid', paymentStatus: 'PAID', downPayment: totalAmt };
                  } else {
                    const add = Number((payAmount||'').replace(/[^0-9.-]/g,''))||0;
                    const current = Number(selectedPayRow.downPayment||0);
                    const next = Math.min(totalAmt, current + add);
                    payload = { 
                      downPayment: next, 
                      status: next >= totalAmt ? 'Paid' : 'Sent',
                      paymentStatus: next >= totalAmt ? 'PAID' : (next > 0 ? 'PARTIAL' : 'UNPAID')
                    };
                  }
                  const res = await fetch(`/api/invoices/${selectedPayRow.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
                  if (!res.ok) throw new Error('Gagal menyimpan');
                  setRows(prev => prev.map(r => r.id===selectedPayRow.id ? { ...r, ...payload } : r));
                  toast.success('Pembayaran tersimpan');
                } catch(e:any) {
                  toast.error(e?.message || 'Gagal menyimpan pembayaran');
                } finally { setPayModalOpen(false); }
              }} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Simpan</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Kwitansi untuk Paid */}
      {kwModalOpen && selectedKwRow && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={(e)=>{ if(e.target===e.currentTarget) setKwModalOpen(false); }}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden dark:bg-gray-900 dark:text-gray-100">
            <div className="flex items-center justify-between border-b px-6 py-4 dark:border-gray-800">
              <h2 className="text-lg font-semibold">Posting ke Kwitansi</h2>
              <button onClick={()=>setKwModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl dark:text-gray-400 dark:hover:text-gray-300">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="text-sm text-gray-700 dark:text-gray-300">
                <div className="font-medium">{selectedKwRow.invoiceNumber}</div>
                <div>Customer: {(selectedKwRow.customer?.pic || '-') + (selectedKwRow.customer?.company ? ' - ' + selectedKwRow.customer.company : '')}</div>
                <div>Total: {fmt(selectedKwRow.total)}</div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={kwMakeDelivery} onChange={(e)=>setKwMakeDelivery(e.target.checked)} />
                Buat Surat Jalan juga
              </label>
            </div>
            <div className="flex justify-end gap-3 border-t px-6 py-4 dark:border-gray-800">
              <button onClick={()=>setKwModalOpen(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5">Batal</button>
              <button onClick={()=>{ 
                try {
                  const payload = {
                    from: 'invoice',
                    invoiceId: selectedKwRow.id,
                    invoiceNumber: selectedKwRow.invoiceNumber,
                    customer: selectedKwRow.customer || {},
                    total: selectedKwRow.total,
                    makeDelivery: kwMakeDelivery,
                  } as any;
                  localStorage.setItem('newReceiptFromInvoice', JSON.stringify(payload));
                  window.location.href = `/penjualan/kwitansi-penjualan/${selectedKwRow.id}`;
                } finally { setKwModalOpen(false); }
              }} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Lanjutkan</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Preview PDF (native browser viewer, allows download) */}
      {pdfModalOpen && selectedPdfRow && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={(e)=>{ if(e.target===e.currentTarget) setPdfModalOpen(false); }}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] overflow-hidden flex flex-col dark:bg-gray-900 dark:text-gray-100">
            <div className="flex items-center justify-between border-b px-6 py-4 dark:border-gray-800">
              <h2 className="text-lg font-semibold">Preview Invoice - {selectedPdfRow.invoiceNumber}</h2>
              <div className="flex items-center gap-3">
                <a
                  href={`/api/invoices/${selectedPdfRow.id}/pdf?preview=1`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
                >
                  Buka di tab baru
                </a>
                <button onClick={()=>setPdfModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl dark:text-gray-400 dark:hover:text-gray-300">×</button>
              </div>
            </div>
            <div className="flex-1 bg-gray-50 dark:bg-gray-800">
              <iframe
                title={`Preview Invoice ${selectedPdfRow.invoiceNumber}`}
                src={`/api/invoices/${selectedPdfRow.id}/pdf?preview=1`}
                className="w-full h-full"
                style={{ border: "none" }}
                allow="fullscreen"
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus */}
      <ModalConfirmation
        isOpen={deleteModalOpen}
        onClose={() => { setDeleteModalOpen(false); setConfirmDeleteId(null); }}
        title="Hapus invoice ini?"
        description="Invoice akan dipindahkan ke tab Terhapus dan disimpan selama 30 hari."
        confirmLabel="Hapus"
        destructive
        loading={deleteLoading}
        onConfirm={async () => {
          if (confirmDeleteId == null) return;
          setDeleteLoading(true);
          try {
            await deleteInvoice(confirmDeleteId);
          } finally {
            setDeleteLoading(false);
            setDeleteModalOpen(false);
            setConfirmDeleteId(null);
          }
        }}
      />

      {/* Modal Konfirmasi Pulihkan */}
      <ModalConfirmation
        isOpen={restoreModalOpen}
        onClose={() => { setRestoreModalOpen(false); setConfirmRestoreId(null); }}
        title="Pulihkan invoice ini?"
        description="Invoice akan dipindahkan kembali ke daftar utama."
        confirmLabel="Pulihkan"
        loading={restoreLoading}
        onConfirm={async () => {
          if (confirmRestoreId == null) return;
          setRestoreLoading(true);
          try {
            const res = await fetch(`/api/invoices/${confirmRestoreId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deletedAt: null }) });
            if (!res.ok) throw new Error();
            setRows((prev) => prev.map((r) => (r.id === confirmRestoreId ? { ...r, deletedAt: null } : r)));
            toast.success('Invoice dipulihkan');
          } catch { toast.error('Gagal memulihkan invoice'); }
          finally {
            setRestoreLoading(false);
            setRestoreModalOpen(false);
            setConfirmRestoreId(null);
          }
        }}
      />
    </div>
  );
}

export default function InvoicePage() {
  return (
    <FeatureGuard feature="sales.invoice">
      <Suspense fallback={<div />}> 
        <InvoicePageInner />
      </Suspense>
    </FeatureGuard>
  );
}
