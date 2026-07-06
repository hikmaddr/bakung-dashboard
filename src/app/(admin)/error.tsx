"use client";

import React, { useEffect } from "react";
import { AlertCircle, RotateCcw, Home } from "lucide-react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("[GlobalAdminError]", error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center">
      <div className="relative mb-8">
        <div className="absolute inset-0 animate-ping rounded-full bg-rose-500/20" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-rose-500 shadow-lg shadow-rose-500/20">
          <AlertCircle className="h-10 w-10 text-white" />
        </div>
      </div>

      <h1 className="mb-2 text-3xl font-black tracking-tight text-gray-900 dark:text-white">
        Terjadi Kesalahan Sistem
      </h1>
      <p className="mb-10 max-w-md text-gray-500 dark:text-gray-400">
        Maaf, sistem mengalami kendala teknis saat memproses halaman ini. Kami telah mencatat kesalahan ini untuk segera diperbaiki.
      </p>

      {error.digest && (
        <div className="mb-10 rounded-lg bg-gray-100 px-3 py-1 text-[10px] font-mono text-gray-500 dark:bg-gray-800 dark:text-gray-500">
          Error ID: {error.digest}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          onClick={() => reset()}
          className="flex items-center justify-center gap-2 rounded-2xl bg-gray-900 px-8 py-3 text-sm font-bold text-white transition-all hover:bg-black hover:shadow-xl dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
        >
          <RotateCcw className="h-4 w-4" />
          Coba Lagi
        </button>
        <Link
          href="/"
          className="flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-8 py-3 text-sm font-bold text-gray-700 transition-all hover:bg-gray-50 hover:shadow-lg dark:border-gray-800 dark:bg-transparent dark:text-gray-300 dark:hover:bg-white/5"
        >
          <Home className="h-4 w-4" />
          Ke Beranda
        </Link>
      </div>

      <div className="mt-12 text-[10px] uppercase tracking-[0.2em] text-gray-400">
        &copy; {new Date().getFullYear()} Bakung Dashboard — HDP Works.
      </div>
    </div>
  );
}
