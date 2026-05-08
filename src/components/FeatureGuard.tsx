"use client";
import React, { useEffect, useMemo } from "react";
import Link from "next/link";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import { useBrandStore } from "@/store/useBrandStore";

type ModuleKey = "sales" | "purchase" | "inventory" | "reporting" | "system";

type FeatureKey =
  | "sales.quotation"
  | "sales.order"
  | "sales.invoice"
  | "sales.receipt"
  | "sales.delivery"
  | "purchase.order"
  | "purchase.invoice"
  | "purchase.receipt"
  | "purchase.receiving"
  | "inventory.products"
  | "inventory.stock"
  | "reporting.rekap"
  | "system.user";

const defaultModulesTop: Record<ModuleKey, boolean> = {
  sales: true,
  purchase: true,
  inventory: true,
  reporting: true,
  system: true,
};

const FEATURES_BY_MODULE: Record<ModuleKey, Array<{ key: FeatureKey }>> = {
  sales: [
    { key: "sales.quotation" },
    { key: "sales.order" },
    { key: "sales.invoice" },
    { key: "sales.receipt" },
    { key: "sales.delivery" },
  ],
  purchase: [
    { key: "purchase.order" },
    { key: "purchase.invoice" },
    { key: "purchase.receipt" },
    { key: "purchase.receiving" },
  ],
  inventory: [
    { key: "inventory.products" },
    { key: "inventory.stock" },
  ],
  reporting: [
    { key: "reporting.rekap" },
  ],
  system: [
    { key: "system.user" },
  ],
};

const normalizeModulesAll = (value: unknown): Record<string, boolean> => {
  const raw: Record<string, boolean> =
    value && typeof value === "object" ? (value as Record<string, boolean>) : {};
  const top: Record<ModuleKey, boolean> = {
    sales: Boolean(raw.sales ?? defaultModulesTop.sales),
    purchase: Boolean(raw.purchase ?? defaultModulesTop.purchase),
    inventory: Boolean(raw.inventory ?? defaultModulesTop.inventory),
    reporting: Boolean(raw.reporting ?? defaultModulesTop.reporting),
    system: Boolean(raw.system ?? defaultModulesTop.system),
  };
  const merged: Record<string, boolean> = { ...raw, ...top };
  (Object.keys(FEATURES_BY_MODULE) as ModuleKey[]).forEach((mk) => {
    FEATURES_BY_MODULE[mk].forEach(({ key }) => {
      if (merged[key] === undefined) merged[key] = top[mk];
    });
  });
  return merged;
};

export const FeatureGuard: React.FC<{
  feature: FeatureKey;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}> = ({ feature, children, fallback }) => {
  const { activeBrand, loading, error, fetchActiveBrand } = useBrandStore();

  useEffect(() => {
    fetchActiveBrand();
    
    // Listen for manual updates to refresh the store
    const handler = () => fetchActiveBrand(true);
    window.addEventListener("brand-modules:updated", handler);
    return () => window.removeEventListener("brand-modules:updated", handler);
  }, [fetchActiveBrand]);

  const enabled = useMemo(() => {
    if (!activeBrand) return null;

    const map = normalizeModulesAll(activeBrand.modules);
    const scope = String(activeBrand.businessScope || "").toUpperCase();

    if (scope === "CREATIVE") {
      // Disable non-creative modules and features
      map["sales.order"] = false;
      map["sales.receipt"] = false;
      map["sales.delivery"] = false;
      map["purchase"] = false;
      map["purchase.order"] = false;
      map["purchase.invoice"] = false;
      map["purchase.receipt"] = false;
      map["purchase.receiving"] = false;
      map["inventory"] = false;
      map["inventory.products"] = false;
      map["inventory.stock"] = false;
    }

    return Boolean(map[feature]);
  }, [activeBrand, feature]);

  if (loading && !activeBrand) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <LoadingSpinner inline size="sm" label="Memuat pengaturan modul…" />
        </div>
      </div>
    );
  }

  if (error && !activeBrand) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 dark:border-red-800/30 dark:bg-red-900/10">
          <h2 className="text-lg font-semibold text-red-900 dark:text-red-400">Gagal memuat modul</h2>
          <p className="mt-1 text-sm text-red-800 dark:text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  if (enabled === null) {
    // If we're not loading and have no activeBrand, it might mean no brand is selected
    return null;
  }

  if (!enabled) {
    return (
      <>
        {fallback ?? (
          <div className="p-6">
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-6 dark:border-amber-800/30 dark:bg-amber-900/10">
              <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-400">Fitur dinonaktifkan</h2>
              <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
                Fitur ini tidak aktif pada Brand Profile yang sedang digunakan. Aktifkan fitur pada Brand Settings.
              </p>
              <div className="mt-4">
                <Link href="/template-branding/brand-settings" className="inline-flex items-center rounded-full bg-amber-600 px-4 py-2 text-white shadow-sm hover:bg-amber-700">
                  Buka Brand Settings
                </Link>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return <>{children}</>;
};

export default FeatureGuard;

