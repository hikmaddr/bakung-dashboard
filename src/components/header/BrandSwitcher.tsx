"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useGlobal } from "@/context/AppContext";

type BrandOption = { id: number; slug: string; name: string };

const BrandSwitcher: React.FC = () => {
  const { user, activeBrandId, setActiveBrandId, loading, refresh } = useGlobal();
  const [options, setOptions] = useState<BrandOption[]>([]);
  const [busy, setBusy] = useState(false);

  const currentValue = useMemo(() => {
    return activeBrandId ?? null;
  }, [activeBrandId]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/brand-profiles", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const list: any[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.profiles)
          ? data.profiles
          : Array.isArray(data?.data)
          ? data.data
          : data
          ? [data]
          : [];
        const rows: BrandOption[] = list.map((b: any) => ({
          id: Number(b.id),
          slug: String(b.slug || b.slug?.toString?.() || ""),
          name: String(b.name || "Unnamed"),
        }));
        setOptions(rows);
      } catch {
        // ignore load errors
      }
    };
    load();
  }, []);

  // Ensure we have current active brand id if not set yet
  useEffect(() => {
    const loadActive = async () => {
      if (activeBrandId != null) return;
      try {
        const res = await fetch("/api/brand-profiles/active", { cache: "no-store" });
        if (!res.ok) return;
        const brand = await res.json();
        if (brand?.id) setActiveBrandId(Number(brand.id));
      } catch {
        // ignore
      }
    };
    loadActive();
  }, [activeBrandId, setActiveBrandId]);

  const applyBrandCssVars = async () => {
    try {
      const res = await fetch("/api/brand-profiles/active", { cache: "no-store" });
      if (!res.ok) return;
      const brand = await res.json();
      const primary = brand?.primaryColor || "#0EA5E9";
      const secondary = brand?.secondaryColor || "#ECFEFF";
      if (typeof window !== "undefined") {
        const root = document.documentElement;
        root.style.setProperty("--brand-primary", primary);
        root.style.setProperty("--brand-secondary", secondary);
      }
    } catch {
      // ignore css var set failure
    }
  };

  const onChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = Number(e.target.value);
    const opt = options.find((o) => o.id === newId);
    if (!opt || !opt.slug) return;
    setBusy(true);
    try {
      const res = await fetch("/api/brand-profiles/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: opt.slug }),
      });
      if (res.ok) {
        setActiveBrandId(newId);
        await refresh();
        await applyBrandCssVars();
        window.dispatchEvent(new CustomEvent("brand-modules:updated"));
      }
    } finally {
      setBusy(false);
    }
  };

  if (!user || loading) return null;
  if (!options || options.length === 0) return null;

  return (
    <div className="flex items-center">
      <label htmlFor="brand-switcher" className="sr-only">Active Brand</label>
      <select
        id="brand-switcher"
        className="h-10 rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 dark:border-gray-800 dark:bg-gray-900 dark:text-white/90"
        value={currentValue ?? undefined}
        onChange={onChange}
        disabled={busy}
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default BrandSwitcher;
