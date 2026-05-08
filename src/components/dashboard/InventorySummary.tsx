"use client";
import React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpRight, AlertTriangle, Package, CheckCircle2 } from "lucide-react";

interface InventorySummaryProps {
  inventory: {
    totalProducts: number;
    lowStock: { id: number; name: string; sku: string; qty: number; unit: string }[];
  };
}

export const InventorySummary: React.FC<InventorySummaryProps> = ({ inventory }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="group relative overflow-hidden rounded-3xl border border-gray-200/50 bg-white p-6 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.03]"
    >
      {/* Decorative Glow */}
      <div className="absolute -right-12 -top-12 h-24 w-24 rounded-full bg-rose-500/5 blur-2xl transition-all group-hover:bg-rose-500/10" />

      <div className="relative flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-gray-50 p-2 dark:bg-white/5">
            <Package className="h-4 w-4 text-gray-400" />
          </div>
          <h2 className="text-[15px] font-black tracking-tight text-gray-900 dark:text-white">Status Inventori</h2>
        </div>
        <span className="rounded-lg bg-gray-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:bg-white/5 dark:text-gray-400">
          {inventory.totalProducts} Produk
        </span>
      </div>

      <div className="relative space-y-4">
        <div className="flex items-center gap-2 px-1">
          <AlertTriangle className="h-3 w-3 text-rose-500" />
          <p className="text-[11px] font-black uppercase tracking-widest text-rose-500">Stok Menipis ({"<10"})</p>
        </div>

        {inventory.lowStock.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-10 text-center"
          >
            <div className="rounded-full bg-emerald-500/10 p-3 mb-3">
              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            </div>
            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
              Semua stok aman
            </p>
            <p className="text-[11px] text-gray-400 mt-1">Belum ada item yang kritis</p>
          </motion.div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {inventory.lowStock.map((p, idx) => (
                <motion.div 
                  key={p.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="group/item relative flex items-center justify-between rounded-2xl bg-gray-50/50 p-3 transition-colors hover:bg-gray-100 dark:bg-white/[0.02] dark:hover:bg-white/[0.04]"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-bold text-gray-900 dark:text-white/90 truncate max-w-[140px]">
                      {p.name}
                    </span>
                    <span className="text-[10px] font-medium text-gray-400 tracking-wider uppercase">{p.sku}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-black text-rose-600 dark:text-rose-400">{p.qty}</span>
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">{p.unit}</span>
                    </div>
                    {/* Visual Progress/Indicator */}
                    <div className="h-8 w-1 rounded-full bg-rose-500/20">
                      <motion.div 
                        initial={{ height: 0 }}
                        animate={{ height: `${(p.qty / 10) * 100}%` }}
                        className="w-full rounded-full bg-rose-500"
                      />
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            
            <Link
              href="/stok/inventory"
              className="group/btn mt-4 flex items-center justify-center gap-2 rounded-2xl bg-gray-900 py-3 text-xs font-black text-white transition-all hover:bg-black hover:shadow-lg dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
            >
              Kelola Inventori 
              <ArrowUpRight className="h-3 w-3 transition-transform group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" />
            </Link>
          </div>
        )}
      </div>
    </motion.div>
  );
};
