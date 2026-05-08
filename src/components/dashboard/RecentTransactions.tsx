"use client";
import React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { format } from "date-fns";

const currencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value ?? 0);
}

function normalizeStatus(status: string) {
  return (status ?? "unknown").toLowerCase().replace(/\s+/g, "_");
}

const STATUS_BADGE_MAP: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-300",
  sent: "bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300",
  confirmed: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300",
  approved: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300",
  rejected: "bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300",
  cancelled: "bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300",
  canceled: "bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300",
  pending: "bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300",
  processing: "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300",
  completed: "bg-green-100 text-green-600 dark:bg-green-500/10 dark:text-green-300",
  paid: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300",
  overdue: "bg-orange-100 text-orange-600 dark:bg-orange-500/10 dark:text-orange-300",
  partially_paid: "bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300",
  issued: "bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300",
};

function getStatusBadgeClass(status: string) {
  const normalized = normalizeStatus(status);
  return STATUS_BADGE_MAP[normalized] ?? "bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-300";
}

export type RecentItem = {
  id: number;
  number: string;
  customer: string;
  amount: number;
  date: Date;
  status: string;
  link: string;
};

export type RecentSection = {
  key: string;
  title: string;
  link: string;
  items: RecentItem[];
};

interface RecentTransactionsProps {
  recent: RecentSection[];
}

export const RecentTransactions: React.FC<RecentTransactionsProps> = ({ recent }) => {
  return (
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      {recent.map((section) => (
        <div
          key={section.key}
          className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]"
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white/90">
              {section.title}
            </h2>
            <Link
              href={section.link}
              className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              Lihat Semua
            </Link>
          </div>
          <div className="space-y-4">
            {section.items.length === 0 ? (
              <p className="py-8 text-center text-xs text-gray-400">Tidak ada data terbaru</p>
            ) : (
              section.items.map((item) => (
                <div
                  key={`${section.key}-${item.id}`}
                  className="group relative flex items-center justify-between rounded-xl border border-transparent p-2 transition hover:border-gray-100 hover:bg-gray-50 dark:hover:border-gray-800 dark:hover:bg-white/5"
                >
                  <div className="flex flex-col gap-1">
                    <Link
                      href={item.link}
                      className="text-sm font-medium text-gray-900 transition hover:text-blue-600 dark:text-white/90 dark:hover:text-blue-400"
                    >
                      {item.number}
                    </Link>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {item.customer} • {format(new Date(item.date), "dd MMM yyyy")}
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white/80">
                      {formatCurrency(item.amount)}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${getStatusBadgeClass(
                        item.status,
                      )}`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <Link
                    href={item.link}
                    className="absolute inset-0 opacity-0"
                    aria-hidden="true"
                  >
                    View
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>
      ))}
    </section>
  );
};
