"use client";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import FeatureGuard from "@/components/FeatureGuard";

type LogItem = { id: number; userId: number | null; action: string; entity: string | null; metadata: any | null; createdAt: string };

export default function Page() {
  const [items, setItems] = useState<LogItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({ action: "", entity: "", userId: "", q: "", dateFrom: "", dateTo: "" });

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    if (filters.action) params.set("action", filters.action);
    if (filters.entity) params.set("entity", filters.entity);
    if (filters.userId) params.set("userId", filters.userId);
    if (filters.q) params.set("q", filters.q);
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.set("dateTo", filters.dateTo);
    return params.toString();
  }, [page, pageSize, filters]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/activity-log?${query}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "Gagal load activity");
      setItems(json.data.items);
      setPage(json.data.page);
      setTotal(json.data.total);
      setPageSize(json.data.pageSize);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const totalPages = Math.ceil(total / pageSize) || 1;

  const renderDiff = (meta: any) => {
    if (!meta) return null;
    const before = meta.before || null;
    const after = meta.after || null;
    if (!before && !after) return null;
    const keys = Array.from(new Set([...(before ? Object.keys(before) : []), ...(after ? Object.keys(after) : [])]));
    const changes = keys
      .map((k) => ({ key: k, b: before ? before[k] : undefined, a: after ? after[k] : undefined }))
      .filter((r) => JSON.stringify(r.b) !== JSON.stringify(r.a));
    if (changes.length === 0) return <span className="text-xs text-gray-500">Tidak ada perubahan</span>;
    return (
      <div className="text-xs text-gray-700 dark:text-gray-300">
        {changes.map((c) => (
          <div key={c.key} className="flex gap-2">
            <span className="font-medium">{c.key}:</span>
            <span className="line-through text-red-500/80">{String(c.b)}</span>
            <span className="text-green-600">{String(c.a)}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <FeatureGuard feature="system.user">
      <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Activity Log / Notifications</h1>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
        <input
          className="rounded border px-2 py-1 bg-transparent"
          placeholder="Action"
          value={filters.action}
          onChange={(e) => { setPage(1); setFilters((f) => ({ ...f, action: e.target.value })); }}
        />
        <input
          className="rounded border px-2 py-1 bg-transparent"
          placeholder="Entity"
          value={filters.entity}
          onChange={(e) => { setPage(1); setFilters((f) => ({ ...f, entity: e.target.value })); }}
        />
        <input
          className="rounded border px-2 py-1 bg-transparent"
          placeholder="User ID"
          value={filters.userId}
          onChange={(e) => { setPage(1); setFilters((f) => ({ ...f, userId: e.target.value })); }}
        />
        <input
          type="date"
          className="rounded border px-2 py-1 bg-transparent"
          value={filters.dateFrom}
          onChange={(e) => { setPage(1); setFilters((f) => ({ ...f, dateFrom: e.target.value })); }}
        />
        <input
          type="date"
          className="rounded border px-2 py-1 bg-transparent"
          value={filters.dateTo}
          onChange={(e) => { setPage(1); setFilters((f) => ({ ...f, dateTo: e.target.value })); }}
        />
        <input
          className="rounded border px-2 py-1 bg-transparent"
          placeholder="Cari kata kunci"
          value={filters.q}
          onChange={(e) => { setPage(1); setFilters((f) => ({ ...f, q: e.target.value })); }}
        />
      </div>

      {error && <div className="rounded-lg bg-red-50 p-3 text-red-600">{error}</div>}

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold">Waktu</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">User</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Aksi</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Entitas</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Perubahan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {loading ? (
              <tr>
                <td className="px-4 py-4" colSpan={5}><LoadingSpinner label="Memuat log aktivitas..." /></td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td className="px-4 py-4" colSpan={5}>Belum ada aktivitas</td>
              </tr>
            ) : (
              items.map((it) => (
                <tr key={it.id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                  <td className="px-4 py-3">{new Date(it.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3">{it.userId ?? "-"}</td>
                  <td className="px-4 py-3">{it.action}</td>
                  <td className="px-4 py-3">{it.entity || "-"}</td>
                  <td className="px-4 py-3">{renderDiff(it.metadata)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => { const p = Math.max(1, page - 1); setPage(p); }}>
          Prev
        </Button>
        <span className="text-sm">Page {page} / {totalPages}</span>
        <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => { const p = Math.min(totalPages, page + 1); setPage(p); }}>
          Next
        </Button>
      </div>
      </div>
    </FeatureGuard>
  );
}
