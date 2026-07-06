"use client";

import React, { useEffect, useMemo, useState } from "react";

type Brand = { id: number; name: string };

type ReportResponse = {
  success: boolean;
  filters: { dateFrom: string | null; dateTo: string | null; brandIds: number[]; aggregateMode: string };
  sales: { total: number; count: number; rows: any[] };
  purchases: { total: number; count: number; rows: any[] };
  expenses: { total: number; count: number; rows: any[] };
  ar: { totalDue: number; count: number; rows: any[] };
  ap: { totalDue: number; count: number; rows: any[] };
  grossProfit: { amount: number; components: { salesTotal: number; purchaseTotal: number; expenseTotal: number } };
  stock: { rows: any[]; totalProducts: number; totalQty: number };
  brandSummary: { mode: string; rows: { brandId: number; brandName: string; salesTotal: number; purchaseTotal: number; expenseTotal: number; grossProfit: number }[] };
};

function fmt(n: number | null | undefined) {
  const v = Number(n || 0);
  return "Rp " + v.toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function toCsv(headers: string[], rows: (string | number | null | undefined)[][]) {
  const esc = (s: any) => {
    const str = s == null ? "" : String(s);
    if (str.includes(",") || str.includes("\n") || str.includes('"')) return '"' + str.replaceAll('"', '""') + '"';
    return str;
  };
  const lines = [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))];
  return new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function ReportingRekapPage() {
  const today = useMemo(() => new Date(), []);
  const firstDay = useMemo(() => new Date(today.getFullYear(), today.getMonth(), 1), [today]);
  const [dateFrom, setDateFrom] = useState<string>(firstDay.toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState<string>(today.toISOString().slice(0, 10));
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrandIds, setSelectedBrandIds] = useState<number[]>([]);
  const [aggregateMode, setAggregateMode] = useState<"ALL" | "PER_BRAND">("ALL");
  const [client, setClient] = useState<string>("");
  const [supplier, setSupplier] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ReportResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load brands for selector
  useEffect(() => {
    let ignore = false;
    async function loadBrands() {
      try {
        const res = await fetch("/api/brand-profiles");
        if (!res.ok) return;
        const j = await res.json();
        if (!ignore && Array.isArray(j?.data)) setBrands(j.data.map((b: any) => ({ id: b.id, name: b.name })));
      } catch {}
    }
    loadBrands();
    return () => {
      ignore = true;
    };
  }, []);

  const brandIdsParam = useMemo(() => (selectedBrandIds.length ? selectedBrandIds.join(",") : ""), [selectedBrandIds]);

  async function fetchReport() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (brandIdsParam) params.set("brandIds", brandIdsParam);
      if (aggregateMode) params.set("aggregateMode", aggregateMode);
      if (client) params.set("client", client);
      if (supplier) params.set("supplier", supplier);
      const res = await fetch(`/api/reports/rekap?${params.toString()}`);
      if (!res.ok) throw new Error(`Gagal: ${res.status}`);
      const j = (await res.json()) as ReportResponse;
      if (!j.success) {
        setErrorMsg("Gagal memuat laporan.");
        setData(null);
      } else {
        setData(j);
      }
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || "Terjadi galat.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchReport();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setDatePreset = (preset: "today" | "week" | "month" | "year" | "all") => {
    const end = new Date();
    let start = new Date();
    if (preset === "today") start = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    else if (preset === "week") start.setDate(end.getDate() - 7);
    else if (preset === "month") start = new Date(end.getFullYear(), end.getMonth(), 1);
    else if (preset === "year") start = new Date(end.getFullYear(), 0, 1);
    else if (preset === "all") start = new Date(2020, 0, 1);
    setDateFrom(start.toISOString().slice(0, 10));
    setDateTo(end.toISOString().slice(0, 10));
  };

  function exportCsv(kind: "sales" | "purchases" | "ar" | "ap" | "stock" | "expenses") {
    if (!data) return;
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    if (kind === "sales") {
      const headers = ["Number", "Date", "Customer", "Total", "Paid", "Due", "Brand"];
      const rows = data.sales?.rows?.map((r: any) => [r.number, r.date?.slice?.(0, 10) ?? "", r.customer, r.total, r.paid, r.due, r.brandName]) ?? [];
      downloadBlob(toCsv(headers, rows), `rekap-sales-${ts}.csv`);
    } else if (kind === "purchases") {
      const headers = ["Number", "Date", "Supplier", "Total", "Paid", "Due", "Brand"];
      const rows = data.purchases?.rows?.map((r: any) => [r.number, r.date?.slice?.(0, 10) ?? "", r.supplier, r.total, r.paid, r.due, r.brandName]) ?? [];
      downloadBlob(toCsv(headers, rows), `rekap-purchases-${ts}.csv`);
    } else if (kind === "expenses") {
      const headers = ["ID", "Date", "Category", "Amount", "Paid", "Brand"];
      const rows = data.expenses?.rows?.map((r: any) => [r.id, r.date?.slice?.(0, 10) ?? "", r.category, r.amount, r.paid ? "Yes" : "No", r.brandName]) ?? [];
      downloadBlob(toCsv(headers, rows), `rekap-expenses-${ts}.csv`);
    } else if (kind === "ar") {
      const headers = ["Type", "Number", "Date", "Customer", "Total", "Paid", "Due", "Brand"];
      const rows = data.ar?.rows?.map((r: any) => [r.type, r.number, (r.date || "").slice(0, 10), r.customer, r.total, r.paid, r.due, r.brandName]) ?? [];
      downloadBlob(toCsv(headers, rows), `rekap-ar-${ts}.csv`);
    } else if (kind === "ap") {
      const headers = ["Type", "Number", "Date", "Supplier", "Total", "Paid", "Due", "Brand"];
      const rows = data.ap?.rows?.map((r: any) => [r.type, r.number, (r.date || "").slice(0, 10), r.supplier, r.total, r.paid, r.due, r.brandName]) ?? [];
      downloadBlob(toCsv(headers, rows), `rekap-ap-${ts}.csv`);
    } else if (kind === "stock") {
      const headers = ["Product", "SKU", "Qty", "Unit", "Brand"];
      const rows = data.stock?.rows?.map((r: any) => [r.name, r.sku, r.qty, r.unit, r.brandName]) ?? [];
      downloadBlob(toCsv(headers, rows), `rekap-stock-${ts}.csv`);
    }
  }

  function handlePrint() {
    window.print();
  }

  const brandOptions = brands;

  return (
    <div className="p-4 md:p-8 bg-slate-50/50 min-h-screen font-sans">
      <div className="max-w-[1600px] mx-auto">
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-10 gap-6">
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">
              Business <span className="text-indigo-600">Insights</span>
            </h1>
            <div className="flex items-center gap-2 text-slate-500 font-medium">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              Real-time financial performance overview
            </div>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <button 
              onClick={handlePrint}
              className="group inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 shadow-sm hover:border-indigo-300 hover:text-indigo-600 transition-all active:scale-95"
            >
              <svg className="w-4 h-4 group-hover:rotate-12 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2-2H7a2 2 0 00-2 2v4m14 0h2" /></svg>
              Generate PDF
            </button>
            
            <div className="relative group">
              <button className="inline-flex items-center gap-2 px-6 py-2.5 bg-slate-900 rounded-2xl text-sm font-bold text-white shadow-xl shadow-slate-200 hover:bg-indigo-600 hover:shadow-indigo-100 transition-all active:scale-95">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Export Datasets
              </button>
              <div className="absolute right-0 mt-3 w-56 bg-white/80 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-30 overflow-hidden translate-y-2 group-hover:translate-y-0">
                <div className="p-2 space-y-1">
                  <button onClick={() => exportCsv("sales")} className="w-full text-left px-4 py-2 text-xs font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 rounded-xl transition">Sales Records (.csv)</button>
                  <button onClick={() => exportCsv("purchases")} className="w-full text-left px-4 py-2 text-xs font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 rounded-xl transition">Purchase Records (.csv)</button>
                  <button onClick={() => exportCsv("expenses")} className="w-full text-left px-4 py-2 text-xs font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 rounded-xl transition">Expense Logs (.csv)</button>
                  <div className="h-px bg-slate-100 my-1"></div>
                  <button onClick={() => exportCsv("stock")} className="w-full text-left px-4 py-2 text-xs font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 rounded-xl transition">Inventory Snapshot (.csv)</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters Card */}
        <div className="bg-white/70 backdrop-blur-md rounded-[32px] border border-white shadow-2xl shadow-slate-200/50 p-8 mb-12">
          <div className="flex flex-col gap-8">
            <div className="flex items-center justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <div className="px-3 py-1 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-lg mr-2">Quick Select</div>
                {["today", "week", "month", "year", "all"].map((p) => (
                  <button 
                    key={p} 
                    onClick={() => setDatePreset(p as any)} 
                    className="px-4 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wider bg-white border border-slate-100 text-slate-500 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 transition-all shadow-sm capitalize"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Start Date</label>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full bg-slate-50 border-none px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 transition shadow-inner" />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">End Date</label>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full bg-slate-50 border-none px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 transition shadow-inner" />
              </div>
              <div className="space-y-2 lg:col-span-2">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Target Brands</label>
                <select 
                  multiple 
                  value={selectedBrandIds.map(String)} 
                  onChange={(e) => {
                    const arr = Array.from(e.target.selectedOptions).map((o) => Number(o.value));
                    setSelectedBrandIds(arr);
                  }} 
                  className="w-full bg-slate-50 border-none px-4 py-2 rounded-2xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 transition shadow-inner min-h-[46px]"
                >
                  {brandOptions.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Aggregation</label>
                <select value={aggregateMode} onChange={(e) => setAggregateMode(e.target.value as any)} className="w-full bg-slate-50 border-none px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 transition shadow-inner">
                  <option value="ALL">Unified</option>
                  <option value="PER_BRAND">Split</option>
                </select>
              </div>
              <div className="flex items-end">
                <button 
                  onClick={fetchReport} 
                  className="w-full px-6 py-3.5 bg-gradient-to-br from-indigo-600 to-violet-700 text-white rounded-2xl text-sm font-black shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50" 
                  disabled={loading}
                >
                  {loading ? "..." : "REFRESH"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {data && (
          <div className="space-y-12">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
              <div className="relative overflow-hidden bg-white p-7 rounded-[32px] border border-slate-100 shadow-xl group">
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-emerald-500 text-white rounded-2xl">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                    </div>
                    <div>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Revenue</div>
                      <div className="text-xs font-bold text-emerald-600">Total Invoiced</div>
                    </div>
                  </div>
                  <div className="text-3xl font-black text-slate-900 mb-1">{fmt(data.grossProfit?.components?.salesTotal)}</div>
                </div>
              </div>

              <div className="relative overflow-hidden bg-white p-7 rounded-[32px] border border-slate-100 shadow-xl group">
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-rose-500 text-white rounded-2xl">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                    </div>
                    <div>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Spending</div>
                      <div className="text-xs font-bold text-rose-600">OPEX & COGS</div>
                    </div>
                  </div>
                  <div className="text-3xl font-black text-slate-900 mb-1">{fmt(Number(data.grossProfit?.components?.purchaseTotal || 0) + Number(data.grossProfit?.components?.expenseTotal || 0))}</div>
                </div>
              </div>

              <div className="relative overflow-hidden bg-slate-900 p-7 rounded-[32px] shadow-2xl group">
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-indigo-500 text-white rounded-2xl">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                    </div>
                    <div>
                      <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Profit</div>
                      <div className="text-xs font-bold text-indigo-400">Net Surplus</div>
                    </div>
                  </div>
                  <div className="text-3xl font-black text-white mb-1">{fmt(data.grossProfit?.amount)}</div>
                </div>
              </div>

              <div className="relative overflow-hidden bg-white p-7 rounded-[32px] border border-slate-100 shadow-xl group">
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-amber-500 text-white rounded-2xl">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                    </div>
                    <div>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inventory</div>
                      <div className="text-xs font-bold text-amber-600">Assets</div>
                    </div>
                  </div>
                  <div className="text-3xl font-black text-slate-900 mb-1">{data.stock?.totalQty ?? 0} <span className="text-xs font-medium text-slate-400">Items</span></div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
              <div className="xl:col-span-8 space-y-10">
                <div className="bg-white rounded-[40px] border border-slate-100 shadow-2xl overflow-hidden">
                  <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest">Recent Sales</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
                          <th className="px-8 py-5">Reference</th>
                          <th className="px-8 py-5">Customer</th>
                          <th className="px-8 py-5 text-right">Value</th>
                          <th className="px-8 py-5 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {data.sales?.rows?.map((r: any) => (
                          <tr key={r.id} className="hover:bg-slate-50 transition-colors cursor-default">
                            <td className="px-8 py-5">
                              <div className="font-black text-slate-900 text-sm">{r.number}</div>
                              <div className="text-[10px] font-bold text-slate-400">{(r.date || "").slice(0, 10)}</div>
                            </td>
                            <td className="px-8 py-5">
                              <div className="font-bold text-slate-700 text-sm">{r.customer}</div>
                              <div className="text-[10px] font-bold text-indigo-400 uppercase">{r.brandName}</div>
                            </td>
                            <td className="px-8 py-5 text-right font-black text-slate-900 text-sm">{fmt(r.total)}</td>
                            <td className="px-8 py-5 text-right">
                               <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase ${Number(r.due || 0) > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                 {Number(r.due || 0) > 0 ? `Unpaid: ${fmt(r.due)}` : 'Lunas'}
                               </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-white rounded-[40px] border border-slate-100 shadow-2xl overflow-hidden">
                  <div className="px-8 py-6 bg-slate-50 border-b border-slate-100">
                    <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest">Recent Purchases</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
                          <th className="px-8 py-5">PO Number</th>
                          <th className="px-8 py-5">Supplier</th>
                          <th className="px-8 py-5 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {data.purchases?.rows?.map((r: any) => (
                          <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-8 py-5 font-black text-slate-900 text-sm">{r.number}</td>
                            <td className="px-8 py-5 font-bold text-slate-700 text-sm">{r.supplier}</td>
                            <td className="px-8 py-5 text-right font-black text-slate-900 text-sm">{fmt(r.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="xl:col-span-4 space-y-8">
                <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-2xl">
                  <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-10 text-center">Brand Share</h2>
                  <div className="space-y-8">
                    {data.brandSummary?.rows?.map((r) => {
                      const max = Math.max(...(data.brandSummary?.rows?.map(x => x.salesTotal) || [1]));
                      const pct = Math.round((r.salesTotal / (max || 1)) * 100);
                      return (
                        <div key={r.brandId}>
                          <div className="flex justify-between items-end mb-2">
                            <div className="text-xs font-black text-slate-900">{r.brandName}</div>
                            <div className="text-xs font-black text-indigo-500">{pct}%</div>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-4">
                   <div className="bg-indigo-600 p-8 rounded-[40px] shadow-2xl">
                     <div className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-2">A/R Receivables</div>
                     <div className="text-3xl font-black text-white">{fmt(data.ar?.totalDue)}</div>
                   </div>
                   <div className="bg-rose-600 p-8 rounded-[40px] shadow-2xl text-white">
                     <div className="text-[10px] font-black text-rose-200 uppercase tracking-widest mb-2">A/P Payables</div>
                     <div className="text-3xl font-black">{fmt(data.ap?.totalDue)}</div>
                   </div>
                </div>

                <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-2xl">
                  <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-6">Stock Alert</h2>
                  <div className="space-y-4">
                    {data.stock?.rows?.slice(0, 5).map((r: any) => (
                      <div key={r.productId} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                        <div className="min-w-0 pr-2">
                          <div className="text-xs font-black text-slate-900 truncate">{r.name}</div>
                          <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{r.sku}</div>
                        </div>
                        <div className={`text-sm font-black ${r.qty <= 5 ? 'text-rose-600' : 'text-slate-900'}`}>{r.qty}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
