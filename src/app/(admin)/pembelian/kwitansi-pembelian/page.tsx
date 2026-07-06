"use client";
import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import { Plus, Search, Calendar, Filter, Eye, ChevronDown, ReceiptText } from "lucide-react";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { StatusBadge } from "@/components/ui/StatusBadge";
import EmptyState from "@/components/EmptyState";
import Pagination from "@/components/tables/Pagination";
import toast from "react-hot-toast";
import { fmtIDR } from "@/lib/format";

type PurchaseInvoice = {
  id: number;
  invoiceNumber: string;
  date: string;
  supplierName: string;
  total: number;
  status: string;
};

export default function KwitansiPembelianListPage() {
  const [data, setData] = useState<PurchaseInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (status) params.set("status", status);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      params.set("pageSize", "100"); // Load more for client-side pagination simplicity here
      
      const res = await fetch(`/api/purchases/invoices?${params.toString()}`, { cache: 'no-store' });
      const json = await res.json();
      setData(json.data || []);
    } catch (e) {
      toast.error("Gagal memuat data kwitansi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const paged = useMemo(() => {
    const start = (page - 1) * limit;
    return data.slice(start, start + limit);
  }, [data, page, limit]);

  const totalPages = Math.max(1, Math.ceil(data.length / limit));

  return (
    <div className="p-6 space-y-6 min-h-screen bg-gray-50/30">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageBreadcrumb pageTitle="Kwitansi Pembelian" />
        <Link 
          href="/pembelian/kwitansi-pembelian/add" 
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition shadow-sm"
        >
          <Plus className="h-5 w-5" />
          <span>Buat Kwitansi</span>
        </Link>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        {/* Filters */}
        <div className="flex flex-wrap items-end gap-4 mb-6">
          <div className="flex-1 min-w-[240px]">
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider text-sm font-semibold">Cari</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input 
                value={q} 
                onChange={e=>setQ(e.target.value)} 
                placeholder="Nomor Kwitansi/Supplier..." 
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition text-sm"
              />
            </div>
          </div>
          <div className="w-44">
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider text-sm font-semibold">Status</label>
            <div className="relative">
              <select 
                value={status} 
                onChange={e=>setStatus(e.target.value)} 
                className="w-full appearance-none pl-4 pr-10 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition text-sm bg-transparent"
              >
                <option value="">Semua Status</option>
                <option value="Draft">Draft</option>
                <option value="Paid">Paid</option>
                <option value="Canceled">Canceled</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div className="w-40">
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider text-sm font-semibold">Dari</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input 
                type="date" 
                value={dateFrom} 
                onChange={e=>setDateFrom(e.target.value)} 
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition text-sm" 
              />
            </div>
          </div>
          <div className="w-40">
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider text-sm font-semibold">Sampai</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input 
                type="date" 
                value={dateTo} 
                onChange={e=>setDateTo(e.target.value)} 
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition text-sm" 
              />
            </div>
          </div>
          <button 
            onClick={load} 
            className="px-5 py-2 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition shadow-sm h-[38px] flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            Filter
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-sm text-gray-500">
            <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <div>Memuat data kwitansi...</div>
          </div>
        ) : data.length === 0 ? (
          <EmptyState 
            title="Belum ada kwitansi pembelian" 
            description="Mulai catat transaksi pembelian Anda dengan membuat kwitansi baru." 
          />
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50/50 text-gray-600 font-semibold border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left">Nomor Kwitansi</th>
                    <th className="px-4 py-3 text-left">Tanggal</th>
                    <th className="px-4 py-3 text-left">Supplier</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paged.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50/50 transition">
                      <td className="px-4 py-4 font-medium text-gray-900">{p.invoiceNumber}</td>
                      <td className="px-4 py-4 text-gray-600 font-medium">{new Date(p.date).toLocaleDateString('id-ID')}</td>
                      <td className="px-4 py-4 text-gray-600 font-medium">{p.supplierName}</td>
                      <td className="px-4 py-4 text-right font-semibold text-gray-900">{fmtIDR(p.total)}</td>
                      <td className="px-4 py-4">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="px-4 py-4 text-right">
                        <Link 
                          href={`/pembelian/kwitansi-pembelian/${p.id}`} 
                          className="inline-flex items-center justify-center p-2 rounded-lg hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-200 transition text-indigo-600"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-100">
              <Pagination 
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
                limit={limit}
                onLimitChange={(v) => { setLimit(v); setPage(1); }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
