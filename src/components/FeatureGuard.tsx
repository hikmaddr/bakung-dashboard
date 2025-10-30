"use client";
import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";

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
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchActiveBrandModules = useCallback(async () => {
    try {
      const response = await fetch("/api/brand-profiles/active", { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to fetch active brand profile");
      const active = await response.json();
      const map = normalizeModulesAll(active?.modules);
      setEnabled(Boolean(map[feature]));
      setError(null);
    } catch (err: any) {
      console.error("[FeatureGuard] load modules error:", err);
      setEnabled(null);
      setError(err?.message || "Unknown error");
    }
  }, [feature]);

  useEffect(() => {
    fetchActiveBrandModules();
    const handler = () => fetchActiveBrandModules();
    window.addEventListener("brand-modules:updated", handler);
    return () => window.removeEventListener("brand-modules:updated", handler);
  }, [fetchActiveBrandModules]);

  if (enabled === null) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <p className="text-sm text-gray-700">Memuat pengaturan modul…</p>
          {error && <p className="mt-2 text-xs text-red-600">{String(error)}</p>}
        </div>
      </div>
    );
  }

  if (!enabled) {
    return (
      fallback ?? (
        <div className="p-6">
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-6">
            <h2 className="text-lg font-semibold text-amber-900">Fitur dinonaktifkan</h2>
            <p className="mt-1 text-sm text-amber-800">
              Fitur ini tidak aktif pada Brand Profile yang sedang digunakan. Aktifkan fitur pada Brand Settings.
            </p>
            <div className="mt-4">
              <Link href="/template-branding/brand-settings" className="inline-flex items-center rounded-full bg-amber-600 px-4 py-2 text-white shadow-sm hover:bg-amber-700">
                Buka Brand Settings
              </Link>
            </div>
          </div>
        </div>
      )
    );
  }

  return <>{children}</>;
};

export default FeatureGuard;
