"use client";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PlusCircle, Download, ChevronDown, Eye, Edit, Send, Trash2, Receipt, RotateCcw } from "lucide-react";
import toast from "react-hot-toast";
import Skeleton from "@/components/ui/skeleton";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import EmptyState from "@/components/EmptyState";
import Pagination from "@/components/tables/Pagination";
import { downloadCSV, downloadXLSX } from "@/lib/exporters";
import FeatureGuard from "@/components/FeatureGuard";

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

const getStatusColor = (status: string) => {
  switch (status) {
    case "Paid":
      return "bg-green-100 text-green-700";
    case "DP":
      return "bg-blue-100 text-blue-700";
    case "Unpaid":
      return "bg-yellow-100 text-yellow-800";
    case "Sent":
      return "bg-blue-100 text-blue-700";
    case "Overdue":
      return "bg-red-100 text-red-700";
    case "Cancelled":
      return "bg-gray-200 text-gray-700";
    default:
      return "bg-yellow-100 text-yellow-800"; // Draft
  }
};

const getDocumentStatusColor = (status: string) => {
  switch (status) {
    case "Draft":
      return "bg-gray-100 text-gray-700";
    case "Sent":
      return "bg-blue-100 text-blue-700";
    case "Cancelled":
      return "bg-gray-200 text-gray-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
};

function InvoicePageInner() {
  const searchParams = useSearchParams();
  const [showDropdown, setShowDropdown] = useState(false);
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");
  const [tab, setTab] = useState<"list" | "payment" | "deleted">((searchParams?.get('tab') as any) === 'payment' ? 'payment' : ((searchParams?.get('tab') as any) === 'deleted' ? 'deleted' : 'list'));
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
      const url = qs.toString() ? `/api/invoices?${qs.toString()}` : "/api/invoices";
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
      setPage(1);
    } catch (e: any) {
      setError(e?.message || "Gagal mengambil data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRows(); }, [searchParams, tab]);

  const fmt = (n: number) => (Number(n) || 0).toLocaleString("id-ID", { style: "currency", currency: "IDR" });
  const fmtDate = (s: string) => (s ? new Date(s).toLocaleDateString("id-ID") : "-");
  const filteredAll = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.invoiceNumber.toLowerCase().includes(q) || (r.customer?.company || '').toLowerCase().includes(q) || (r.customer?.pic || '').toLowerCase().includes(q));
  }, [rows, searchTerm]);
  const filteredList = useMemo(() => filteredAll.filter(r => !r.deletedAt && Number(r.downPayment || 0) <= 0 && r.status !== 'DP'), [filteredAll]);
  const filteredDP = useMemo(() => filteredAll.filter(r => !r.deletedAt && (Number(r.downPayment || 0) > 0 || r.status === 'DP')), [filteredAll]);
  const filteredDeleted = useMemo(() => filteredAll.filter(r => !!r.deletedAt), [filteredAll]);
  const activeData = tab === "list" ? filteredList : (tab === 'payment' ? filteredDP : filteredDeleted);
  const totalPages = Math.max(1, Math.ceil(activeData.length / limit));
  const start = (page - 1) * limit;
  const paged = activeData.slice(start, start + limit);

  const markAsSent = async (id: number) => {
    try {
      const res = await fetch(`/api/invoices/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'Sent' }) });
      if (!res.ok) throw new Error();
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'Sent' } : r)));
      toast.success('Invoice ditandai sebagai Sent');
    } catch { toast.error('Gagal mengubah status'); }
  };

  const deleteRow = async (id: number) => {
    if (!confirm('Hapus invoice ini? (tersimpan 30 hari)')) return;
    try {
      const res = await fetch(`/api/invoices/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setRows((prev) => prev.filter((r) => r.id !== id));
      toast.success('Invoice dihapus');
    } catch { toast.error('Gagal menghapus invoice'); }
  };

  const restoreRow = async (id: number) => {
    if (!confirm('Pulihkan invoice ini?')) return;
    try {
      const res = await fetch(`/api/invoices/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deletedAt: null }) });
      if (!res.ok) throw new Error();
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, deletedAt: null } : r)));
      toast.success('Invoice dipulihkan');
    } catch { toast.error('Gagal memulihkan invoice'); }
  };

  const downloadInvoice = async (row: InvoiceRow) => {
    try {
      const res = await fetch(`/api/invoices/${row.id}/pdf`, { method: 'GET' });
      if (!res.ok) throw new Error('Gagal mengunduh PDF');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeNumber = String(row.invoiceNumber || `INV-${row.id}`).replace(/[^a-zA-Z0-9-_]/g, '_');
      a.href = url;
      a.download = `Invoice-${safeNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(e?.message || 'Gagal mengunduh PDF');
    }
  };

  // Modal kirim (WA/Email/PDF)
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [sendMethod, setSendMethod] = useState<"wa" | "email" | "pdf">("email");
  const [selectedRow, setSelectedRow] = useState<InvoiceRow | null>(null);
  const openSend = (row: InvoiceRow) => { setSelectedRow(row); setSendMethod("email"); setSendModalOpen(true); };

  // Modal pembayaran (Lunas / Tambah Pembayaran)
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payMode, setPayMode] = useState<"paid" | "add">("add");
  const [payAmount, setPayAmount] = useState<string>("");
  const [selectedPayRow, setSelectedPayRow] = useState<InvoiceRow | null>(null);
  const openPay = (row: InvoiceRow) => { setSelectedPayRow(row); setPayMode("add"); setPayAmount(""); setPayModalOpen(true); };

  // Modal posting ke Kwitansi (untuk Paid)
  const [kwModalOpen, setKwModalOpen] = useState(false);
  const [kwMakeDelivery, setKwMakeDelivery] = useState(false);
  const [selectedKwRow, setSelectedKwRow] = useState<InvoiceRow | null>(null);
  const openKw = (row: InvoiceRow) => { setSelectedKwRow(row); setKwMakeDelivery(false); setKwModalOpen(true); };

  // Modal View PDF (view-only)
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [selectedPdfRow, setSelectedPdfRow] = useState<InvoiceRow | null>(null);
  const openPdf = (row: InvoiceRow) => { setSelectedPdfRow(row); setPdfModalOpen(true); };

  return (
    <div className="sales-scope p-6 min-h-screen">
      <PageBreadcrumb pageTitle="Invoice Penjualan" />

      {/* Kontainer utama */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 min-h-[70vh] overflow-visible flex flex-col gap-4">
        {/* Tabs with underline */}
        <div>
          <div className="flex gap-6 border-b">
            <button
              className={`relative -mb-px px-1 py-3 text-sm font-medium ${tab==='list' ? 'text-blue-600' : 'text-gray-600 hover:text-gray-800'}`}
              onClick={() => { setTab('list'); setPage(1); }}
            >
              List Invoice
              {tab==='list' && <span className="absolute left-0 right-0 -bottom-[1px] h-0.5 bg-blue-600" />}
            </button>
            <button
              className={`relative -mb-px px-1 py-3 text-sm font-medium ${tab==='payment' ? 'text-blue-600' : 'text-gray-600 hover:text-gray-800'}`}
              onClick={() => { setTab('payment'); setPage(1); }}
            >
              Invoice Pembayaran
              {tab==='payment' && <span className="absolute left-0 right-0 -bottom-[1px] h-0.5 bg-blue-600" />}
            </button>
            <button
              className={`relative -mb-px px-1 py-3 text-sm font-medium ${tab==='deleted' ? 'text-blue-600' : 'text-gray-600 hover:text-gray-800'}`}
              onClick={() => { setTab('deleted'); setPage(1); }}
            >
              Terhapus
              {tab==='deleted' && <span className="absolute left-0 right-0 -bottom-[1px] h-0.5 bg-blue-600" />}
            </button>
          </div>
        </div>
        {/* Toolbar */}
        <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            type="text"
            placeholder="Cari pelanggan / nomor invoice..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            className="h-11 w-full sm:w-64 rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:ring-3 focus:outline-hidden"
          />
          <div className="flex items-center gap-3">
            {activeFiltersLabel ? (
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                Aktif: {activeFiltersLabel}
              </span>
            ) : null}
            {/* Dropdown Unduh dipindah ke toolbar */}
            <div className="relative">
              <button onClick={() => setShowDropdown(!showDropdown)} className="border px-4 py-2 rounded-md flex items-center gap-2 hover:bg-gray-50">
                <Download size={18} />
                Unduh & Bagikan
                <ChevronDown size={16} />
              </button>
              {showDropdown && (
                <div className="absolute right-0 mt-2 w-52 bg-white shadow-lg rounded-md border z-10">
                  <ul className="py-2 text-sm text-gray-700">
                    <li
                      className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                      onClick={() => toast("Fitur unduh semua dokumen belum tersedia")}
                    >
                      Unduh Semua Dokumen
                    </li>
                    <li
                      className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                      onClick={() => {
                      const rows = activeData.map((r) => ({
                        invoiceNumber: r.invoiceNumber,
                        customer: `${r.customer?.pic || ''} ${r.customer?.company ? '- ' + r.customer.company : ''}`.trim(),
                        issueDate: r.issueDate,
                        dueDate: r.dueDate,
                        total: r.total,
                        status: r.status,
                      }));
                        if (rows.length === 0) { toast.error('Tidak ada data untuk diekspor'); return; }
                        downloadCSV(rows, 'invoices.csv');
                        setShowDropdown(false);
                      }}
                    >
                      Ekspor data CSV
                    </li>
                    <li
                      className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                      onClick={async () => {
                      const rows = activeData.map((r) => ({
                        invoiceNumber: r.invoiceNumber,
                        customer: `${r.customer?.pic || ''} ${r.customer?.company ? '- ' + r.customer.company : ''}`.trim(),
                        issueDate: r.issueDate,
                        dueDate: r.dueDate,
                        total: r.total,
                        status: r.status,
                      }));
                        if (rows.length === 0) { toast.error('Tidak ada data untuk diekspor'); return; }
                        await downloadXLSX(rows, 'invoices.xlsx', 'Invoices');
                        setShowDropdown(false);
                      }}
                    >
                      Ekspor data XLSX
                    </li>
                  </ul>
                </div>
              )}
            </div>
            <Link href="/penjualan/invoice-penjualan/add" className="flex items-center rounded-full bg-blue-600 px-4 py-2 text-white shadow-sm transition hover:bg-blue-700">
              <PlusCircle className="mr-2 h-4 w-4" />
              Buat Invoice Baru
            </Link>
          </div>
        </div>

        {/* Tabel */}
        <div className="overflow-x-auto overflow-y-visible rounded-lg border bg-white shadow-sm min-h-[50vh] flex-1">
          {loading ? (
            <div className="p-6">
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
                <thead className="bg-gray-50">
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
                    <tr key={i} className="border-t">
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
            </div>
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
              <thead className="bg-gray-50 text-gray-700">
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
                  const docStatus = r.status === 'Sent' ? 'Sent' : 'Pending';
                  const invStatus = r.status === 'Paid' ? 'Paid' : (paid > 0 ? 'DP' : 'Unpaid');
                  return (
                    <tr key={r.id} className="border-t hover:bg-gray-50 transition">
                      {tab === 'list' && (
                        <>
                          <td className="px-4 py-3">{r.customer?.pic ? `${r.customer.pic} - ` : ''}{r.customer?.company || '-'}</td>
                          <td className="px-4 py-3">{r.invoiceNumber}</td>
                          <td className="px-4 py-3">{r.quotation?.id ? (<Link href={`/penjualan/quotation/${r.quotation.id}`} className="text-blue-600 hover:underline">{r.quotation.quotationNumber || `Q-${r.quotation.id}`}</Link>) : ('-')}</td>
                          <td className="px-4 py-3">{fmtDate(r.issueDate)}</td>
                          <td className="px-4 py-3"><span className={`px-3 py-1 rounded-full text-xs font-medium ${getDocumentStatusColor(docStatus)}`}>{docStatus}</span></td>
                          <td className="px-4 py-3"><span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(invStatus)}`}>{invStatus}</span></td>
                          <td className="px-4 py-3 text-right">{fmt(r.total)}</td>
                        </>
                      )}
                      {tab === 'payment' && (
                        <>
                          <td className="px-4 py-3">{r.customer?.pic ? `${r.customer.pic} - ` : ''}{r.customer?.company || '-'}</td>
                          <td className="px-4 py-3">{r.invoiceNumber}</td>
                          <td className="px-4 py-3"><span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(invStatus)}`}>{invStatus}</span></td>
                          <td className="px-4 py-3 text-right">{fmt(paid)}</td>
                          <td className="px-4 py-3 text-right">{fmt(due)}</td>
                          <td className="px-4 py-3">{fmtDate(r.issueDate)}</td>
                          <td className="px-4 py-3">{fmtDate(r.dueDate)}</td>
                        </>
                      )}
                      {tab === 'deleted' && (
                        <>
                          <td className="px-4 py-3">{r.customer?.pic ? `${r.customer.pic} - ` : ''}{r.customer?.company || '-'}</td>
                          <td className="px-4 py-3">{r.invoiceNumber}</td>
                          <td className="px-4 py-3">{fmtDate(r.deletedAt || '')}</td>
                          <td className="px-4 py-3">{fmtDate(r.issueDate)}</td>
                          <td className="px-4 py-3"><span className={`px-3 py-1 rounded-full text-xs font-medium ${getDocumentStatusColor(docStatus)}`}>{docStatus}</span></td>
                          <td className="px-4 py-3"><span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(invStatus)}`}>{invStatus}</span></td>
                          <td className="px-4 py-3 text-right">{fmt(r.total)}</td>
                        </>
                      )}
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center justify-end gap-2">
                          {tab === 'payment' && (
                            invStatus === 'Paid' ? (
                              <>
                                <button onClick={() => openPdf(r)} title="Lihat PDF" className="p-2 rounded-full hover:bg-gray-100">
                                  <Eye className="h-4 w-4 text-gray-600" />
                                </button>
                                <button onClick={() => openKw(r)} title="Kirim ke Kwitansi" className="p-2 rounded-full hover:bg-gray-100">
                                  <Receipt className="h-4 w-4 text-gray-600" />
                                </button>
                              </>
                            ) : (
                              <button onClick={() => openPay(r)} title="Lihat" className="p-2 rounded-full hover:bg-gray-100">
                                <Eye className="h-4 w-4 text-gray-600" />
                              </button>
                            )
                          )}
                          {tab === 'deleted' && (
                            <button onClick={() => restoreRow(r.id)} title="Pulihkan" className="p-2 rounded-full hover:bg-gray-100">
                              <RotateCcw className="h-4 w-4 text-blue-600" />
                            </button>
                          )}
                          {tab === 'list' && (
                            <Link
                              href={`/penjualan/invoice-penjualan/${r.id}`}
                              title="Lihat"
                              className="p-2 rounded-full hover:bg-gray-100"
                            >
                              <Eye className="h-4 w-4 text-gray-600" />
                            </Link>
                          )}
                          {tab === 'list' && (
                            <Link
                              href={`/penjualan/invoice-penjualan/edit/${r.id}?from=list`}
                              title="Edit"
                              className="p-2 rounded-full hover:bg-gray-100"
                            >
                              <Edit className="h-4 w-4 text-gray-600" />
                            </Link>
                          )}
                          <button onClick={() => downloadInvoice(r)} title="Download PDF" className="p-2 rounded-full hover:bg-gray-100">
                            <Download className="h-4 w-4 text-emerald-600" />
                          </button>
                          {tab !== 'deleted' && !(tab==='payment' && invStatus==='Paid') && (
                            <button onClick={() => deleteRow(r.id)} title="Hapus" className="p-2 rounded-full hover:bg-gray-100">
                              <Trash2 className="h-4 w-4 text-red-600" />
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

        {/* Pagination (komponen template) */}
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
      </div>
      {/* Modal Kirim */}
      {sendModalOpen && selectedRow && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={(e)=>{ if(e.target===e.currentTarget) setSendModalOpen(false); }}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-lg font-semibold">Kirim Invoice</h2>
              <button onClick={()=>setSendModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x">
              <div className="p-6 space-y-3">
                <p className="font-medium text-gray-800 mb-2">Pilih metode</p>
                <label onClick={()=>setSendMethod('wa')} className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition ${sendMethod==='wa' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" /> WhatsApp
                </label>
                <label onClick={()=>setSendMethod('email')} className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition ${sendMethod==='email' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" /> Email
                </label>
                <label onClick={()=>setSendMethod('pdf')} className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition ${sendMethod==='pdf' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-gray-500" /> Simpan sebagai PDF
                </label>
              </div>
              <div className="p-6">
                <p className="font-medium text-gray-800 mb-2">Preview Pesan</p>
                <textarea className="w-full h-56 resize-none rounded-lg border border-gray-300 p-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" readOnly value={`Hi ${selectedRow.customer?.pic || '-'},\nAnda menerima invoice ${selectedRow.invoiceNumber}. Total ${fmt(selectedRow.total)}.`} />
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t px-6 py-4">
              <button onClick={()=>setSendModalOpen(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">Batal</button>
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
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-lg font-semibold">Pembayaran Invoice</h2>
              <button onClick={()=>setPayModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="text-sm text-gray-700">
                <div className="font-medium">{selectedPayRow.invoiceNumber}</div>
                <div>Total: {fmt(selectedPayRow.total)} | Dibayar: {fmt(Number(selectedPayRow.downPayment||0))}</div>
                <div>Sisa: {fmt(Math.max(0, Number(selectedPayRow.total) - Number(selectedPayRow.downPayment||0)))}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={()=>setPayMode('paid')} className={`px-3 py-2 rounded border ${payMode==='paid'?'border-blue-500 bg-blue-50':''}`}>Tandai Lunas</button>
                <button onClick={()=>setPayMode('add')} className={`px-3 py-2 rounded border ${payMode==='add'?'border-blue-500 bg-blue-50':''}`}>Rekam Tambahan</button>
              </div>
              {payMode==='add' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Jumlah Tambahan (Rp)</label>
                  <input value={payAmount} onChange={(e)=>setPayAmount(e.target.value)} placeholder="0" className="w-full rounded border px-3 py-2" />
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 border-t px-6 py-4">
              <button onClick={()=>setPayModalOpen(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">Batal</button>
              <button onClick={async ()=>{
                try {
                  let payload:any = {};
                  if (payMode==='paid') {
                    payload = { status: 'Paid', downPayment: selectedPayRow.total };
                  } else {
                    const add = Number((payAmount||'').replace(/[^0-9.-]/g,''))||0;
                    const current = Number(selectedPayRow.downPayment||0);
                    const next = Math.min(Number(selectedPayRow.total), current + add);
                    payload = { downPayment: next, status: next >= Number(selectedPayRow.total) ? 'Paid' : 'DP' };
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
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-lg font-semibold">Posting ke Kwitansi</h2>
              <button onClick={()=>setKwModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="text-sm text-gray-700">
                <div className="font-medium">{selectedKwRow.invoiceNumber}</div>
                <div>Customer: {(selectedKwRow.customer?.pic || '-') + (selectedKwRow.customer?.company ? ' - ' + selectedKwRow.customer.company : '')}</div>
                <div>Total: {fmt(selectedKwRow.total)}</div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={kwMakeDelivery} onChange={(e)=>setKwMakeDelivery(e.target.checked)} />
                Buat Surat Jalan juga
              </label>
            </div>
            <div className="flex justify-end gap-3 border-t px-6 py-4">
              <button onClick={()=>setKwModalOpen(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">Batal</button>
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
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-lg font-semibold">Preview Invoice - {selectedPdfRow.invoiceNumber}</h2>
              <div className="flex items-center gap-3">
                <a
                  href={`/api/invoices/${selectedPdfRow.id}/pdf?preview=1`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Buka di tab baru
                </a>
                <button onClick={()=>setPdfModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
              </div>
            </div>
            <div className="flex-1 bg-gray-50">
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
