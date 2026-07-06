"use client";
import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import { Plus, Search, Calendar, Filter, Eye, ChevronDown } from "lucide-react";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { StatusBadge } from "@/components/ui/StatusBadge";
import EmptyState from "@/components/EmptyState";
import Pagination from "@/components/tables/Pagination";
import toast from "react-hot-toast";

type Purchase = {
  id: number;
  purchaseNumber: string;
  date: string;
  supplierName: string;
  status: string;
  items: { id: number; name: string; qty: number; unit: string }[];
};

export default function PembelianLangsungListPage() {
  const [data, setData] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [brandId, setBrandId] = useState<string>("");
  
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
      if (brandId) params.set("brandId", brandId);
      const res = await fetch(`/api/purchases/direct${params.toString() ? `?${params.toString()}` : ""}`, { cache: 'no-store' });
      const json = await res.json();
      setData(json.data || []);
    } catch (e) {
      toast.error("Gagal memuat data pembelian");
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
        <PageBreadcrumb pageTitle="Pembelian Langsung" />
        <Link 
          href="/pembelian/pembelian-langsung/add" 
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition shadow-sm"
        >
          <Plus className="h-5 w-5" />
          <span>Tambah Pembelian</span>
        </Link>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        {/* Filters */}
        <div className="flex flex-wrap items-end gap-4 mb-6">
          <div className="flex-1 min-w-[240px]">
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Cari</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input 
                value={q} 
                onChange={e=>setQ(e.target.value)} 
                placeholder="Nomor/Supplier..." 
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition text-sm"
              />
            </div>
          </div>
          <div className="w-44">
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Status</label>
            <div className="relative">
              <select 
                value={status} 
                onChange={e=>setStatus(e.target.value)} 
                className="w-full appearance-none pl-4 pr-10 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition text-sm bg-transparent"
              >
                <option value="">Semua Status</option>
                <option value="Draft">Draft</option>
                <option value="Received">Received</option>
                <option value="Canceled">Canceled</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div className="w-40">
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Dari</label>
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
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Sampai</label>
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
            Terapkan
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <div className="text-gray-500 font-medium">Memuat data...</div>
          </div>
        ) : data.length === 0 ? (
          <EmptyState 
            title="Belum ada data pembelian" 
            description="Silakan tambah pembelian langsung untuk mulai mencatat pengeluaran stok Anda." 
          />
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50/50 text-gray-600 font-medium">
                  <tr>
                    <th className="px-4 py-3 text-left">Nomor</th>
                    <th className="px-4 py-3 text-left">Tanggal</th>
                    <th className="px-4 py-3 text-left">Supplier</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-center">Item</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paged.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50/50 transition">
                      <td className="px-4 py-3 font-medium text-gray-900">{p.purchaseNumber}</td>
                      <td className="px-4 py-3 text-gray-600">{new Date(p.date).toLocaleDateString('id-ID')}</td>
                      <td className="px-4 py-3 text-gray-600">{p.supplierName}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-1 bg-gray-100 rounded-md text-xs font-medium text-gray-600">
                          {p.items?.length || 0} items
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link 
                          href={`/pembelian/pembelian-langsung/${p.id}`} 
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
