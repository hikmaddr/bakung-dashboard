"use client";
import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertCircle,
  CalendarClock,
  Truck,
  PackageSearch,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

const currencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export type ActionItem = {
  key: "pendingApproval" | "invoiceDue" | "orderUnshipped" | "purchaseUnreceived";
  count: number;
  amount?: number; // e.g. total tunggakan untuk invoiceDue
};

interface ActionCenterProps {
  items: ActionItem[];
}

const META: Record<
  ActionItem["key"],
  { label: string; sub: (i: ActionItem) => string; href: string; icon: any; accent: string; iconColor: string }
> = {
  pendingApproval: {
    label: "Menunggu Approval",
    sub: (i) => (i.count ? `${i.count} order butuh persetujuan` : "Semua order sudah disetujui"),
    href: "/penjualan/order-penjualan?status=Pending",
    icon: AlertCircle,
    accent: "border-l-amber-500 bg-amber-50/60 dark:bg-amber-500/[0.06]",
    iconColor: "text-amber-600 bg-amber-500/10",
  },
  invoiceDue: {
    label: "Invoice Jatuh Tempo",
    sub: (i) =>
      i.count && i.amount
        ? `Tunggakan ${currencyFormatter.format(i.amount)}`
        : "Tidak ada tunggakan",
    href: "/penjualan/invoice-penjualan?status=Sent",
    icon: CalendarClock,
    accent: "border-l-rose-500 bg-rose-50/60 dark:bg-rose-500/[0.06]",
    iconColor: "text-rose-600 bg-rose-500/10",
  },
  orderUnshipped: {
    label: "Belum Dikirim",
    sub: (i) => (i.count ? `${i.count} order perlu pengiriman` : "Semua order terkirim"),
    href: "/penjualan/order-penjualan?status=Approved",
    icon: Truck,
    accent: "border-l-sky-500 bg-sky-50/60 dark:bg-sky-500/[0.06]",
    iconColor: "text-sky-600 bg-sky-500/10",
  },
  purchaseUnreceived: {
    label: "Pembelian Belum Diterima",
    sub: (i) => (i.count ? `${i.count} PO menunggu penerimaan` : "Semua pembelian diterima"),
    href: "/pembelian/pembelian-langsung?status=Draft",
    icon: PackageSearch,
    accent: "border-l-violet-500 bg-violet-50/60 dark:bg-violet-500/[0.06]",
    iconColor: "text-violet-600 bg-violet-500/10",
  },
};

export const ActionCenter: React.FC<ActionCenterProps> = ({ items }) => {
  const totalActions = items.reduce((acc, i) => acc + i.count, 0);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Perlu Tindakan
        </h2>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
            totalActions
              ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          }`}
        >
          {totalActions ? `${totalActions} item` : "Semua beres"}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item, idx) => {
          const meta = META[item.key];
          const Icon = meta.icon;
          const idle = item.count === 0;
          return (
            <motion.div
              key={item.key}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.06, duration: 0.35 }}
            >
              <Link
                href={meta.href}
                className={`group flex items-center gap-3 rounded-2xl border border-gray-200/60 border-l-4 p-4 transition-all hover:shadow-md dark:border-white/10 ${
                  idle
                    ? "border-l-gray-300 bg-white dark:border-l-gray-700 dark:bg-white/[0.02]"
                    : meta.accent
                }`}
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    idle ? "bg-gray-100 text-gray-400 dark:bg-gray-800" : meta.iconColor
                  }`}
                >
                  {idle ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span
                      className={`text-xl font-black tabular-nums ${
                        idle ? "text-gray-400 dark:text-gray-600" : "text-gray-900 dark:text-white"
                      }`}
                    >
                      {item.count}
                    </span>
                    <span className="truncate text-[13px] font-semibold text-gray-700 dark:text-gray-300">
                      {meta.label}
                    </span>
                  </div>
                  <p className="truncate text-xs text-gray-500 dark:text-gray-400">{meta.sub(item)}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-gray-500" />
              </Link>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
};
