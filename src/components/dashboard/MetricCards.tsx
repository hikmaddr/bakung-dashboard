"use client";
import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { 
  Users, 
  FileText, 
  ShoppingBag, 
  Receipt, 
  AlertCircle, 
  Calendar, 
  Truck, 
  ShoppingCart,
  TrendingUp,
  TrendingDown
} from "lucide-react";

const currencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 0,
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value ?? 0);
}

function formatNumberValue(value: number) {
  return numberFormatter.format(value ?? 0);
}

export type DashboardCard = {
  key: string;
  title: string;
  value: number;
  format: "currency" | "number";
  lines: string[];
  trend?: number | null;
};

interface MetricCardsProps {
  cards: DashboardCard[];
  rangeDays: number;
}

const iconMap: Record<string, any> = {
  netMargin: TrendingUp,
  totalCost: Receipt,
  customers: Users,
  quotations: FileText,
  salesOrders: ShoppingBag,
  invoices: Receipt,
  pendingApproval: AlertCircle,
  invoiceDue: Calendar,
  orderUnshipped: Truck,
  purchaseUnreceived: ShoppingCart,
};

const colorMap: Record<string, { gradient: string; text: string; iconBg: string }> = {
  netMargin: { gradient: "from-emerald-500/10 to-green-500/10", text: "text-emerald-600", iconBg: "bg-emerald-500/10" },
  totalCost: { gradient: "from-slate-500/10 to-gray-500/10", text: "text-slate-600", iconBg: "bg-slate-500/10" },
  customers: { gradient: "from-blue-500/10 to-indigo-500/10", text: "text-blue-600", iconBg: "bg-blue-500/10" },
  quotations: { gradient: "from-amber-500/10 to-orange-500/10", text: "text-amber-600", iconBg: "bg-amber-500/10" },
  salesOrders: { gradient: "from-emerald-500/10 to-teal-500/10", text: "text-emerald-600", iconBg: "bg-emerald-500/10" },
  invoices: { gradient: "from-purple-500/10 to-pink-500/10", text: "text-purple-600", iconBg: "bg-purple-500/10" },
  pendingApproval: { gradient: "from-rose-500/10 to-red-500/10", text: "text-rose-600", iconBg: "bg-rose-500/10" },
  invoiceDue: { gradient: "from-orange-500/10 to-red-500/10", text: "text-orange-600", iconBg: "bg-orange-500/10" },
  orderUnshipped: { gradient: "from-sky-500/10 to-cyan-500/10", text: "text-sky-600", iconBg: "bg-sky-500/10" },
  purchaseUnreceived: { gradient: "from-violet-500/10 to-fuchsia-500/10", text: "text-violet-600", iconBg: "bg-violet-500/10" },
};

export const MetricCards: React.FC<MetricCardsProps> = ({ cards, rangeDays }) => {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
  };

  return (
    <motion.section 
      variants={container}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      {cards.map((card) => {
        const Icon = iconMap[card.key] || AlertCircle;
        const colors = colorMap[card.key] || colorMap.pendingApproval;
        const displayValue =
          card.format === "currency"
            ? formatCurrency(card.value)
            : formatNumberValue(card.value);

        const href = 
          card.key === "customers"
            ? `/client/list?range=${rangeDays}d`
            : card.key === "quotations"
            ? `/penjualan/quotation?range=${rangeDays}d&status=Confirmed`
            : card.key === "salesOrders"
            ? `/penjualan/order-penjualan?range=${rangeDays}d&status=Approved`
            : card.key === "invoices"
            ? `/penjualan/invoice-penjualan?range=${rangeDays}d&status=Sent`
            : card.key === "pendingApproval"
            ? `/penjualan/order-penjualan?status=Pending`
            : card.key === "invoiceDue"
            ? `/penjualan/invoice-penjualan?status=Sent`
            : card.key === "orderUnshipped"
            ? `/penjualan/order-penjualan?status=Approved`
            : card.key === "purchaseUnreceived"
            ? `/pembelian/pembelian-langsung?status=Draft`
            : card.key === "netMargin" || card.key === "totalCost"
            ? `/reporting`
            : "/";

        return (
          <motion.div
            key={card.key}
            variants={item}
            whileHover={{ y: -5, transition: { duration: 0.2 } }}
            className={`group relative overflow-hidden rounded-3xl border border-gray-200/50 bg-white p-6 shadow-sm backdrop-blur-sm transition-all hover:shadow-xl dark:border-white/10 dark:bg-white/[0.03]`}
          >
            {/* Background Decorative Gradient */}
            <div className={`absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br ${colors.gradient} blur-3xl transition-all group-hover:scale-150`} />

            <div className="relative flex items-start justify-between">
              <div className={`rounded-2xl ${colors.iconBg} p-3 transition-transform group-hover:scale-110`}>
                <Icon className={`h-6 w-6 ${colors.text}`} />
              </div>
              
              {typeof card.trend === "number" ? (
                <div className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  card.trend >= 0 
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                    : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                }`}>
                  {card.trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {Math.abs(card.trend).toFixed(1)}%
                </div>
              ) : null}
            </div>

            <div className="relative mt-5">
              <Link href={href} className="group/link block">
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 transition-colors group-hover/link:text-blue-500 dark:text-gray-500">
                  {card.title}
                </h3>
              </Link>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black tracking-tight text-gray-900 dark:text-white">
                  {displayValue}
                </span>
              </div>
            </div>

            <div className="relative mt-4 space-y-1.5">
              {card.lines.map((line, index) => (
                <div key={`${card.key}-line-${index}`} className="flex items-center gap-2 text-[13px] font-medium text-gray-500 dark:text-gray-400">
                  <div className={`h-1 w-1 rounded-full ${colors.text} opacity-40`} />
                  {line}
                </div>
              ))}
            </div>
          </motion.div>
        );
      })}
    </motion.section>
  );
};
