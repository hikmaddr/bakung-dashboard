"use client";
import Link from "next/link";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { toast } from "react-hot-toast";

type NotificationItem = {
  id: number;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
  targetUrl?: string | null;
};

export default function NotificationDropdown() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [menuStyles, setMenuStyles] = useState<React.CSSProperties>();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const displayedToastIdsRef = useRef<Set<number>>(new Set());
  const initialLoadRef = useRef(true);

  async function loadNotifications(options: { announceNew?: boolean } = {}) {
    const { announceNew = true } = options;
    try {
      setLoading(true);
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) throw new Error("Gagal memuat notifikasi.");
      const json = await res.json();
      if (!json?.success || !Array.isArray(json.data)) return;

      const mapped = json.data.map((n: any) => ({
        id: Number(n.id),
        title: String(n.title ?? "Notifikasi"),
        message: String(n.message ?? ""),
        type: String(n.type ?? "info"),
        read: Boolean(n.read ?? n.isRead ?? false),
        createdAt: String(n.createdAt ?? new Date().toISOString()),
        targetUrl: n.targetUrl ? String(n.targetUrl) : null,
      })) as NotificationItem[];

      setItems(mapped);
      setNotifying(mapped.some((n) => !n.read));

      if (announceNew && !initialLoadRef.current) {
        mapped
          .filter((n) => !n.read && !displayedToastIdsRef.current.has(n.id))
          .forEach((notif) => {
            displayedToastIdsRef.current.add(notif.id);
            showNotificationToast(notif);
          });
      } else if (initialLoadRef.current) {
        mapped
          .filter((n) => !n.read)
          .forEach((notif) => displayedToastIdsRef.current.add(notif.id));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Terjadi kesalahan saat memuat notifikasi.";
      toast.error(message);
    } finally {
      setLoading(false);
      initialLoadRef.current = false;
    }
  }

  function toggleDropdown() {
    setIsOpen((prev) => !prev);
  }

  function closeDropdown() {
    setIsOpen(false);
  }

  async function updateRead(ids: number[], read: boolean = true) {
    if (!ids.length) return;
    const res = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, read }),
    });
    if (!res.ok) throw new Error("Gagal memperbarui status notifikasi.");
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const data = await res.json();
      if (data?.success === false) {
        throw new Error(data?.message || "Gagal memperbarui status notifikasi.");
      }
    }
  }

  async function handleItemClick(notification: NotificationItem) {
    try {
      await updateRead([notification.id], true);
      setItems((prev) => {
        const next = prev.map((it) => (it.id === notification.id ? { ...it, read: true } : it));
        setNotifying(next.some((it) => !it.read));
        return next;
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menandai notifikasi.");
    } finally {
      closeDropdown();
      if (notification.targetUrl) {
        router.push(notification.targetUrl);
      } else {
        router.push(`/system-user/notifications/user?id=${notification.id}`);
      }
    }
  }

  async function clearAllNotifications() {
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
      setNotifying(false);
      toast.success("Daftar notifikasi dikosongkan.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal mengosongkan notifikasi.");
    }
  }

  function showNotificationToast(notification: NotificationItem) {
    const toastId = `notification-toast-${notification.id}`;
    const messagePreview =
      notification.message.length > 140
        ? `${notification.message.slice(0, 137).trimEnd()}…`
        : notification.message;

    toast.custom(
      (t) => (
        <div
          className={`pointer-events-auto w-[320px] max-w-[92vw] rounded-xl border border-gray-200 bg-white shadow-lg transition-all duration-200 ease-out dark:border-gray-700 dark:bg-gray-900 ${
            t.visible ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"
          }`}
        >
          <div className="flex flex-col gap-2 p-4">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{notification.title}</p>
            {messagePreview ? (
              <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-3">{messagePreview}</p>
            ) : null}
            <button
              type="button"
              className="mt-1 inline-flex items-center justify-center rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
              onClick={() => {
                toast.dismiss(toastId);
                router.push(notification.targetUrl || `/system-user/notifications/user?id=${notification.id}`);
              }}
            >
              Buka Modul Notifikasi
            </button>
          </div>
        </div>
      ),
      { id: toastId, duration: 6000 },
    );
  }

  useLayoutEffect(() => {
    if (!isOpen) return;
    const updatePosition = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const padding = 12;
      const minWidth = 280;
      const maxWidth = 360;
      const available = window.innerWidth - padding * 2;
      const width = Math.min(Math.max(minWidth, Math.min(maxWidth, available)), 380);

      const viewportLeft = padding;
      const viewportRight = window.innerWidth - padding - width;
      const preferredLeft = Math.round(rect.right - width);
      const left = Math.min(Math.max(preferredLeft, viewportLeft), viewportRight);

      const estimatedHeight = Math.min(460, Math.round(window.innerHeight * 0.75));
      const below = Math.round(rect.bottom + 8);
      const viewportBottom = window.innerHeight - padding;
      let top = below;
      if (below + estimatedHeight > viewportBottom) {
        const above = Math.round(rect.top - estimatedHeight - 8);
        top = Math.max(above, padding);
      }

      setMenuStyles({ position: "fixed", top, left, width, zIndex: 60 });
    };

    updatePosition();
    const handler = () => updatePosition();
    window.addEventListener("resize", handler);
    window.addEventListener("scroll", handler, true);
    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("scroll", handler, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDropdown();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  useEffect(() => {
    loadNotifications({ announceNew: false });
    const interval = setInterval(() => loadNotifications({ announceNew: true }), 60000);
    return () => clearInterval(interval);
  }, []);

  const handleToggle = async () => {
    toggleDropdown();
    if (!isOpen) {
      await loadNotifications({ announceNew: false });
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className="relative dropdown-toggle flex items-center justify-center text-gray-500 transition-colors bg-white border border-gray-200 rounded-full hover:text-gray-700 h-11 w-11 hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
        onClick={handleToggle}
        aria-label="Buka notifikasi"
      >
        <span
          className={`absolute right-0 top-0.5 z-10 h-2 w-2 rounded-full ${
            notifying ? "flex" : "hidden"
          }`}
          style={{ backgroundColor: "var(--brand-primary, #0EA5E9)" }}
        >
          <span
            className="absolute inline-flex w-full h-full rounded-full opacity-75 animate-ping"
            style={{ backgroundColor: "var(--brand-primary, #0EA5E9)" }}
          />
        </span>
        <svg
          className="fill-current"
          width="20"
          height="20"
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M10.75 2.29248C10.75 1.87827 10.4143 1.54248 10 1.54248C9.58583 1.54248 9.25004 1.87827 9.25004 2.29248V2.83613C6.08266 3.20733 3.62504 5.9004 3.62504 9.16748V14.4591H3.33337C2.91916 14.4591 2.58337 14.7949 2.58337 15.2091C2.58337 15.6234 2.91916 15.9591 3.33337 15.9591H4.37504H15.625H16.6667C17.0809 15.9591 17.4167 15.6234 17.4167 15.2091C17.4167 14.7949 17.0809 14.4591 16.6667 14.4591H16.375V9.16748C16.375 5.9004 13.9174 3.20733 10.75 2.83613V2.29248ZM14.875 14.4591V9.16748C14.875 6.47509 12.6924 4.29248 10 4.29248C7.30765 4.29248 5.12504 6.47509 5.12504 9.16748V14.4591H14.875ZM8.00004 17.7085C8.00004 18.1228 8.33583 18.4585 8.75004 18.4585H11.25C11.6643 18.4585 12 18.1228 12 17.7085C12 17.2943 11.6643 16.9585 11.25 16.9585H8.75004C8.33583 16.9585 8.00004 17.2943 8.00004 17.7085Z"
            fill="currentColor"
          />
        </svg>
      </button>

      <Dropdown
        isOpen={isOpen}
        onClose={closeDropdown}
        position="fixed"
        style={menuStyles}
        className="flex w-full max-w-[94vw] flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="flex items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-800">
          <h5 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Notifikasi</h5>
          <button
            type="button"
            onClick={closeDropdown}
            className="rounded-full p-1 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            aria-label="Tutup notifikasi"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M6.21967 7.28131C5.92678 6.98841 5.92678 6.51354 6.21967 6.22065C6.51256 5.92775 6.98744 5.92775 7.28033 6.22065L11.999 10.9393L16.7176 6.22078C17.0105 5.92789 17.4854 5.92788 17.7782 6.22078C18.0711 6.51367 18.0711 6.98855 17.7782 7.28144L13.0597 12L17.7782 16.7186C18.0711 17.0115 18.0711 17.4863 17.7782 17.7792C17.4854 18.0721 17.0105 18.0721 16.7176 17.7792L11.999 13.0607L7.28033 17.7794C6.98744 18.0722 6.51256 18.0722 6.21967 17.7794C5.92678 17.4865 5.92678 17.0116 6.21967 16.7187L10.9384 12L6.21967 7.28131Z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>
        <div className="mt-2 mb-1 flex items-center justify-between">
          <button
            type="button"
            className="text-xs text-brand-600 hover:text-brand-700 dark:text-brand-300 dark:hover:text-brand-200 disabled:opacity-50"
            onClick={clearAllNotifications}
            disabled={!items.length}
          >
            Kosongkan notifikasi
          </button>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {items.length} item
          </span>
        </div>

        <ul
          className="custom-scrollbar mt-2 flex max-h-[60vh] flex-col gap-2 overflow-y-auto"
          aria-label="Daftar notifikasi"
        >
          {loading ? (
            <li className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">Memuat...</li>
          ) : null}

          {!loading &&
            items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => handleItemClick(n)}
                  className={`w-full rounded-xl border px-3 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 ${
                    n.read
                      ? "border-transparent bg-white hover:border-gray-200 hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800"
                      : "border-brand-200 bg-brand-50/70 hover:border-brand-300 hover:bg-brand-50 dark:border-brand-500/40 dark:bg-brand-500/15 dark:hover:bg-brand-500/20"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                        n.read ? "bg-gray-300 dark:bg-gray-600" : "bg-brand-500"
                      }`}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{n.title}</p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {new Date(n.createdAt).toLocaleString()}
                      </p>
                      {n.message ? (
                        <p className="mt-1 line-clamp-2 text-sm text-gray-600 dark:text-gray-300">{n.message}</p>
                      ) : null}
                    </div>
                  </div>
                </button>
              </li>
            ))}

          {!loading && items.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">Tidak ada notifikasi</li>
          ) : null}
        </ul>

        <Link
          href="/system-user/notifications/user"
          className="mt-3 inline-flex items-center justify-center rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          onClick={closeDropdown}
        >
          Lihat Semua Notifikasi
        </Link>
      </Dropdown>
    </div>
  );
}
