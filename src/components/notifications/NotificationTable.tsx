"use client";
import React, { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { useGlobal } from "@/context/AppContext";

export type NotificationRow = {
  id: number;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error" | string;
  read: boolean;
  createdAt: string | Date;
};

type Props = {
  items: NotificationRow[];
  onMarkRead?: (ids: number[]) => Promise<void> | void;
  onPreview?: (row: NotificationRow) => void;
  onApprove?: (row: NotificationRow) => Promise<void> | void;
  onDecline?: (row: NotificationRow) => Promise<void> | void;
  className?: string;
};

const typeColor: Record<string, string> = {
  info: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  success: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  error: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
};

function formatDate(value: string | Date) {
  const d = typeof value === "string" ? new Date(value) : value;
  try {
    return d.toLocaleString();
  } catch {
    return String(value);
  }
}

export default function NotificationTable({ items, onMarkRead, onPreview, onApprove, onDecline, className }: Props) {
  const { hasRole } = useGlobal();
  const unreadIds = useMemo(() => items.filter((i) => !i.read).map((i) => i.id), [items]);
  const brandDotStyle: React.CSSProperties = { backgroundColor: "var(--brand-primary, #0EA5E9)" };

  const isApprovalNotification = (row: NotificationRow) => {
    const t = `${row.title} ${row.message}`.toLowerCase();
    const keys = [
      "approve", "approval", "verifikasi", "aktivasi", "aktifkan",
      "daftar", "pendaftaran", "signup", "register", "registrasi",
    ];
    return keys.some((k) => t.includes(k));
  };

  return (
    <div className={className ?? "rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Daftar Notifikasi</h3>
        {onMarkRead && (
          <button
            className="inline-flex items-center rounded-full bg-gray-800 px-3 py-1.5 text-sm text-white shadow-sm hover:bg-gray-900 disabled:opacity-50 dark:bg-white/10 dark:hover:bg-white/15"
            onClick={() => unreadIds.length && onMarkRead(unreadIds)}
            disabled={!unreadIds.length}
          >
            Tandai semua dibaca
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 dark:text-gray-400">
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Judul</th>
              <th className="px-3 py-2">Pesan</th>
              <th className="px-3 py-2">Tipe</th>
              <th className="px-3 py-2">Waktu</th>
              <th className="px-3 py-2">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {items.length ? (
              items.map((row) => (
                <tr key={row.id} className="border-t border-gray-100 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/5">
                  <td className="px-3 py-2">
                    <span
                      title={row.read ? "Sudah dibaca" : "Belum dibaca"}
                      className={`inline-block h-2.5 w-2.5 rounded-full ${row.read ? "opacity-30" : ""}`}
                      style={row.read ? {} : brandDotStyle}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-800 dark:text-white/90">{row.title}</div>
                  </td>
                  <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{row.message}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${typeColor[String(row.type).toLowerCase()] ?? typeColor.info}`}>{String(row.type).toUpperCase()}</span>
                  </td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">{formatDate(row.createdAt)}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {onMarkRead && !row.read && (
                        <button
                          className="text-xs rounded-full bg-brand-500/90 px-3 py-1 text-white hover:bg-brand-600"
                          onClick={() => onMarkRead([row.id])}
                        >
                          Tandai dibaca
                        </button>
                      )}
                      {onMarkRead && row.read && (
                        <span className="text-xs text-gray-500">—</span>
                      )}
                      {/* Preview */}
                      {typeof onPreview === "function" && (
                        <button
                          className="text-xs rounded-full border px-3 py-1 text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-800"
                          onClick={() => onPreview(row)}
                        >
                          Preview
                        </button>
                      )}
                      {/* Approve / Decline for owner on approval notifications */}
                      {hasRole("owner") && typeof onApprove === "function" && isApprovalNotification(row) && (
                        <button
                          className="text-xs rounded-full bg-green-600 px-3 py-1 text-white hover:bg-green-700"
                          onClick={() => onApprove(row)}
                        >
                          Approve
                        </button>
                      )}
                      {hasRole("owner") && typeof onDecline === "function" && isApprovalNotification(row) && (
                        <button
                          className="text-xs rounded-full bg-red-600 px-3 py-1 text-white hover:bg-red-700"
                          onClick={() => onDecline(row)}
                        >
                          Decline
                        </button>
                      )}
                    </div>
                  </td>
              </tr>
              ))
            ) : (
              <tr>
                <td className="px-3 py-8 text-center text-sm text-gray-500 dark:text-gray-400" colSpan={6}>
                  Tidak ada notifikasi
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
