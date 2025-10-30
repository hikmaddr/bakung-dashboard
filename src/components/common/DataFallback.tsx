"use client";

import React from "react";
import EmptyState from "@/components/EmptyState";

type FallbackProps = {
  title?: string;
  description?: string;
  retryLabel?: string;
  onRetry?: () => void;
};

export function EmptyDataFallback({
  title = "Data belum tersedia",
  description = "Belum ada data yang bisa ditampilkan saat ini.",
  retryLabel,
  onRetry,
}: FallbackProps) {
  return (
    <EmptyState
      title={title}
      description={description}
      actions={
        onRetry ? (
          <button
            onClick={onRetry}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200"
          >
            {retryLabel || "Muat Ulang"}
          </button>
        ) : undefined
      }
    />
  );
}

export function ErrorDataFallback({
  title = "Terjadi kesalahan",
  description = "Terjadi kesalahan saat mengambil data. Coba ulangi.",
  retryLabel = "Coba lagi",
  onRetry,
}: FallbackProps) {
  return (
    <EmptyState
      title={title}
      description={description}
      imageSrc="/images/error/500.svg"
      actions={
        onRetry ? (
          <button
            onClick={onRetry}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200"
          >
            {retryLabel}
          </button>
        ) : undefined
      }
    />
  );
}

