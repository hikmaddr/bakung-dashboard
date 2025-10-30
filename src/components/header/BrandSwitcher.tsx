"use client";

import React, { useEffect, useMemo, useState } from "react";
import { api } from "@/utils/api";
import { useGlobal } from "@/context/AppContext";

type BrandOption = { brandProfileId: number; brandSlug: string; brandName: string };

const BrandSwitcher: React.FC = () => {
  const { user, activeBrandId, setActiveBrandId, loading, refresh } = useGlobal();
  const [options, setOptions] = useState<BrandOption[]>([]);
  const [busy, setBusy] = useState(false);

  const currentValue = useMemo(() => {
    return activeBrandId ?? null;
  }, [activeBrandId]);

  useEffect(() => {
    const load = async () => {
      if (!user?.id) return;
      try {
        const res = await api.get<{ success: boolean; data: any[] }>(`/api/user-brand-scopes?userId=${user.id}`);
        if (res?.success && Array.isArray(res.data)) {
          const rows = res.data.map((d: any) => ({
            brandProfileId: Number(d.brandProfileId),
            brandSlug: String(d.brandSlug),
            brandName: String(d.brandName),
          }));
          setOptions(rows);
        }
      } catch {}
    };
    load();
  }, [user?.id]);

  const onChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = Number(e.target.value);
    const opt = options.find((o) => o.brandProfileId === newId);
    if (!opt) return;
    setBusy(true);
    try {
      const res = await api.post<{ success: boolean; brandProfileId?: number }>("/api/auth/set-active-brand", {
        brandId: opt.brandProfileId,
      });
      if (res?.success && typeof res.brandProfileId === "number") {
        setActiveBrandId(res.brandProfileId);
        await refresh();
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
          <option key={o.brandProfileId} value={o.brandProfileId}>
            {o.brandName}
          </option>
        ))}
      </select>
    </div>
  );
};

export default BrandSwitcher;

