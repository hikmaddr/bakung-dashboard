"use client";
import React, { useCallback, useEffect, useState } from "react";

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

function normalizeModulesAll(value: unknown): Record<string, boolean> {
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
}

export const FeatureIf: React.FC<{
  feature: FeatureKey;
  children: React.ReactNode;
  placeholder?: React.ReactNode;
}> = ({ feature, children, placeholder = null }) => {
  const [enabled, setEnabled] = useState<boolean | null>(null);

  const fetchActiveBrandModules = useCallback(async () => {
    try {
      const response = await fetch("/api/brand-profiles/active", { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to fetch active brand profile");
      const active = await response.json();
      const map = normalizeModulesAll(active?.modules);
      setEnabled(Boolean(map[feature]));
    } catch (err) {
      console.error("[FeatureIf] load modules error:", err);
      setEnabled(false);
    }
  }, [feature]);

  useEffect(() => {
    fetchActiveBrandModules();
    const handler = () => fetchActiveBrandModules();
    window.addEventListener("brand-modules:updated", handler);
    return () => window.removeEventListener("brand-modules:updated", handler);
  }, [fetchActiveBrandModules]);

  if (!enabled) return <>{placeholder}</>;
  return <>{children}</>;
};

export default FeatureIf;

