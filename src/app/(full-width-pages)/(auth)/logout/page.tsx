"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useGlobal } from "@/context/AppContext";

export default function LogoutPage() {
  const router = useRouter();
  const { refresh } = useGlobal();

  useEffect(() => {
    const run = async () => {
      try {
        await fetch("/api/auth/logout", { method: "POST" });
        // Beri sedikit jeda agar UI terlihat lalu segarkan state global
        await new Promise((r) => setTimeout(r, 300));
        await refresh();
      } catch {}
      router.replace("/signin");
    };
    run();
  }, [router, refresh]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white shadow-theme-lg p-6 text-center dark:border-gray-800 dark:bg-gray-800">
        <div className="mx-auto mb-4 h-12 w-12 rounded-full border-2 border-gray-300 border-t-transparent animate-spin dark:border-gray-600" />
        <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Sedang logout</h1>
        <p className="mt-1 text-theme-sm text-gray-600 dark:text-gray-300">
          Menghapus sesi Anda dan mengalihkan ke halaman masuk.
        </p>
        <p className="mt-4 text-theme-xs text-gray-500 dark:text-gray-400">
          Jika tidak dialihkan otomatis, klik tombol di bawah ini.
        </p>
        <Link
          href="/signin"
          className="mt-4 inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-theme-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
        >
          Masuk kembali
        </Link>
      </div>
    </div>
  );
}
