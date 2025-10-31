"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import NotificationTable, { type NotificationRow } from "@/components/notifications/NotificationTable";
import FeatureGuard from "@/components/FeatureGuard";
import { Modal } from "@/components/ui/modal";
import { useGlobal } from "@/context/AppContext";

type Filter = "all" | "unread" | "read";

export default function UserNotificationsPage() {
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const { hasRole } = useGlobal();
  const [previewOpen, setPreviewOpen] = useState<boolean>(false);
  const [selected, setSelected] = useState<NotificationRow | null>(null);
  const [roleModalOpen, setRoleModalOpen] = useState<boolean>(false);
  const [roleOptions, setRoleOptions] = useState<{ id: number; name: string }[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>("User");
  const [pendingApproval, setPendingApproval] = useState<{ notif: NotificationRow; userId: number } | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/notifications", { cache: "no-store" });
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
      console.error("[UserNotificationsPage] load error:", err);
      setError(err?.message || "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredItems = useMemo(() => {
    if (filter === "unread") return items.filter((i) => !i.read);
    if (filter === "read") return items.filter((i) => i.read);
    return items;
  }, [items, filter]);

  const markRead = useCallback(async (ids: number[]) => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, read: true }),
      });
    } catch {}
    load();
  }, [load]);

  const isApprovalNotification = (row: NotificationRow) => {
    const t = `${row.title} ${row.message}`.toLowerCase();
    const keys = [
      "approve", "approval", "verifikasi", "aktivasi", "aktifkan",
      "daftar", "pendaftaran", "signup", "register", "registrasi",
    ];
    return keys.some((k) => t.includes(k));
  };

  const extractEmailFromText = (text: string) => {
    const m = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    return m ? m[0] : null;
  };

  const findPendingUserByEmail = async (email: string) => {
    const res = await fetch(`/api/users?status=pending`, { cache: "no-store" });
    const json = await res.json();
    const list = Array.isArray(json?.data) ? json.data : [];
    return list.find((u: any) => String(u.email).toLowerCase() === String(email).toLowerCase()) || null;
  };

  const handlePreview = async (row: NotificationRow) => {
    // Hapus notifikasi saat dibuka (preview dianggap dibuka)
    try { await markRead([row.id]); } catch {}
    setSelected(row);
    setPreviewOpen(true);
  };

  const handleApprove = async (row: NotificationRow) => {
    try {
      setError(null);
      const email = extractEmailFromText(`${row.title} ${row.message}`);
      if (!email) throw new Error("Email tidak ditemukan pada notifikasi");
      const user = await findPendingUserByEmail(email);
      if (!user) throw new Error("User pending tidak ditemukan");
      const rolesRes = await fetch(`/api/roles`, { cache: "no-store" });
      const rolesJson = await rolesRes.json();
      const roles = Array.isArray(rolesJson?.data) ? rolesJson.data : [];
      setRoleOptions(roles.map((r: any) => ({ id: r.id, name: r.name })));
      setSelectedRole(roles[0]?.name || "User");
      setPendingApproval({ notif: row, userId: Number(user.id) });
      setRoleModalOpen(true);
    } catch (err: any) {
      console.error("[Approve] error:", err);
      setError(err?.message || "Terjadi kesalahan menyiapkan approve");
    }
  };

  const confirmApproveWithRole = async () => {
    if (!pendingApproval) { setRoleModalOpen(false); return; }
    const { notif, userId } = pendingApproval;
    try {
      const res = await fetch(`/api/users/${userId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleName: selectedRole }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.message || "Gagal approve user");
      await markRead([notif.id]);
      setRoleModalOpen(false);
      setPendingApproval(null);
    } catch (err: any) {
      console.error("[Approve Confirm] error:", err);
      setError(err?.message || "Terjadi kesalahan saat approve");
    }
  };

  const handleDecline = async (row: NotificationRow) => {
    try {
      setError(null);
      const email = extractEmailFromText(`${row.title} ${row.message}`);
      if (!email) throw new Error("Email tidak ditemukan pada notifikasi");
      const user = await findPendingUserByEmail(email);
      if (!user) throw new Error("User pending tidak ditemukan");
      const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.message || "Gagal decline user");
      await markRead([row.id]);
    } catch (err: any) {
      console.error("[Decline] error:", err);
      setError(err?.message || "Terjadi kesalahan saat decline");
    }
  };

  return (
    <FeatureGuard feature="system.user">
      <div className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Notifikasi User</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilter("all")}
              className={`rounded-full px-3 py-1 text-sm border ${filter === "all" ? "bg-gray-800 text-white dark:bg-white/10" : "bg-white text-gray-700 dark:bg-gray-900 dark:text-gray-300"}`}
            >
              Semua
            </button>
            <button
              onClick={() => setFilter("unread")}
              className={`rounded-full px-3 py-1 text-sm border ${filter === "unread" ? "bg-gray-800 text-white dark:bg-white/10" : "bg-white text-gray-700 dark:bg-gray-900 dark:text-gray-300"}`}
            >
              Belum Dibaca
            </button>
            <button
              onClick={() => setFilter("read")}
              className={`rounded-full px-3 py-1 text-sm border ${filter === "read" ? "bg-gray-800 text-white dark:bg-white/10" : "bg-white text-gray-700 dark:bg-gray-900 dark:text-gray-300"}`}
            >
              Sudah Dibaca
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-700/50 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        )}

        <NotificationTable
          items={filteredItems}
          onMarkRead={markRead}
          onPreview={handlePreview}
          onApprove={hasRole("owner") ? handleApprove : undefined}
          onDecline={hasRole("owner") ? handleDecline : undefined}
        />
        <Modal isOpen={previewOpen} onClose={() => setPreviewOpen(false)} className="max-w-xl">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-2">Preview Notifikasi</h2>
            {selected ? (
              <div className="space-y-3">
                <div className="text-sm text-gray-500 dark:text-gray-400">{new Date(selected.createdAt).toLocaleString()}</div>
                <div className="text-base font-medium text-gray-800 dark:text-white/90">{selected.title}</div>
                <div className="text-gray-700 dark:text-gray-300 whitespace-pre-line">{selected.message}</div>
                <div className="flex items-center gap-2 pt-2">
                  {hasRole("owner") && isApprovalNotification(selected) && (
                    <>
                      <button
                        className="rounded-full bg-green-600 px-3 py-1.5 text-white text-sm hover:bg-green-700"
                        onClick={() => selected && handleApprove(selected)}
                      >
                        Approve
                      </button>
                      <button
                        className="rounded-full bg-red-600 px-3 py-1.5 text-white text-sm hover:bg-red-700"
                        onClick={() => selected && handleDecline(selected)}
                      >
                        Decline
                      </button>
                    </>
                  )}
                  <button
                    className="rounded-full border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-800"
                    onClick={() => setPreviewOpen(false)}
                  >
                    Tutup
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-400">Tidak ada notifikasi dipilih.</p>
            )}
          </div>
        </Modal>
        {loading && (
          <p className="mt-3 text-sm text-gray-500">Memuat…</p>
        )}
        {roleModalOpen && (
          <Modal isOpen={roleModalOpen} onClose={() => setRoleModalOpen(false)} className="max-w-sm">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-3">Pilih Role untuk User</h2>
              <div className="space-y-2">
                <label className="text-sm text-gray-600 dark:text-gray-400">Role</label>
                <select
                  className="w-full rounded-md border px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                >
                  {roleOptions.map((r) => (
                    <option key={r.id} value={r.name}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <button
                  className="rounded-full bg-green-600 px-3 py-1.5 text-white text-sm hover:bg-green-700"
                  onClick={confirmApproveWithRole}
                >
                  Konfirmasi
                </button>
                <button
                  className="rounded-full border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-800"
                  onClick={() => setRoleModalOpen(false)}
                >
                  Batal
                </button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </FeatureGuard>
  );
}
