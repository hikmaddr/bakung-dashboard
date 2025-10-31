"use client";
import Image from "next/image";
import Link from "next/link";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
type NotificationItem = {
  id: number;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
};
import { Dropdown } from "../ui/dropdown/Dropdown";
import { DropdownItem } from "../ui/dropdown/DropdownItem";
import { useGlobal } from "@/context/AppContext";
import { Modal } from "@/components/ui/modal";

export default function NotificationDropdown() {
  const { hasRole } = useGlobal();
  const [isOpen, setIsOpen] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [menuStyles, setMenuStyles] = useState<React.CSSProperties | undefined>(undefined);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [decliningId, setDecliningId] = useState<number | null>(null);
  const [declineError, setDeclineError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState<boolean>(false);
  const [selected, setSelected] = useState<NotificationItem | null>(null);
  const [roleModalOpen, setRoleModalOpen] = useState<boolean>(false);
  const [roleOptions, setRoleOptions] = useState<{ id: number; name: string }[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>("User");
  const [pendingApproval, setPendingApproval] = useState<{ notif: NotificationItem; userId: number } | null>(null);

  async function loadNotifications() {
    try {
      setLoading(true);
      const res = await fetch("/api/notifications", { cache: "no-store" });
      const json = await res.json();
      if (json?.success && Array.isArray(json.data)) {
        const mapped = json.data.map((n: any) => ({
          id: n.id,
          title: n.title,
          message: n.message,
          type: n.type,
          read: n.read ?? n.isRead ?? false,
          createdAt: n.createdAt,
        })) as NotificationItem[];
        setItems(mapped);
        setNotifying(mapped.some((n: NotificationItem) => !n.read));
      }
    } catch (err) {
      // silent
    } finally {
      setLoading(false);
    }
  }

  function toggleDropdown() {
    setIsOpen(!isOpen);
  }

  function closeDropdown() {
    setIsOpen(false);
  }

  async function updateRead(ids: number[] | undefined, read: boolean = true) {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.isArray(ids) ? ids : [], read }),
      });
    } catch {}
  }

  const handleClick = async () => {
    toggleDropdown();
    try {
      // Tandai semua sebagai dibaca saat dropdown dibuka
      await updateRead([], true);
    } finally {
      loadNotifications();
    }
  };

  function isApprovalNotification(n: NotificationItem): boolean {
    const s = `${n.title} ${n.message}`.toLowerCase();
    // deteksi sederhana untuk notifikasi signup yang butuh approval
    return s.includes("approve") || s.includes("approval") || s.includes("mendaftar");
  }

  function extractEmailFromText(text: string): string | null {
    const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    return match ? match[0] : null;
  }

  async function approveFromNotification(n: NotificationItem) {
    setApproveError(null);
    const email = extractEmailFromText(`${n.title} ${n.message}`);
    if (!email) {
      setApproveError("Email tidak ditemukan di pesan notifikasi.");
      return;
    }
    try {
      setApprovingId(n.id);
      // Cari user pending berdasarkan email
      const listRes = await fetch(`/api/users?status=pending`, { cache: "no-store" });
      const listJson = await listRes.json();
      if (!listJson?.success || !Array.isArray(listJson?.data)) {
        throw new Error(listJson?.message || "Gagal memuat daftar user.");
      }
      const target = listJson.data.find((u: any) => String(u.email).toLowerCase() === email.toLowerCase());
      if (!target?.id) {
        throw new Error("User dengan email tersebut tidak ditemukan dalam status pending.");
      }
      // Load role options, lalu buka modal pemilihan role
      const rolesRes = await fetch(`/api/roles`, { cache: "no-store" });
      const rolesJson = await rolesRes.json();
      const roles = Array.isArray(rolesJson?.data) ? rolesJson.data : [];
      setRoleOptions(roles.map((r: any) => ({ id: r.id, name: r.name })));
      setSelectedRole(roles[0]?.name || "User");
      setPendingApproval({ notif: n, userId: Number(target.id) });
      setRoleModalOpen(true);
    } catch (e: any) {
      setApproveError(e?.message || "Terjadi kesalahan saat approval.");
    } finally {
      setApprovingId(null);
    }
  }

  async function confirmApproveWithRole() {
    if (!pendingApproval) { setRoleModalOpen(false); return; }
    const { notif, userId } = pendingApproval;
    try {
      const approveRes = await fetch(`/api/users/${userId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleName: selectedRole }),
      });
      const approveJson = await approveRes.json();
      if (!approveJson?.success) {
        throw new Error(approveJson?.message || "Gagal melakukan approval.");
      }
      // Hapus notifikasi (PATCH read=true kini menghapus)
      await updateRead([notif.id], true);
      setItems((prev) => {
        const next = prev.filter((it) => it.id !== notif.id);
        setNotifying(next.some((it) => !it.read));
        return next;
      });
    } catch (e: any) {
      setApproveError(e?.message || "Terjadi kesalahan saat approval.");
    } finally {
      setRoleModalOpen(false);
      setPendingApproval(null);
    }
  }

  async function declineFromNotification(n: NotificationItem) {
    setDeclineError(null);
    const email = extractEmailFromText(`${n.title} ${n.message}`);
    if (!email) {
      setDeclineError("Email tidak ditemukan di pesan notifikasi.");
      return;
    }
    try {
      setDecliningId(n.id);
      const listRes = await fetch(`/api/users?status=pending`, { cache: "no-store" });
      const listJson = await listRes.json();
      if (!listJson?.success || !Array.isArray(listJson?.data)) {
        throw new Error(listJson?.message || "Gagal memuat daftar user.");
      }
      const target = listJson.data.find((u: any) => String(u.email).toLowerCase() === email.toLowerCase());
      if (!target?.id) {
        throw new Error("User dengan email tersebut tidak ditemukan dalam status pending.");
      }
      const res = await fetch(`/api/users/${target.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json?.success) {
        throw new Error(json?.message || "Gagal melakukan decline.");
      }
      await updateRead([n.id], true);
      setItems((prev) => {
        const next = prev.map((it) => (it.id === n.id ? { ...it, read: true } : it));
        setNotifying(next.some((it) => !it.read));
        return next;
      });
    } catch (e: any) {
      setDeclineError(e?.message || "Terjadi kesalahan saat decline.");
    } finally {
      setDecliningId(null);
    }
  }

  function openPreview(n: NotificationItem) {
    setSelected(n);
    setPreviewOpen(true);
  }
  useLayoutEffect(() => {
    if (!isOpen) return;
    const updatePosition = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const padding = 12;
      const minWidth = 300;
      const maxWidth = 380;
      const available = window.innerWidth - padding * 2;
      const width = Math.min(Math.max(minWidth, Math.min(maxWidth, available)), 400);

      const viewportLeft = padding;
      const viewportRight = window.innerWidth - padding - width;
      // Align to the right edge of the trigger by default
      const preferredLeft = Math.round(rect.right - width);
      const left = Math.min(Math.max(preferredLeft, viewportLeft), viewportRight);

      const estimatedHeight = Math.min(520, Math.round(window.innerHeight * 0.8));
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
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  useEffect(() => {
    loadNotifications();
    const t = setInterval(loadNotifications, 60000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        className="relative dropdown-toggle flex items-center justify-center text-gray-500 transition-colors bg-white border border-gray-200 rounded-full hover:text-gray-700 h-11 w-11 hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
        onClick={handleClick}
      >
        <span
          className={`absolute right-0 top-0.5 z-10 h-2 w-2 rounded-full ${
            !notifying ? "hidden" : "flex"
          }`}
          style={{ backgroundColor: "var(--brand-primary, #0EA5E9)" }}
        >
          <span className="absolute inline-flex w-full h-full rounded-full opacity-75 animate-ping" style={{ backgroundColor: "var(--brand-primary, #0EA5E9)" }}></span>
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
        className="flex flex-col w-full max-w-[94vw] max-h-[80vh] rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark"
      >
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100 dark:border-gray-700">
          <h5 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            Notification
          </h5>
          <button
            onClick={toggleDropdown}
            className="text-gray-500 transition dropdown-toggle dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            <svg
              className="fill-current"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M6.21967 7.28131C5.92678 6.98841 5.92678 6.51354 6.21967 6.22065C6.51256 5.92775 6.98744 5.92775 7.28033 6.22065L11.999 10.9393L16.7176 6.22078C17.0105 5.92789 17.4854 5.92788 17.7782 6.22078C18.0711 6.51367 18.0711 6.98855 17.7782 7.28144L13.0597 12L17.7782 16.7186C18.0711 17.0115 18.0711 17.4863 17.7782 17.7792C17.4854 18.0721 17.0105 18.0721 16.7176 17.7792L11.999 13.0607L7.28033 17.7794C6.98744 18.0722 6.51256 18.0722 6.21967 17.7794C5.92678 17.4865 5.92678 17.0116 6.21967 16.7187L10.9384 12L6.21967 7.28131Z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>
        <ul className="flex flex-col h-auto overflow-y-auto custom-scrollbar" style={{ maxHeight: "calc(80vh - 90px)" }}>
          {loading && (
            <li className="px-4 py-2 text-sm text-gray-500">Memuat...</li>
          )}
          {!loading && items.length > 0 && items.map((n) => (
            <li key={n.id}>
              <DropdownItem
                onItemClick={async () => {
                  await updateRead([n.id], true);
                  setItems((prev) => {
                    const next = prev.map((it) => (it.id === n.id ? { ...it, read: true } : it));
                    setNotifying(next.some((it) => !it.read));
                    return next;
                  });
                  closeDropdown();
                }}
                className="flex gap-3 rounded-lg border-b border-gray-100 p-3 px-4.5 py-3 hover:bg-gray-100 dark:border-gray-800 dark:hover:bg-white/5"
              >
                <span className="relative block w-full h-10 rounded-full z-1 max-w-10">
                  <Image
                    width={40}
                    height={40}
                    src="/images/user/user-02.jpg"
                    alt="User"
                    className="w-full overflow-hidden rounded-full"
                  />
                  <span className="absolute bottom-0 right-0 z-10 h-2.5 w-full max-w-2.5 rounded-full border-[1.5px] border-white dark:border-gray-900" style={{ backgroundColor: !n.read ? "var(--brand-primary, #0EA5E9)" : "#9CA3AF" }}></span>
                </span>

                <span className="block">
                  <span className="mb-1.5 space-x-1 block text-theme-sm text-gray-700 dark:text-gray-300">
                    <span className="font-medium text-gray-900 dark:text-white">{n.title}</span>
                    <span className="text-gray-600 dark:text-gray-400">{n.message}</span>
                  </span>
                  <span className="flex items-center gap-2 text-gray-500 text-theme-xs dark:text-gray-400">
                    <span>{new Date(n.createdAt).toLocaleString()}</span>
                    {!n.read && (
                      <span
                        className="inline-block w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: "var(--brand-primary, #0EA5E9)" }}
                      />
                    )}
                  </span>
                  {hasRole("owner") && isApprovalNotification(n) && (
                    <div className="mt-2 flex items-center gap-2">
                      <span
                        role="button"
                        tabIndex={0}
                        className="px-3 py-1.5 text-sm inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-800 hover:bg-gray-100 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                        onClick={(e) => { e.stopPropagation(); approveFromNotification(n); }}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); approveFromNotification(n); } }}
                        aria-label="Approve user"
                        aria-disabled={approvingId === n.id}
                      >
                        {approvingId === n.id ? "Meng-approve..." : "Approve"}
                      </span>
                      <span
                        role="button"
                        tabIndex={0}
                        className="px-3 py-1.5 text-sm inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-800 hover:bg-gray-100 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                        onClick={(e) => { e.stopPropagation(); declineFromNotification(n); }}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); declineFromNotification(n); } }}
                        aria-label="Decline user"
                        aria-disabled={decliningId === n.id}
                      >
                        {decliningId === n.id ? "Menolak..." : "Decline"}
                      </span>
                      <span
                        role="button"
                        tabIndex={0}
                        className="px-3 py-1.5 text-sm inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-800 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                        onClick={(e) => { e.stopPropagation(); openPreview(n); }}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); openPreview(n); } }}
                        aria-label="Preview notification"
                      >
                        Preview
                      </span>
                      {approveError && approvingId === null && (
                        <span className="text-xs text-red-600">{approveError}</span>
                      )}
                      {declineError && decliningId === null && (
                        <span className="text-xs text-red-600">{declineError}</span>
                      )}
                    </div>
                  )}
                </span>
              </DropdownItem>
            </li>
          ))}
          {!loading && items.length === 0 && (
            <li className="px-4 py-2 text-sm text-gray-500">Tidak ada notifikasi</li>
          )}
          {/* Placeholder examples (disabled) */}{false && (<>
          <li>
            <DropdownItem
              onItemClick={closeDropdown}
              className="flex gap-3 rounded-lg border-b border-gray-100 p-3 px-4.5 py-3 hover:bg-gray-100 dark:border-gray-800 dark:hover:bg-white/5"
            >
              <span className="relative block w-full h-10 rounded-full z-1 max-w-10">
                <Image
                  width={40}
                  height={40}
                  src="/images/user/user-02.jpg"
                  alt="User"
                  className="w-full overflow-hidden rounded-full"
                />
                <span className="absolute bottom-0 right-0 z-10 h-2.5 w-full max-w-2.5 rounded-full border-[1.5px] border-white bg-success-500 dark:border-gray-900"></span>
              </span>

              <span className="block">
                <span className="mb-1.5 space-x-1 block text-theme-sm text-gray-500 dark:text-gray-400">
                  <span className="font-medium text-gray-800 dark:text-white/90">
                    Terry Franci
                  </span>
                  <span>requests permission to change</span>
                  <span className="font-medium text-gray-800 dark:text-white/90">
                    Project - Nganter App
                  </span>
                </span>

                <span className="flex items-center gap-2 text-gray-500 text-theme-xs dark:text-gray-400">
                  <span>Project</span>
                  <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                  <span>5 min ago</span>
                </span>
              </span>
            </DropdownItem>
          </li>

          <li>
            <DropdownItem
              onItemClick={closeDropdown}
              className="flex gap-3 rounded-lg border-b border-gray-100 p-3 px-4.5 py-3 hover:bg-gray-100 dark:border-gray-800 dark:hover:bg-white/5"
            >
              <span className="relative block w-full h-10 rounded-full z-1 max-w-10">
                <Image
                  width={40}
                  height={40}
                  src="/images/user/user-03.jpg"
                  alt="User"
                  className="w-full overflow-hidden rounded-full"
                />
                <span className="absolute bottom-0 right-0 z-10 h-2.5 w-full max-w-2.5 rounded-full border-[1.5px] border-white bg-success-500 dark:border-gray-900"></span>
              </span>

              <span className="block">
                <span className="mb-1.5 block space-x-1  text-theme-sm text-gray-500 dark:text-gray-400">
                  <span className="font-medium text-gray-800 dark:text-white/90">
                    Alena Franci
                  </span>
                  <span> requests permission to change</span>
                  <span className="font-medium text-gray-800 dark:text-white/90">
                    Project - Nganter App
                  </span>
                </span>

                <span className="flex items-center gap-2 text-gray-500 text-theme-xs dark:text-gray-400">
                  <span>Project</span>
                  <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                  <span>8 min ago</span>
                </span>
              </span>
            </DropdownItem>
          </li>

          <li>
            <DropdownItem
              onItemClick={closeDropdown}
              className="flex gap-3 rounded-lg border-b border-gray-100 p-3 px-4.5 py-3 hover:bg-gray-100 dark:border-gray-800 dark:hover:bg-white/5"
              href="#"
            >
              <span className="relative block w-full h-10 rounded-full z-1 max-w-10">
                <Image
                  width={40}
                  height={40}
                  src="/images/user/user-04.jpg"
                  alt="User"
                  className="w-full overflow-hidden rounded-full"
                />
                <span className="absolute bottom-0 right-0 z-10 h-2.5 w-full max-w-2.5 rounded-full border-[1.5px] border-white bg-success-500 dark:border-gray-900"></span>
              </span>

              <span className="block">
                <span className="mb-1.5 block space-x-1 text-theme-sm text-gray-500 dark:text-gray-400">
                  <span className="font-medium text-gray-800 dark:text-white/90">
                    Jocelyn Kenter
                  </span>
                  <span>requests permission to change</span>
                  <span className="font-medium text-gray-800 dark:text-white/90">
                    Project - Nganter App
                  </span>
                </span>

                <span className="flex items-center gap-2 text-gray-500 text-theme-xs dark:text-gray-400">
                  <span>Project</span>
                  <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                  <span>15 min ago</span>
                </span>
              </span>
            </DropdownItem>
          </li>

          <li>
            <DropdownItem
              onItemClick={closeDropdown}
              className="flex gap-3 rounded-lg border-b border-gray-100 p-3 px-4.5 py-3 hover:bg-gray-100 dark:border-gray-800 dark:hover:bg-white/5"
              href="#"
            >
              <span className="relative block w-full h-10 rounded-full z-1 max-w-10">
                <Image
                  width={40}
                  height={40}
                  src="/images/user/user-05.jpg"
                  alt="User"
                  className="w-full overflow-hidden rounded-full"
                />
                <span className="absolute bottom-0 right-0 z-10 h-2.5 w-full max-w-2.5 rounded-full border-[1.5px] border-white bg-error-500 dark:border-gray-900"></span>
              </span>

              <span className="block">
                <span className="mb-1.5 space-x-1 block text-theme-sm text-gray-500 dark:text-gray-400">
                  <span className="font-medium text-gray-800 dark:text-white/90">
                    Brandon Philips
                  </span>
                  <span> requests permission to change</span>
                  <span className="font-medium text-gray-800 dark:text-white/90">
                    Project - Nganter App
                  </span>
                </span>

                <span className="flex items-center gap-2 text-gray-500 text-theme-xs dark:text-gray-400">
                  <span>Project</span>
                  <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                  <span>1 hr ago</span>
                </span>
              </span>
            </DropdownItem>
          </li>

          <li>
            <DropdownItem
              className="flex gap-3 rounded-lg border-b border-gray-100 p-3 px-4.5 py-3 hover:bg-gray-100 dark:border-gray-800 dark:hover:bg-white/5"
              onItemClick={closeDropdown}
            >
              <span className="relative block w-full h-10 rounded-full z-1 max-w-10">
                <Image
                  width={40}
                  height={40}
                  src="/images/user/user-02.jpg"
                  alt="User"
                  className="w-full overflow-hidden rounded-full"
                />
                <span className="absolute bottom-0 right-0 z-10 h-2.5 w-full max-w-2.5 rounded-full border-[1.5px] border-white bg-success-500 dark:border-gray-900"></span>
              </span>

              <span className="block">
                <span className="mb-1.5 space-x-1 block text-theme-sm text-gray-500 dark:text-gray-400">
                  <span className="font-medium text-gray-800 dark:text-white/90">
                    Terry Franci
                  </span>
                  <span>requests permission to change</span>
                  <span className="font-medium text-gray-800 dark:text-white/90">
                    Project - Nganter App
                  </span>
                </span>

                <span className="flex items-center gap-2 text-gray-500 text-theme-xs dark:text-gray-400">
                  <span>Project</span>
                  <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                  <span>5 min ago</span>
                </span>
              </span>
            </DropdownItem>
          </li>

          <li>
            <DropdownItem
              onItemClick={closeDropdown}
              className="flex gap-3 rounded-lg border-b border-gray-100 p-3 px-4.5 py-3 hover:bg-gray-100 dark:border-gray-800 dark:hover:bg-white/5"
            >
              <span className="relative block w-full h-10 rounded-full z-1 max-w-10">
                <Image
                  width={40}
                  height={40}
                  src="/images/user/user-03.jpg"
                  alt="User"
                  className="w-full overflow-hidden rounded-full"
                />
                <span className="absolute bottom-0 right-0 z-10 h-2.5 w-full max-w-2.5 rounded-full border-[1.5px] border-white bg-success-500 dark:border-gray-900"></span>
              </span>

              <span className="block">
                <span className="mb-1.5 space-x-1 block text-theme-sm text-gray-500 dark:text-gray-400">
                  <span className="font-medium text-gray-800 dark:text-white/90">
                    Alena Franci
                  </span>
                  <span>requests permission to change</span>
                  <span className="font-medium text-gray-800 dark:text-white/90">
                    Project - Nganter App
                  </span>
                </span>

                <span className="flex items-center gap-2 text-gray-500 text-theme-xs dark:text-gray-400">
                  <span>Project</span>
                  <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                  <span>8 min ago</span>
                </span>
              </span>
            </DropdownItem>
          </li>

          <li>
            <DropdownItem
              onItemClick={closeDropdown}
              className="flex gap-3 rounded-lg border-b border-gray-100 p-3 px-4.5 py-3 hover:bg-gray-100 dark:border-gray-800 dark:hover:bg-white/5"
            >
              <span className="relative block w-full h-10 rounded-full z-1 max-w-10">
                <Image
                  width={40}
                  height={40}
                  src="/images/user/user-04.jpg"
                  alt="User"
                  className="w-full overflow-hidden rounded-full"
                />
                <span className="absolute bottom-0 right-0 z-10 h-2.5 w-full max-w-2.5 rounded-full border-[1.5px] border-white bg-success-500 dark:border-gray-900"></span>
              </span>

              <span className="block">
                <span className="mb-1.5 space-x-1 block text-theme-sm text-gray-500 dark:text-gray-400">
                  <span className="font-medium text-gray-800 dark:text-white/90">
                    Jocelyn Kenter
                  </span>
                  <span>requests permission to change</span>
                  <span className="font-medium text-gray-800 dark:text-white/90">
                    Project - Nganter App
                  </span>
                </span>

                <span className="flex items-center gap-2 text-gray-500 text-theme-xs dark:text-gray-400">
                  <span>Project</span>
                  <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                  <span>15 min ago</span>
                </span>
              </span>
            </DropdownItem>
          </li>

          <li>
            <DropdownItem
              onItemClick={closeDropdown}
              className="flex gap-3 rounded-lg border-b border-gray-100 p-3 px-4.5 py-3 hover:bg-gray-100 dark:border-gray-800 dark:hover:bg-white/5"
              href="#"
            >
              <span className="relative block w-full h-10 rounded-full z-1 max-w-10">
                <Image
                  width={40}
                  height={40}
                  src="/images/user/user-05.jpg"
                  alt="User"
                  className="overflow-hidden rounded-full"
                />
                <span className="absolute bottom-0 right-0 z-10 h-2.5 w-full max-w-2.5 rounded-full border-[1.5px] border-white bg-error-500 dark:border-gray-900"></span>
              </span>

              <span className="block">
                <span className="mb-1.5 space-x-1 block text-theme-sm text-gray-500 dark:text-gray-400">
                  <span className="font-medium text-gray-800 dark:text-white/90">
                    Brandon Philips
                  </span>
                  <span>requests permission to change</span>
                  <span className="font-medium text-gray-800 dark:text-white/90">
                    Project - Nganter App
                  </span>
                </span>

                <span className="flex items-center gap-2 text-gray-500 text-theme-xs dark:text-gray-400">
                  <span>Project</span>
                  <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                  <span>1 hr ago</span>
                </span>
              </span>
            </DropdownItem>
          </li>
          </>)}{/* Add more items as needed */}
        </ul>
        <Link
          href="/system-user/notifications/user"
          className="block px-4 py-2 mt-3 text-sm font-medium text-center text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          View All Notifications
        </Link>
      </Dropdown>
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
                      onClick={() => selected && approveFromNotification(selected)}
                    >
                      Approve
                    </button>
                    <button
                      className="rounded-full bg-red-600 px-3 py-1.5 text-white text-sm hover:bg-red-700"
                      onClick={() => selected && declineFromNotification(selected)}
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
    </div>
  );
}
