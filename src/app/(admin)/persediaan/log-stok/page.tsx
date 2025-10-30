"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Row = {
  id: number;
  productId: number | null;
  qty: number;
  type: "IN" | "OUT" | "ADJUST";
  refTable: string | null;
  refId: number | null;
  note?: string | null;
  createdAt: string;
  product?: { id: number; name: string; sku?: string | null } | null;
};

export default function StockLogPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [count, setCount] = useState(0);

  const [productName, setProductName] = useState("");
  const [type, setType] = useState<"" | "IN" | "OUT" | "ADJUST">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [totalIn, setTotalIn] = useState(0);
  const [totalOut, setTotalOut] = useState(0);

  const fetchData = async (pg = page) => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      qs.set("page", String(pg));
      qs.set("pageSize", String(pageSize));
      if (productName.trim()) qs.set("productName", productName.trim());
      if (type) qs.set("type", type);
      if (dateFrom) qs.set("dateFrom", dateFrom);
      if (dateTo) qs.set("dateTo", dateTo);
      qs.set("includeProduct", "true");
      const res = await fetch(`/api/stock-mutations?${qs.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || json?.success === false) throw new Error(json?.message || "Gagal memuat data");
      const data: Row[] = Array.isArray(json?.data) ? json.data : [];
      setRows(data);
      setCount(Number(json?.count || 0));
      setTotalIn(Number(json?.totalIn || 0));
      setTotalOut(Number(json?.totalOut || 0));
      setPage(pg);
    } catch (e: any) {
      setError(e?.message || "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  };

  const totalPages = useMemo(() => Math.max(1, Math.ceil(count / pageSize)), [count, pageSize]);

  useEffect(() => {
    fetchData(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilters = () => fetchData(1);

  const refHref = (r: Row) => {
    const t = (r.refTable || "").toLowerCase();
    if (t === "purchasedirect") return `/pembelian/pembelian-langsung/${r.refId}`;
    if (t === "salesorder") return `/penjualan/order-penjualan/${r.refId}`;
    return "#";
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Log Stok</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-white p-4 rounded border">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Produk</label>
          <input value={productName} onChange={(e) => setProductName(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="Nama produk" />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Tipe</label>
          <select value={type} onChange={(e) => setType(e.target.value as any)} className="w-full border rounded px-3 py-2">
            <option value="">Semua</option>
            <option value="IN">IN</option>
            <option value="OUT">OUT</option>
            <option value="ADJUST">ADJUST</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Dari Tanggal</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full border rounded px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Sampai Tanggal</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full border rounded px-3 py-2" />
        </div>
        <div className="md:col-span-4 flex gap-2 justify-end">
          <button onClick={() => { setProductName(""); setType(""); setDateFrom(""); setDateTo(""); fetchData(1); }} className="px-3 py-2 rounded border">Reset</button>
          <button onClick={applyFilters} className="px-3 py-2 rounded bg-blue-600 text-white">Terapkan</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded border p-3">
          <div className="text-sm text-gray-600">Total IN</div>
          <div className="text-2xl font-semibold text-green-600">{totalIn}</div>
        </div>
        <div className="bg-white rounded border p-3">
          <div className="text-sm text-gray-600">Total OUT</div>
          <div className="text-2xl font-semibold text-red-600">{totalOut}</div>
        </div>
        <div className="bg-white rounded border p-3">
          <div className="text-sm text-gray-600">Halaman</div>
          <div className="text-2xl font-semibold">{page}/{totalPages}</div>
        </div>
        <div className="bg-white rounded border p-3">
          <div className="text-sm text-gray-600">Baris</div>
          <div className="text-2xl font-semibold">{count}</div>
        </div>
      </div>

      <div className="bg-white rounded border overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="border-b bg-gray-50 text-left text-sm text-gray-600">
              <th className="px-4 py-2">Tanggal</th>
              <th className="px-4 py-2">Produk</th>
              <th className="px-4 py-2">Qty</th>
              <th className="px-4 py-2">Tipe</th>
              <th className="px-4 py-2">Ref</th>
              <th className="px-4 py-2">Catatan</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500">Memuat...</td></tr>
            ) : error ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-red-600">{error}</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500">Tidak ada data</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b text-sm">
                  <td className="px-4 py-2 whitespace-nowrap">{new Date(r.createdAt).toLocaleString("id-ID")}</td>
                  <td className="px-4 py-2">
                    {r.product ? (
                      <div>
                        <div className="font-medium">{r.product.name}</div>
                        {r.product.sku ? <div className="text-xs text-gray-500">SKU: {r.product.sku}</div> : null}
                      </div>
                    ) : (
                      <span className="text-gray-500">-</span>
                    )}
                  </td>
                  <td className="px-4 py-2 font-semibold">
                    <span className={r.type === "IN" ? "text-green-600" : r.type === "OUT" ? "text-red-600" : ""}>{r.qty}</span>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-1 rounded text-xs ${r.type === "IN" ? "bg-green-100 text-green-700" : r.type === "OUT" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700"}`}>{r.type}</span>
                  </td>
                  <td className="px-4 py-2">
                    {r.refTable && r.refId ? (
                      <Link href={refHref(r)} className="text-blue-600 hover:underline">
                        {`${(r.refTable || "").toUpperCase()}#${r.refId}`}
                      </Link>
                    ) : (
                      <span className="text-gray-500">-</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-gray-700">{r.note || "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">Menampilkan {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, count)} dari {count}</div>
        <div className="flex gap-2">
          <button disabled={page <= 1} onClick={() => fetchData(page - 1)} className="px-3 py-2 rounded border disabled:opacity-50">Sebelumnya</button>
          <button disabled={page >= totalPages} onClick={() => fetchData(page + 1)} className="px-3 py-2 rounded border disabled:opacity-50">Berikutnya</button>
        </div>
      </div>
    </div>
  );
}

