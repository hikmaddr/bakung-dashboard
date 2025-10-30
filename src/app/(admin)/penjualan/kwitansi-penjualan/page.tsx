"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, ChevronDown, Eye, Trash2, Truck } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Pagination from "@/components/tables/Pagination";
import { downloadCSV, downloadXLSX } from "@/lib/exporters";
import { toast } from "react-hot-toast";
import FeatureGuard from "@/components/FeatureGuard";

type ReceiptRow = {
  id: number;
  receiptNumber: string;
  date: string;
  total: number;
  customer?: { pic?: string; company?: string };
  _ts?: number; // key for local drafts deletion
};

export default function KwitansiPenjualanPage() {
  const [showDropdown, setShowDropdown] = useState(false);
  const [rows, setRows] = useState<ReceiptRow[]>([]); // gabungan draft (localStorage) + data API (jika ada)
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Load draft dari localStorage saat mount dan saat kembali fokus
  useEffect(() => {
    const load = () => {
      try {
        const raw = localStorage.getItem('kwitansiDrafts') || '[]';
        const drafts = JSON.parse(raw);
        const mapped: ReceiptRow[] = Array.isArray(drafts)
          ? drafts.map((d: any) => ({
              id: Number(d.invoiceId) || d.ts,
              receiptNumber: d.invoiceNumber || `DRAFT-${d.ts}`,
              date: new Date(d.ts).toLocaleDateString('id-ID'),
              total: Number(d.total || 0),
              customer: d.customer || undefined,
              _ts: d.ts,
            }))
          : [];
        setRows(mapped);
      } catch {
        setRows([]);
      }
    };
    load();
    const onFocus = () => load();
    const onStorage = (e: StorageEvent) => { if (e.key === 'kwitansiDrafts') load(); };
    window.addEventListener('focus', onFocus);
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener('focus', onFocus); window.removeEventListener('storage', onStorage); };
  }, []);

  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return rows;
    return rows.filter(r => r.receiptNumber.toLowerCase().includes(q) || (r.customer?.pic||'').toLowerCase().includes(q) || (r.customer?.company||'').toLowerCase().includes(q));
  }, [rows, searchTerm]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / limit));
  const start = (page - 1) * limit;
  const paged = filtered.slice(start, start + limit);

  const fmt = (n: number) => (Number(n) || 0).toLocaleString('id-ID', { style: 'currency', currency: 'IDR' });
  const customerText = (r: ReceiptRow) => {
    const name = r.customer?.pic?.trim() || '';
    const company = r.customer?.company?.trim() || '';
    if (name && company) return `${name} - ${company}`;
    if (name) return name;
    if (company) return company;
    return '-';
  };

  const openPreview = (r: ReceiptRow) => {
    try {
      const payload = { from: 'receipt-list', invoiceId: r.id, invoiceNumber: r.receiptNumber, ts: Date.now() };
      localStorage.setItem('newReceiptFromInvoice', JSON.stringify(payload));
    } catch {}
    window.open(`/penjualan/kwitansi-penjualan/${r.id}`, '_blank');
  };

  const sendToSJ = (r: ReceiptRow) => {
    try {
      const payload = { from: 'receipt-list', invoiceId: r.id, invoiceNumber: r.receiptNumber, ts: Date.now() };
      localStorage.setItem('newReceiptFromInvoice', JSON.stringify(payload));
    } catch {}
    window.location.href = `/penjualan/surat-jalan/add?from=receipt-list&invoiceId=${r.id}`;
  };

  const downloadKw = (r: ReceiptRow) => {
    try {
      const payload = { from: 'receipt-list', invoiceId: r.id, invoiceNumber: r.receiptNumber, ts: Date.now() };
      localStorage.setItem('newReceiptFromInvoice', JSON.stringify(payload));
    } catch {}
    window.open(`/penjualan/kwitansi-penjualan/${r.id}?download=1`, '_blank');
  };

  const deleteDraft = (r: ReceiptRow) => {
    if (!confirm('Hapus kwitansi ini?')) return;
    try {
      const raw = localStorage.getItem('kwitansiDrafts') || '[]';
      const drafts = JSON.parse(raw);
      const filtered = Array.isArray(drafts)
        ? drafts.filter((d: any) => {
            if (r._ts) return d.ts !== r._ts;
            return Number(d.invoiceId) !== r.id;
          })
        : [];
      localStorage.setItem('kwitansiDrafts', JSON.stringify(filtered));
      setRows(prev => prev.filter(x => x !== r));
    } catch {
      // fallback update state only
      setRows(prev => prev.filter(x => x !== r));
    }
  };

  return (
    <FeatureGuard feature="sales.receipt">
    <div className="sales-scope p-6 min-h-screen">
      <PageBreadcrumb pageTitle="Kwitansi Penjualan" />

      <div className="rounded-2xl border border-gray-200 bg-white p-6 min-h-[70vh] overflow-visible flex flex-col gap-4">
        {/* Toolbar */}
        <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            type="text"
            placeholder="Cari pelanggan / nomor kwitansi..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            className="h-11 w-full sm:w-64 rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:ring-3 focus:outline-hidden"
          />
          <div className="flex items-center gap-3">
            <div className="relative">
              <button onClick={() => setShowDropdown(v=>!v)} className="border px-4 py-2 rounded-md flex items-center gap-2 hover:bg-gray-50">
                <Download className="h-4 w-4" />
                Unduh & Bagikan
                <ChevronDown className="h-4 w-4" />
              </button>
              {showDropdown && (
                <div className="absolute right-0 mt-2 w-52 bg-white shadow-lg rounded-md border z-10">
                  <ul className="py-2 text-sm text-gray-700">
                    <li className="px-4 py-2 hover:bg-gray-100 cursor-pointer">Unduh Semua Dokumen</li>
                    <li className="px-4 py-2 hover:bg-gray-100 cursor-pointer" onClick={() => {
                      if (!filtered.length) { toast.error('Tidak ada data untuk diekspor'); return; }
                      downloadCSV(filtered, 'kwitansi.csv'); setShowDropdown(false);
                    }}>Ekspor data CSV</li>
                    <li className="px-4 py-2 hover:bg-gray-100 cursor-pointer" onClick={async () => {
                      if (!filtered.length) { toast.error('Tidak ada data untuk diekspor'); return; }
                      await downloadXLSX(filtered, 'kwitansi.xlsx', 'Kwitansi'); setShowDropdown(false);
                    }}>Ekspor data XLSX</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Table or Empty State */}
        <div className="overflow-x-auto overflow-y-visible rounded-lg border bg-white shadow-sm min-h-[50vh] flex-1">
          {paged.length === 0 ? (
            <EmptyState
              title="Belum ada kwitansi penjualan"
              description="Buat Kwitansi Penjualan atau kirim Invoice Penjualan untuk menyediakan beragam metode pembayaran kepada pelanggan Anda."
            />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left">Customer</th>
                  <th className="px-4 py-3 text-left">No. Kwitansi</th>
                  <th className="px-4 py-3 text-left">Tanggal</th>
                  <th className="px-4 py-3 text-right">Nilai Invoice</th>
                  <th className="px-4 py-3 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-gray-50 transition">
                    <td className="px-4 py-3">{customerText(r)}</td>
                    <td className="px-4 py-3">{r.receiptNumber}</td>
                    <td className="px-4 py-3">{r.date}</td>
                    <td className="px-4 py-3 text-right">{fmt(r.total)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center justify-end gap-2">
                        <button onClick={() => openPreview(r)} title="Lihat" className="p-2 rounded-full hover:bg-gray-100">
                          <Eye className="h-4 w-4 text-gray-600" />
                        </button>
                        <button onClick={() => sendToSJ(r)} title="Buat Surat Jalan" className="p-2 rounded-full hover:bg-gray-100">
                          <Truck className="h-4 w-4 text-indigo-600" />
                        </button>
                        <button onClick={() => downloadKw(r)} title="Download PDF" className="p-2 rounded-full hover:bg-gray-100">
                          <Download className="h-4 w-4 text-emerald-600" />
                        </button>
                        <button onClick={() => deleteDraft(r)} title="Hapus" className="p-2 rounded-full hover:bg-gray-100">
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          limit={limit}
          onLimitChange={(v) => { setLimit(v); setPage(1); }}
        />
      </div>
    </div>
    </FeatureGuard>
  );
}
