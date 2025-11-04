"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSidebar } from "@/context/SidebarContext";
import AppHeader from "@/components/layout/AppHeader";
import AppSidebar from "@/components/layout/AppSidebar";
import Backdrop from "@/components/layout/Backdrop";
import { ThemeProvider } from "@/context/ThemeContext";
import { FeedbackProvider } from "@/context/FeedbackContext";
import IdleWatcher from "@/components/IdleWatcher";
import BrandSelectOnLogin from "@/components/header/BrandSelectOnLogin";
import RouteTransition from "@/layout/RouteTransition";
import { Modal } from "@/components/ui/modal";
import { useRouter, useSearchParams } from "next/navigation";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [userId, setUserId] = useState<number | null>(null);
  const [profileIncomplete, setProfileIncomplete] = useState<boolean>(false);

  // Ambil profil untuk mengetahui kelengkapan dan id user
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/profile", { cache: "no-store" });
        const json = await res.json();
        if (!cancelled && json?.success && json?.data) {
          const d = json.data as { id: number; firstName?: string | null; lastName?: string | null; phone?: string | null };
          setUserId(d.id);
          const incomplete = !d?.firstName || !d?.lastName || !d?.phone;
          setProfileIncomplete(incomplete);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  // Baca flag welcome dari query sekali saat mount, dan tampilkan hanya jika profil belum lengkap dan belum pernah ditampilkan di browser ini
  useEffect(() => {
    if (!searchParams) return;
    const welcome = searchParams.get("welcome");
    if (welcome === "1") {
      const key = userId ? `welcome_shown:${userId}` : null;
      const already = key ? (typeof window !== "undefined" && localStorage.getItem(key) === "1") : true;
      if (profileIncomplete && !already) {
        setWelcomeOpen(true);
        // Tandai sudah tampil agar hanya sekali (per browser per user)
        try { if (key) localStorage.setItem(key, "1"); } catch {}
      }
      // Hapus query param agar tidak muncul lagi ketika navigate
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("welcome");
        router.replace(url.pathname + (url.search ? `?${url.searchParams.toString()}` : ""));
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, profileIncomplete]);

  const mainContentMargin = isMobileOpen
    ? "ml-0"
    : isExpanded || isHovered
    ? "lg:ml-[290px]"
    : "lg:ml-[90px]";

  return (
    <ThemeProvider>
        <FeedbackProvider>
        <div className="min-h-screen xl:flex">
          {/* Sidebar */}
          <AppSidebar />

          {/* Backdrop (untuk mobile sidebar) */}
          <Backdrop />

          {/* Main Content Area */}
          <div
            className={`flex-1 flex flex-col transition-all duration-300 ease-in-out ${mainContentMargin}`}
          >
            {/* Idle auto-logout watcher */}
            <IdleWatcher />
            {/* Brand selection modal on login if multiple brands */}
            <BrandSelectOnLogin />
            {/* Header */}
            <AppHeader />

            {/* Page Content */}
            <main className="p-4 md:p-6 max-w-[--breakpoint-2xl] mx-auto w-full">
              <RouteTransition>
                {children}
              </RouteTransition>
            </main>

            {/* Welcome Modal setelah login */}
            <Modal isOpen={welcomeOpen} onClose={() => setWelcomeOpen(false)}>
              <div className="p-6">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Selamat Datang 👋</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Login berhasil. Untuk pengalaman terbaik, mohon segera lengkapi data profil Anda.
                </p>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => setWelcomeOpen(false)}
                    className="rounded-lg border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-800"
                  >
                    Nanti Saja
                  </button>
                  <button
                    onClick={() => {
                      setWelcomeOpen(false);
                      router.push("/profile");
                    }}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                  >
                    Lengkapi Profil
                  </button>
                </div>
              </div>
            </Modal>
          </div>
        </div>
        </FeedbackProvider>
    </ThemeProvider>
  );
}
