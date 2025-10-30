"use client";

import React, { useEffect, useMemo, useState } from "react";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";

type Product = {
  id: number;
  name: string;
  sku: string;
  category?: { name: string } | null;
  unit?: string | null;
  qty: number;
  trackStock?: boolean;
  imageUrl?: string | null;
};

export default function Page() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [onlyTracked, setOnlyTracked] = useState(true);
  const [lowOnly, setLowOnly] = useState(false);
  const [threshold, setThreshold] = useState(10);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/products", { cache: "no-store" });
        const data = await res.json();
        if (Array.isArray(data)) {
          setProducts(
            data.map((p: any) => ({
              id: p.id,
              name: p.name,
              sku: p.sku,
              category: p.category ? { name: p.category.name } : null,
              unit: p.unit ?? "pcs",
              qty: p.qty ?? 0,
              trackStock: !!p.trackStock,
              imageUrl: p.imageUrl ?? null,
            }))
          );
        }
      } catch (e) {
        console.error("[stok-gudang] load products error", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (onlyTracked && !p.trackStock) return false;
      if (lowOnly && !(p.trackStock && p.qty <= threshold)) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.sku || "").toLowerCase().includes(q) ||
        (p.category?.name || "").toLowerCase().includes(q)
      );
    });
  }, [products, search, onlyTracked, lowOnly, threshold]);

  const metrics = useMemo(() => {
    const total = products.length;
    const tracked = products.filter((p) => p.trackStock).length;
    const low = products.filter((p) => p.trackStock && p.qty <= threshold).length;
    return { total, tracked, low };
  }, [products, threshold]);

  function downloadCsv() {
    const header = [
      "SKU",
      "Nama Produk",
      "Kategori",
      "Qty",
      "Unit",
      "Track Stock",
    ];
    const rows = filtered.map((p) => [
      p.sku,
      p.name,
      p.category?.name || "-",
      String(p.qty ?? 0),
      p.unit || "-",
      p.trackStock ? "YA" : "TIDAK",
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stok-gudang-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6">
      <PageBreadcrumb pageTitle="Stok & Gudang" />

      <div className="min-h-screen rounded-2xl border border-gray-200 bg-white px-5 py-7 dark:border-gray-800 dark:bg-white/[0.03] xl:px-10 xl:py-12">
        <div className="mx-auto w-full max-w-[1200px]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white/90">Ringkasan Stok</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Menampilkan stok agregat per produk. Modul gudang detail akan menambahkan lokasi.</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={downloadCsv} className="rounded-full border px-4 py-2 text-sm hover:bg-gray-50">Unduh CSV</button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-white/[0.02]">
              <div className="text-sm text-gray-500">Total Produk</div>
              <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white/90">{metrics.total.toLocaleString("id-ID")}</div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-white/[0.02]">
              <div className="text-sm text-gray-500">Track Stock Aktif</div>
              <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white/90">{metrics.tracked.toLocaleString("id-ID")}</div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-white/[0.02]">
              <div className="text-sm text-gray-500">Stok Rendah ≤ {threshold}</div>
              <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white/90">{metrics.low.toLocaleString("id-ID")}</div>
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="w-full sm:w-80">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari produk, SKU, kategori..."
                className="dark:bg-dark-900 shadow-theme-xs focus:border-brand-300 focus:ring-brand-500/10 dark:focus:border-brand-800 h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:ring-3 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30"
              />
            </div>
            <div className="flex items-center gap-3 text-sm">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={onlyTracked} onChange={(e)=>setOnlyTracked(e.target.checked)} />
                <span>Hanya produk dengan track stock</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={lowOnly} onChange={(e)=>setLowOnly(e.target.checked)} />
                <span>Tampilkan stok rendah</span>
              </label>
              <div className="inline-flex items-center gap-2">
                <span>Ambang</span>
                <input type="number" value={threshold} onChange={(e)=>setThreshold(Math.max(0, Number(e.target.value)))} className="h-9 w-16 rounded border border-gray-300 px-2 text-sm" />
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-gray-200 overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-3 text-left w-20">Foto</th>
                  <th className="p-3 text-left">Nama Produk</th>
                  <th className="p-3 text-left">SKU</th>
                  <th className="p-3 text-left">Kategori</th>
                  <th className="p-3 text-right">Qty</th>
                  <th className="p-3 text-left">Unit</th>
                  <th className="p-3 text-center w-28">Track</th>
                  <th className="p-3 text-center w-32">Tindakan</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="p-6 text-center text-gray-500">Memuat data...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={8} className="p-6 text-center text-gray-500">Tidak ada data</td></tr>
                ) : (
                  filtered.map((p) => (
                    <tr key={p.id} className="border-t hover:bg-gray-50">
                      <td className="p-3">
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt={p.name} className="h-10 w-14 rounded border object-cover" />
                        ) : (
                          <div className="h-10 w-14 rounded border bg-gray-50 grid place-items-center text-[10px] text-gray-400">NO IMAGE</div>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="font-medium text-gray-900 dark:text-white/90">{p.name}</div>
                        <div className="text-xs text-gray-500">{p.category?.name || '-'}</div>
                      </td>
                      <td className="p-3">{p.sku}</td>
                      <td className="p-3">{p.category?.name || '-'}</td>
                      <td className="p-3 text-right">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${p.trackStock && p.qty <= threshold ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>{p.qty}</span>
                      </td>
                      <td className="p-3">{p.unit || '-'}</td>
                      <td className="p-3 text-center">{p.trackStock ? 'YA' : 'TIDAK'}</td>
                      <td className="p-3 text-center">
                        <div className="inline-flex gap-2">
                          <a href="/produk-stok/produk" className="rounded bg-emerald-500 px-3 py-1.5 text-white text-xs">Lihat Produk</a>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
