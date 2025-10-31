"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import NotificationTable, { type NotificationRow } from "@/components/notifications/NotificationTable";
import FeatureGuard from "@/components/FeatureGuard";

type Filter = "all" | "unread" | "read" | "error" | "warning" | "success" | "info";

export default function SystemNotificationsPage() {
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/notifications/system", { cache: "no-store" });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.message || "Gagal memuat notifikasi");
      const mapped: NotificationRow[] = Array.isArray(json.data)
        ? json.data.map((n: any) => ({
            id: n.id,
            title: String(n.title ?? "Notifikasi"),
            message: String(n.message ?? ""),
            type: String(n.type ?? "info"),
            read: Boolean(n.read ?? n.isRead ?? false),
            createdAt: n.createdAt,
          }))
        : [];
      setItems(mapped);
    } catch (err: any) {
      console.error("[SystemNotificationsPage] load error:", err);
      setError(err?.message || "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredItems = useMemo(() => {
    let out = items;
    if (filter === "unread") out = out.filter((i) => !i.read);
    else if (filter === "read") out = out.filter((i) => i.read);
    else if (["info", "success", "warning", "error"].includes(filter)) out = out.filter((i) => String(i.type).toLowerCase() === filter);
    return out;
  }, [items, filter]);

  return (
    <FeatureGuard feature="system.user">
      <div className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Notifikasi Sistem</h1>
          <div className="flex items-center gap-2">
            {(["all", "unread", "read", "info", "success", "warning", "error"] as Filter[]).map((key) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`rounded-full px-3 py-1 text-sm border ${filter === key ? "bg-gray-800 text-white dark:bg-white/10" : "bg-white text-gray-700 dark:bg-gray-900 dark:text-gray-300"}`}
              >
                {key === "all" ? "Semua" : key === "unread" ? "Belum Dibaca" : key === "read" ? "Sudah Dibaca" : key.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-700/50 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        )}

        <NotificationTable items={filteredItems} />
        {loading && (
          <p className="mt-3 text-sm text-gray-500">Memuat…</p>
        )}
      </div>
    </FeatureGuard>
  );
}

