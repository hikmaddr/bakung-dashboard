import React from "react";

export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div className="h-8 w-64 bg-gray-200 dark:bg-gray-800 rounded-lg"></div>
          <div className="h-4 w-96 bg-gray-100 dark:bg-gray-800/50 rounded-lg"></div>
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-20 bg-gray-100 dark:bg-gray-800 rounded-full"></div>
          <div className="h-8 w-20 bg-gray-100 dark:bg-gray-800 rounded-full"></div>
          <div className="h-8 w-20 bg-gray-100 dark:bg-gray-800 rounded-full"></div>
        </div>
      </header>

      {/* Metric Cards Skeleton */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-3">
                <div className="h-3 w-24 bg-gray-100 dark:bg-gray-800 rounded"></div>
                <div className="h-8 w-32 bg-gray-200 dark:bg-gray-800 rounded"></div>
              </div>
              <div className="h-6 w-12 bg-gray-100 dark:bg-gray-800 rounded-full"></div>
            </div>
            <div className="mt-4 space-y-2">
              <div className="h-3 w-full bg-gray-50 dark:bg-gray-800/30 rounded"></div>
              <div className="h-3 w-2/3 bg-gray-50 dark:bg-gray-800/30 rounded"></div>
            </div>
          </div>
        ))}
      </section>

      {/* Charts & Tables Skeleton */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] xl:col-span-2">
          <div className="h-6 w-48 bg-gray-200 dark:bg-gray-800 rounded mb-6"></div>
          <div className="h-64 w-full bg-gray-50 dark:bg-gray-800/30 rounded-xl"></div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="h-6 w-40 bg-gray-200 dark:bg-gray-800 rounded mb-6"></div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-800"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-full bg-gray-100 dark:bg-gray-800 rounded"></div>
                  <div className="h-3 w-1/2 bg-gray-50 dark:bg-gray-800/30 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recent Lists Skeleton */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between mb-6">
              <div className="h-5 w-32 bg-gray-200 dark:bg-gray-800 rounded"></div>
              <div className="h-4 w-12 bg-gray-100 dark:bg-gray-800 rounded"></div>
            </div>
            <div className="space-y-4">
              {[...Array(4)].map((_, j) => (
                <div key={j} className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-gray-800/50 last:border-0">
                  <div className="space-y-2">
                    <div className="h-4 w-24 bg-gray-100 dark:bg-gray-800 rounded"></div>
                    <div className="h-3 w-32 bg-gray-50 dark:bg-gray-800/30 rounded"></div>
                  </div>
                  <div className="h-4 w-16 bg-gray-100 dark:bg-gray-800 rounded"></div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
