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
  return v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
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

  // Load brands for selector (limited by user's scope server-side on fetch)
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
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (brandIdsParam) params.set("brandIds", brandIdsParam);
      if (aggregateMode) params.set("aggregateMode", aggregateMode);
      if (client) params.set("client", client);
      if (supplier) params.set("supplier", supplier);
      const res = await fetch(`/api/reports/rekap?${params.toString()}`);
      const j = (await res.json()) as ReportResponse;
      setData(j);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function exportCsv(kind: "sales" | "purchases" | "ar" | "ap" | "stock" | "expenses") {
    if (!data) return;
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    if (kind === "sales") {
      const headers = ["Number", "Date", "Customer", "Total", "Paid", "Due", "Brand"];
      const rows = data.sales.rows.map((r: any) => [r.number, r.date?.slice?.(0, 10) ?? "", r.customer, r.total, r.paid, r.due, r.brandName]);
      downloadBlob(toCsv(headers, rows), `rekap-sales-${ts}.csv`);
    } else if (kind === "purchases") {
      const headers = ["Number", "Date", "Supplier", "Total", "Paid", "Due", "Brand"];
      const rows = data.purchases.rows.map((r: any) => [r.number, r.date?.slice?.(0, 10) ?? "", r.supplier, r.total, r.paid, r.due, r.brandName]);
      downloadBlob(toCsv(headers, rows), `rekap-purchases-${ts}.csv`);
    } else if (kind === "expenses") {
      const headers = ["ID", "Date", "Category", "Amount", "Paid", "Brand"];
      const rows = data.expenses.rows.map((r: any) => [r.id, r.date?.slice?.(0, 10) ?? "", r.category, r.amount, r.paid ? "Yes" : "No", r.brandName]);
      downloadBlob(toCsv(headers, rows), `rekap-expenses-${ts}.csv`);
    } else if (kind === "ar") {
      const headers = ["Type", "Number", "Date", "Customer", "Total", "Paid", "Due", "Brand"];
      const rows = data.ar.rows.map((r: any) => [r.type, r.number, (r.date || "").slice(0, 10), r.customer, r.total, r.paid, r.due, r.brandName]);
      downloadBlob(toCsv(headers, rows), `rekap-ar-${ts}.csv`);
    } else if (kind === "ap") {
      const headers = ["Type", "Number", "Date", "Supplier", "Total", "Paid", "Due", "Brand"];
      const rows = data.ap.rows.map((r: any) => [r.type, r.number, (r.date || "").slice(0, 10), r.supplier, r.total, r.paid, r.due, r.brandName]);
      downloadBlob(toCsv(headers, rows), `rekap-ap-${ts}.csv`);
    } else if (kind === "stock") {
      const headers = ["Product", "SKU", "Qty", "Unit", "Brand"];
      const rows = data.stock.rows.map((r: any) => [r.name, r.sku, r.qty, r.unit, r.brandName]);
      downloadBlob(toCsv(headers, rows), `rekap-stock-${ts}.csv`);
    }
  }

  function handlePrint() {
    window.print();
  }

  const brandOptions = brands;

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Reporting & Rekap</h1>
        <div className="space-x-2">
          <button onClick={() => exportCsv("sales")} className="px-3 py-1 border rounded">Export Sales</button>
          <button onClick={() => exportCsv("purchases")} className="px-3 py-1 border rounded">Export Purchases</button>
          <button onClick={() => exportCsv("expenses")} className="px-3 py-1 border rounded">Export Expenses</button>
          <button onClick={() => exportCsv("ar")} className="px-3 py-1 border rounded">Export A/R</button>
          <button onClick={() => exportCsv("ap")} className="px-3 py-1 border rounded">Export A/P</button>
          <button onClick={() => exportCsv("stock")} className="px-3 py-1 border rounded">Export Stock</button>
          <button onClick={handlePrint} className="px-3 py-1 border rounded">Print PDF</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
        <div className="flex flex-col">
          <label className="text-sm">Dari</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="border px-2 py-1 rounded" />
        </div>
        <div className="flex flex-col">
          <label className="text-sm">Sampai</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="border px-2 py-1 rounded" />
        </div>
        <div className="flex flex-col md:col-span-2">
          <label className="text-sm">Brand</label>
          <select multiple value={selectedBrandIds.map(String)} onChange={(e) => {
            const arr = Array.from(e.target.selectedOptions).map((o) => Number(o.value));
            setSelectedBrandIds(arr);
          }} className="border px-2 py-1 rounded min-h-[38px]">
            {brandOptions.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <small className="text-gray-500">Owner dapat memilih banyak brand. Admin/Staff dibatasi.</small>
        </div>
        <div className="flex flex-col">
          <label className="text-sm">Mode Agregasi</label>
          <select value={aggregateMode} onChange={(e) => setAggregateMode(e.target.value as any)} className="border px-2 py-1 rounded">
            <option value="ALL">Gabung (Lintas Brand)</option>
            <option value="PER_BRAND">Per Brand</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className="flex flex-col">
          <label className="text-sm">Client (opsional)</label>
          <input value={client} onChange={(e) => setClient(e.target.value)} className="border px-2 py-1 rounded" placeholder="Nama client" />
        </div>
        <div className="flex flex-col">
          <label className="text-sm">Supplier (opsional)</label>
          <input value={supplier} onChange={(e) => setSupplier(e.target.value)} className="border px-2 py-1 rounded" placeholder="Nama supplier" />
        </div>
        <div className="flex items-end">
          <button onClick={fetchReport} className="px-4 py-2 border rounded w-full md:w-auto" disabled={loading}>{loading ? "Memuat..." : "Terapkan Filter"}</button>
        </div>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6 print:grid-cols-6">
            <div className="p-3 border rounded">
              <div className="text-xs text-gray-500">Total Penjualan</div>
              <div className="text-xl font-semibold">{fmt(data.grossProfit.components.salesTotal)}</div>
            </div>
            <div className="p-3 border rounded">
              <div className="text-xs text-gray-500">Total Pembelian</div>
              <div className="text-xl font-semibold">{fmt(data.grossProfit.components.purchaseTotal)}</div>
            </div>
            <div className="p-3 border rounded">
              <div className="text-xs text-gray-500">Total Expense</div>
              <div className="text-xl font-semibold">{fmt(data.grossProfit.components.expenseTotal)}</div>
            </div>
            <div className="p-3 border rounded">
              <div className="text-xs text-gray-500">Laba Kotor</div>
              <div className="text-xl font-semibold">{fmt(data.grossProfit.amount)}</div>
            </div>
            <div className="p-3 border rounded">
              <div className="text-xs text-gray-500">Piutang (A/R)</div>
              <div className="text-xl font-semibold">{fmt(data.ar.totalDue)}</div>
            </div>
            <div className="p-3 border rounded">
              <div className="text-xs text-gray-500">Hutang (A/P)</div>
              <div className="text-xl font-semibold">{fmt(data.ap.totalDue)}</div>
            </div>
          </div>

          {data.brandSummary?.mode === "PER_BRAND" && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-2">Ringkasan Per Brand</h2>
              <div className="overflow-auto">
                <table className="min-w-full border text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border px-2 py-1 text-left">Brand</th>
                      <th className="border px-2 py-1 text-right">Sales</th>
                      <th className="border px-2 py-1 text-right">Purchases</th>
                      <th className="border px-2 py-1 text-right">Expenses</th>
                      <th className="border px-2 py-1 text-right">Gross Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.brandSummary.rows.map((r) => (
                      <tr key={r.brandId}>
                        <td className="border px-2 py-1">{r.brandName}</td>
                        <td className="border px-2 py-1 text-right">{fmt(r.salesTotal)}</td>
                        <td className="border px-2 py-1 text-right">{fmt(r.purchaseTotal)}</td>
                        <td className="border px-2 py-1 text-right">{fmt(r.expenseTotal)}</td>
                        <td className="border px-2 py-1 text-right">{fmt(r.grossProfit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-2">Rekap Penjualan</h2>
            <div className="overflow-auto">
              <table className="min-w-full border text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border px-2 py-1 text-left">No</th>
                    <th className="border px-2 py-1 text-left">Tanggal</th>
                    <th className="border px-2 py-1 text-left">Customer</th>
                    <th className="border px-2 py-1 text-right">Total</th>
                    <th className="border px-2 py-1 text-right">Paid</th>
                    <th className="border px-2 py-1 text-right">Due</th>
                    <th className="border px-2 py-1 text-left">Brand</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sales.rows.map((r: any) => (
                    <tr key={r.id}>
                      <td className="border px-2 py-1">{r.number}</td>
                      <td className="border px-2 py-1">{(r.date || "").slice(0, 10)}</td>
                      <td className="border px-2 py-1">{r.customer}</td>
                      <td className="border px-2 py-1 text-right">{fmt(r.total)}</td>
                      <td className="border px-2 py-1 text-right">{fmt(r.paid)}</td>
                      <td className="border px-2 py-1 text-right">{fmt(r.due)}</td>
                      <td className="border px-2 py-1">{r.brandName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-2">Rekap Pembelian</h2>
            <div className="overflow-auto">
              <table className="min-w-full border text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border px-2 py-1 text-left">No</th>
                    <th className="border px-2 py-1 text-left">Tanggal</th>
                    <th className="border px-2 py-1 text-left">Supplier</th>
                    <th className="border px-2 py-1 text-right">Total</th>
                    <th className="border px-2 py-1 text-right">Paid</th>
                    <th className="border px-2 py-1 text-right">Due</th>
                    <th className="border px-2 py-1 text-left">Brand</th>
                  </tr>
                </thead>
                <tbody>
                  {data.purchases.rows.map((r: any) => (
                    <tr key={r.id}>
                      <td className="border px-2 py-1">{r.number}</td>
                      <td className="border px-2 py-1">{(r.date || "").slice(0, 10)}</td>
                      <td className="border px-2 py-1">{r.supplier}</td>
                      <td className="border px-2 py-1 text-right">{fmt(r.total)}</td>
                      <td className="border px-2 py-1 text-right">{fmt(r.paid)}</td>
                      <td className="border px-2 py-1 text-right">{fmt(r.due)}</td>
                      <td className="border px-2 py-1">{r.brandName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-2">Piutang (A/R)</h2>
            <div className="overflow-auto">
              <table className="min-w-full border text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border px-2 py-1 text-left">Type</th>
                    <th className="border px-2 py-1 text-left">No</th>
                    <th className="border px-2 py-1 text-left">Tanggal</th>
                    <th className="border px-2 py-1 text-left">Customer</th>
                    <th className="border px-2 py-1 text-right">Total</th>
                    <th className="border px-2 py-1 text-right">Paid</th>
                    <th className="border px-2 py-1 text-right">Due</th>
                    <th className="border px-2 py-1 text-left">Brand</th>
                  </tr>
                </thead>
                <tbody>
                  {data.ar.rows.map((r: any) => (
                    <tr key={`${r.type}-${r.id}`}>
                      <td className="border px-2 py-1">{r.type}</td>
                      <td className="border px-2 py-1">{r.number}</td>
                      <td className="border px-2 py-1">{(r.date || "").slice(0, 10)}</td>
                      <td className="border px-2 py-1">{r.customer}</td>
                      <td className="border px-2 py-1 text-right">{fmt(r.total)}</td>
                      <td className="border px-2 py-1 text-right">{fmt(r.paid)}</td>
                      <td className="border px-2 py-1 text-right">{fmt(r.due)}</td>
                      <td className="border px-2 py-1">{r.brandName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-2">Hutang (A/P)</h2>
            <div className="overflow-auto">
              <table className="min-w-full border text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border px-2 py-1 text-left">Type</th>
                    <th className="border px-2 py-1 text-left">No</th>
                    <th className="border px-2 py-1 text-left">Tanggal</th>
                    <th className="border px-2 py-1 text-left">Supplier</th>
                    <th className="border px-2 py-1 text-right">Total</th>
                    <th className="border px-2 py-1 text-right">Paid</th>
                    <th className="border px-2 py-1 text-right">Due</th>
                    <th className="border px-2 py-1 text-left">Brand</th>
                  </tr>
                </thead>
                <tbody>
                  {data.ap.rows.map((r: any) => (
                    <tr key={`${r.type}-${r.id}`}>
                      <td className="border px-2 py-1">{r.type}</td>
                      <td className="border px-2 py-1">{r.number}</td>
                      <td className="border px-2 py-1">{(r.date || "").slice(0, 10)}</td>
                      <td className="border px-2 py-1">{r.supplier}</td>
                      <td className="border px-2 py-1 text-right">{fmt(r.total)}</td>
                      <td className="border px-2 py-1 text-right">{fmt(r.paid)}</td>
                      <td className="border px-2 py-1 text-right">{fmt(r.due)}</td>
                      <td className="border px-2 py-1">{r.brandName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-2">Rekap Stok</h2>
            <div className="overflow-auto">
              <table className="min-w-full border text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border px-2 py-1 text-left">Produk</th>
                    <th className="border px-2 py-1 text-left">SKU</th>
                    <th className="border px-2 py-1 text-right">Qty</th>
                    <th className="border px-2 py-1 text-left">Unit</th>
                    <th className="border px-2 py-1 text-left">Brand</th>
                  </tr>
                </thead>
                <tbody>
                  {data.stock.rows.map((r: any) => (
                    <tr key={r.productId}>
                      <td className="border px-2 py-1">{r.name}</td>
                      <td className="border px-2 py-1">{r.sku}</td>
                      <td className="border px-2 py-1 text-right">{r.qty}</td>
                      <td className="border px-2 py-1">{r.unit}</td>
                      <td className="border px-2 py-1">{r.brandName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

