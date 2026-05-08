"use client";
import React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

const currencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value ?? 0);
}

interface TopCustomersProps {
  topCustomers: { id: number; name: string; total: number; invoices: number }[];
}

export const TopCustomers: React.FC<TopCustomersProps> = ({ topCustomers }) => {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white/90">Pelanggan Teratas</h2>
        <Link href="/client/list" className="text-xs text-blue-600 hover:underline">Semua Pelanggan</Link>
      </div>
      <div className="space-y-4">
        {topCustomers.map((c, i) => (
          <div key={c.id} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500 dark:bg-gray-800">
                {i + 1}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-900 dark:text-white/90 truncate max-w-[120px] md:max-w-none">
                  {c.name}
                </span>
                <span className="text-[10px] text-gray-500">{c.invoices} transaksi</span>
              </div>
            </div>
            <span className="text-sm font-semibold text-gray-900 dark:text-white/80">
              {formatCurrency(c.total)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
