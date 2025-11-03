"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import FeatureGuard from "@/components/FeatureGuard";
import type { NotificationRow } from "@/components/notifications/NotificationTable";
import { useGlobal } from "@/context/AppContext";
import { toast } from "react-hot-toast";
import { Modal } from "@/components/ui/modal";

type Tab = "all" | "unread";

export default function UserNotificationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasRole } = useGlobal();

  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [selected, setSelected] = useState<NotificationRow | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [decliningId, setDecliningId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<{ id: number; type: "approve" | "decline"; message: string } | null>(null);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [roleOptions, setRoleOptions] = useState<{ id: number; name: string }[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>("User");
  const [pendingApproval, setPendingApproval] = useState<{ row: NotificationRow; userId: number } | null>(null);

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/notifications", { cache: "no-store" });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.message || "Gagal memuat notifikasi");
      const mapped: NotificationRow[] = Array.isArray(json.data)
        ? json.data.map((n: any) => ({
            id: Number(n.id),
            title: String(n.title ?? "Notifikasi"),
            message: String(n.message ?? ""),
            type: String(n.type ?? "info"),
            read: Boolean(n.read ?? n.isRead ?? false),
            createdAt: n.createdAt,
          }))
        : [];
      setItems(mapped);
    } catch (err: any) {
      console.error("[UserNotificationsPage] load error:", err);
      setError(err?.message || "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    const idParam = searchParams.get("id");
    const id = idParam ? Number(idParam) : NaN;
    if (!items.length) return;
    let next = items.find((i) => i.id === id);
    if (!next) next = items.find((i) => !i.read) ?? items[0] ?? null;
    if (next) setSelected(next);
  }, [items, searchParams]);

  useEffect(() => {
    if (!selected) {
      setActionError(null);
    } else if (actionError && actionError.id !== selected.id) {
      setActionError(null);
    }
  }, [selected, actionError]);

  const filteredItems = useMemo(() => {
    return tab === "unread" ? items.filter((i) => !i.read) : items;
  }, [items, tab]);

  const setReadState = useCallback(
    async (ids: number[], read: boolean) => {
      if (!ids.length) return;
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, read }),
      });
      if (!res.ok) {
        let message = "Gagal memperbarui status notifikasi.";
        try {
          const data = await res.json();
          if (typeof data?.message === "string") message = data.message;
        } catch {}
        throw new Error(message);
      }
      setItems((prev) => prev.map((row) => (ids.includes(row.id) ? { ...row, read } : row)));
    },
    [],
  );

  const markAllAsRead = useCallback(async () => {
    const unreadIds = items.filter((i) => !i.read).map((i) => i.id);
    if (!unreadIds.length) return;
    try {
      await setReadState(unreadIds, true);
    } catch (err: any) {
      toast.error(err?.message || "Gagal menandai semua notifikasi.");
    }
  }, [items, setReadState]);

  const clearAllNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { method: "DELETE" });
      if (!res.ok) {
        let message = "Gagal mengosongkan notifikasi.";
        try {
          const data = await res.json();
          if (typeof data?.message === "string") message = data.message;
        } catch {}
        throw new Error(message);
      }
      setItems([]);
      setSelected(null);
      setDetailModalOpen(false);
      toast.success("Daftar notifikasi dikosongkan.");
    } catch (err: any) {
      toast.error(err?.message || "Gagal mengosongkan notifikasi.");
    }
  }, []);

  const handleOpenDetail = useCallback(
    (row: NotificationRow) => {
      setSelected(row);
      setDetailModalOpen(true);
      router.replace(`/system-user/notifications/user?id=${row.id}`);
    },
    [router],
  );

  const extractEmailFromText = (text: string) => {
    const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    return match ? match[0] : null;
  };

  async function resolvePendingUserId(email: string) {
    const res = await fetch(`/api/users?status=pending`, { cache: "no-store" });
    const json = await res.json();
    if (!json?.success || !Array.isArray(json?.data)) {
      throw new Error(json?.message || "Gagal memuat daftar user.");
    }
    const target = json.data.find((u: any) => String(u.email).toLowerCase() === email.toLowerCase());
    if (!target?.id) {
      throw new Error("User dengan email tersebut tidak ditemukan dalam status pending.");
    }
    return Number(target.id);
  }

  async function loadRoleOptions() {
    const res = await fetch(`/api/roles`, { cache: "no-store" });
    const json = await res.json();
    if (!Array.isArray(json?.data)) return [];
    return json.data.map((r: any) => ({ id: Number(r.id), name: String(r.name) }));
  }

  const beginApprove = useCallback(
    async (row: NotificationRow) => {
      if (detailModalOpen && approvingId && approvingId !== row.id) return;
      setActionError(null);
      const email = extractEmailFromText(`${row.title} ${row.message}`);
      if (!email) {
        const message = "Email tidak ditemukan di pesan notifikasi.";
        setActionError({ id: row.id, type: "approve", message });
        toast.error(message);
        return;
      }
      try {
        setApprovingId(row.id);
        const userId = await resolvePendingUserId(email);
        const roles = await loadRoleOptions();
        const safeRoles = roles.length ? roles : [{ id: 0, name: "User" }];
        setRoleOptions(safeRoles);
        setSelectedRole(safeRoles[0]?.name || "User");
        setPendingApproval({ row, userId });
        setRoleModalOpen(true);
      } catch (err: any) {
        const message = err?.message || "Gagal memperbarui status user.";
        setActionError({ id: row.id, type: "approve", message });
        toast.error(message);
      } finally {
        setApprovingId(null);
      }
    },
    [detailModalOpen, approvingId],
  );

  const confirmApprove = useCallback(async () => {
    if (!pendingApproval) {
      setRoleModalOpen(false);
      return;
    }
    const { row, userId } = pendingApproval;
    try {
      setApprovingId(row.id);
      const res = await fetch(`/api/users/${userId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleName: selectedRole }),
      });
      const json = await res.json();
      if (!json?.success) {
        throw new Error(json?.message || "Gagal memperbarui status user.");
      }
      toast.success("User berhasil disetujui.");
      await setReadState([row.id], true);
      setSelected((prev) => (prev && prev.id === row.id ? { ...prev, read: true } : prev));
    } catch (err: any) {
      const message = err?.message || "Gagal memperbarui status user.";
      setActionError({ id: row.id, type: "approve", message });
      toast.error(message);
    } finally {
      setApprovingId(null);
      setPendingApproval(null);
      setRoleModalOpen(false);
    }
  }, [pendingApproval, selectedRole, setReadState]);

  const handleDecline = useCallback(
    async (row: NotificationRow) => {
      if (detailModalOpen && decliningId && decliningId !== row.id) return;
      setActionError(null);
      const email = extractEmailFromText(`${row.title} ${row.message}`);
      if (!email) {
        const message = "Email tidak ditemukan di pesan notifikasi.";
        setActionError({ id: row.id, type: "decline", message });
        toast.error(message);
        return;
      }
      try {
        setDecliningId(row.id);
        const userId = await resolvePendingUserId(email);
        const res = await fetch(`/api/users/${userId}`, { method: "DELETE" });
        const json = await res.json();
        if (!json?.success) {
          throw new Error(json?.message || "Gagal memperbarui status user.");
        }
        toast.success("User berhasil ditolak.");
        await setReadState([row.id], true);
        setSelected((prev) => (prev && prev.id === row.id ? { ...prev, read: true } : prev));
      } catch (err: any) {
        const message = err?.message || "Gagal memperbarui status user.";
        setActionError({ id: row.id, type: "decline", message });
        toast.error(message);
      } finally {
        setDecliningId(null);
      }
    },
    [detailModalOpen, decliningId, setReadState],
  );

  const isApprovalNotification = (row: NotificationRow) => {
    const text = `${row.title} ${row.message}`.toLowerCase();
    const keys = ["approve", "approval", "verifikasi", "aktivasi", "aktifkan", "daftar", "pendaftaran", "signup", "register", "registrasi"];
    return keys.some((k) => text.includes(k));
  };

  const closeRoleModal = () => {
    setRoleModalOpen(false);
    setPendingApproval(null);
  };

  return (
    <FeatureGuard feature="system.user">
      <div className="space-y-4 p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-semibold">Notifikasi User</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Kelola notifikasi pribadi Anda dari halaman ini.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(["all", "unread"] as Tab[]).map((key) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`rounded-full px-3 py-1 text-sm border ${
                  tab === key
                    ? "bg-gray-900 text-white dark:bg-white/10"
                    : "bg-white text-gray-700 hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                }`}
              >
                {key === "all" ? "Semua" : "Belum dibaca"}
              </button>
            ))}
            <button
              className="rounded-full px-3 py-1 text-sm border bg-white text-gray-700 hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 disabled:opacity-50"
              onClick={markAllAsRead}
              disabled={!items.some((i) => !i.read)}
            >
              Tandai semua dibaca
            </button>
            <button
              className="rounded-full px-3 py-1 text-sm border bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20 disabled:opacity-50"
              onClick={clearAllNotifications}
              disabled={!items.length}
            >
              Kosongkan
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-700/50 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {filteredItems.map((row) => {
              const createdAt = typeof row.createdAt === "string" ? new Date(row.createdAt) : row.createdAt;
              const isActive = selected?.id === row.id;
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => handleOpenDetail(row)}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition ${
                      isActive
                        ? "bg-brand-500/10 ring-1 ring-brand-400 dark:bg-brand-500/20"
                        : row.read
                        ? "bg-white hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800"
                        : "bg-brand-50/70 hover:bg-brand-50 dark:bg-brand-500/15 dark:hover:bg-brand-500/20"
                    }`}
                  >
                    <span
                      className={`mt-1 h-2.5 w-2.5 rounded-full ${
                        row.read ? "bg-gray-300 dark:bg-gray-600" : "bg-brand-500"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{row.title}</p>
                        <span className="whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                          {createdAt.toLocaleString()}
                        </span>
                      </div>
                      {row.message ? (
                        <p className="mt-1 line-clamp-2 text-sm text-gray-600 dark:text-gray-300">{row.message}</p>
                      ) : null}
                    </div>
                  </button>
                </li>
              );
            })}
            {!filteredItems.length && (
              <li className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                Tidak ada notifikasi pada filter ini.
              </li>
            )}
          </ul>
        </div>
        {loading && <p className="text-sm text-gray-500 dark:text-gray-400">Memuat…</p>}
      </div>

      <Modal isOpen={detailModalOpen && !!selected} onClose={() => setDetailModalOpen(false)} className="max-w-xl">
        {selected ? (
          <div className="space-y-4 p-6">
            <div className="space-y-1">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {(typeof selected.createdAt === "string" ? new Date(selected.createdAt) : selected.createdAt).toLocaleString()}
              </p>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{selected.title}</h2>
            </div>
            <p className="whitespace-pre-line text-sm text-gray-700 dark:text-gray-300">{selected.message}</p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                className="rounded-full bg-brand-500 px-3 py-1.5 text-sm text-white hover:bg-brand-600 disabled:opacity-50"
                onClick={async () => {
                  try {
                    await setReadState([selected.id], true);
                    setSelected((prev) => (prev ? { ...prev, read: true } : prev));
                  } catch (err: any) {
                    toast.error(err?.message || "Gagal menandai notifikasi.");
                  }
                }}
                disabled={selected.read}
              >
                Tandai dibaca
              </button>
              <button
                className="rounded-full border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-800 disabled:opacity-50"
                onClick={async () => {
                  try {
                    await setReadState([selected.id], false);
                    setSelected((prev) => (prev ? { ...prev, read: false } : prev));
                  } catch (err: any) {
                    toast.error(err?.message || "Gagal mengubah status notifikasi.");
                  }
                }}
                disabled={!selected.read}
              >
                Tandai belum dibaca
              </button>
              {hasRole("owner") && isApprovalNotification(selected) && (
                <>
                  <button
                    className="rounded-full bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700 disabled:opacity-60"
                    onClick={() => beginApprove(selected)}
                    disabled={approvingId === selected.id || decliningId === selected.id}
                  >
                    {approvingId === selected.id ? "Memproses..." : "Approve"}
                  </button>
                  <button
                    className="rounded-full bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-60"
                    onClick={() => handleDecline(selected)}
                    disabled={decliningId === selected.id || approvingId === selected.id}
                  >
                    {decliningId === selected.id ? "Memproses..." : "Decline"}
                  </button>
                </>
              )}
            </div>
            {actionError && actionError.id === selected.id && (
              <p className="text-xs text-red-500">{actionError.message}</p>
            )}
          </div>
        ) : null}
      </Modal>

      <Modal isOpen={roleModalOpen} onClose={closeRoleModal} className="max-w-sm">
        <div className="space-y-4 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Pilih Role untuk User</h2>
          <div className="space-y-2">
            <label className="text-sm text-gray-600 dark:text-gray-400">Role</label>
            <select
              className="w-full rounded-md border px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
            >
              {roleOptions.map((role) => (
                <option key={role.id} value={role.name}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="rounded-full bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700 disabled:opacity-60"
              onClick={confirmApprove}
              disabled={approvingId === pendingApproval?.row.id}
            >
              {approvingId === pendingApproval?.row.id ? "Memproses..." : "Konfirmasi"}
            </button>
            <button
              className="rounded-full border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-800"
              onClick={closeRoleModal}
            >
              Batal
            </button>
          </div>
        </div>
      </Modal>
    </FeatureGuard>
  );
}

