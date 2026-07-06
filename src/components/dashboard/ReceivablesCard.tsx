"use client";
import React from "react";
import Link from "next/link";
import { Wallet } from "lucide-react";

const currencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export type ReceivablesData = {
  outstandingTotal: number; // seluruh piutang belum dibayar
  overdueTotal: number; // yang sudah lewat jatuh tempo
  overdueCount: number;
  aging: { label: string; amount: number; count: number }[];
};

const BUCKET_COLORS = ["bg-amber-400", "bg-orange-500", "bg-rose-600"];

export const ReceivablesCard: React.FC<{ data: ReceivablesData }> = ({ data }) => {
  const maxAmount = Math.max(...data.aging.map((b) => b.amount), 1);
  const overduePct = data.outstandingTotal
    ? Math.round((data.overdueTotal / data.outstandingTotal) * 100)
    : 0;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
            <Wallet className="h-4 w-4" />
          </div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white/90">Piutang & Kas Masuk</h2>
        </div>
        <Link href="/penjualan/invoice-penjualan" className="text-xs text-blue-600 hover:underline">
          Detail
        </Link>
      </div>

      <div className="mt-4">
        <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Total Piutang</p>
        <p className="mt-0.5 text-2xl font-black tracking-tight text-gray-900 dark:text-white">
          {currencyFormatter.format(data.outstandingTotal)}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div
              className="h-full rounded-full bg-rose-500 transition-all"
              style={{ width: `${Math.min(overduePct, 100)}%` }}
            />
          </div>
          <span className="text-[11px] font-semibold text-rose-500">{overduePct}% overdue</span>
        </div>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {data.overdueCount
            ? `${data.overdueCount} invoice lewat jatuh tempo — ${currencyFormatter.format(data.overdueTotal)}`
            : "Tidak ada invoice lewat jatuh tempo"}
        </p>
      </div>

      <div className="mt-5 space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Umur Tunggakan</p>
        {data.aging.map((bucket, idx) => (
          <div key={bucket.label}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium text-gray-600 dark:text-gray-300">
                {bucket.label}
                <span className="ml-1 text-gray-400">({bucket.count})</span>
              </span>
              <span className="font-semibold tabular-nums text-gray-900 dark:text-white/80">
                {currencyFormatter.format(bucket.amount)}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
              <div
                className={`h-full rounded-full ${BUCKET_COLORS[idx % BUCKET_COLORS.length]} transition-all`}
                style={{ width: `${Math.round((bucket.amount / maxAmount) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
