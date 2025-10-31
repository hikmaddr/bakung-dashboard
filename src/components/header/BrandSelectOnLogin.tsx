"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import toast from "react-hot-toast";
import { useGlobal } from "@/context/AppContext";

type BrandOption = {
  id: number;
  slug: string;
  name: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
};

export default function BrandSelectOnLogin() {
  const { refresh } = useGlobal();
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<BrandOption[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchActive = useCallback(async () => {
    try {
      const r = await fetch("/api/brand-profiles/active", { cache: "no-store" });
      if (r.ok) {
        const j = await r.json();
        return j || null;
      }
    } catch {}
    return null;
  }, []);

  const applyBrandCssVars = useCallback(async () => {
    try {
      const b = await fetchActive();
      const primary = b?.primaryColor || "#0EA5E9";
      const secondary = b?.secondaryColor || "#ECFEFF";
      if (typeof window !== "undefined") {
        const root = document.documentElement;
        root.style.setProperty("--brand-primary", primary);
        root.style.setProperty("--brand-secondary", secondary);
      }
    } catch {}
  }, [fetchActive]);

  const loadOptions = useCallback(async () => {
    try {
      const r = await fetch("/api/brand-profiles", { cache: "no-store" });
      if (!r.ok) return;
      const data = await r.json();
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
        id: Number(b?.id ?? 0),
        slug: String(b?.slug || ""),
        name: String(b?.name || "Unnamed"),
        logoUrl: b?.logoUrl ?? b?.logo ?? null,
        primaryColor: b?.primaryColor ?? null,
        secondaryColor: b?.secondaryColor ?? null,
      }));
      setOptions(rows);
    } catch {}
  }, []);

  const shouldShow = useMemo(() => {
    // Modal muncul jika user memiliki >1 brand
    return options.length > 1;
  }, [options.length]);

  useEffect(() => {
    (async () => {
      await loadOptions();
      const active = await fetchActive();
      // Munculkan modal jika lebih dari 1 brand dan belum ada aktif
      if (options.length > 1 && !active) setOpen(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activateBrand = useCallback(
    async (slug: string) => {
      if (!slug || loading) return;
      setLoading(true);
      try {
        const res = await fetch("/api/brand-profiles/activate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug }),
        });
        if (res.ok) {
          await applyBrandCssVars();
          if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("brand-modules:updated"));
          }
          await refresh();
          setOpen(false);
          toast.success("Brand berhasil diaktifkan");
        } else {
          const j = await res.json().catch(() => ({}));
          toast.error(j?.message || "Gagal mengaktifkan brand");
        }
      } catch {}
      finally {
        setLoading(false);
      }
    },
    [loading, applyBrandCssVars, refresh]
  );

  if (!shouldShow) return null;

  return (
    <Modal open={open} onClose={() => setOpen(false)} size="md">
      <ModalHeader title="Pilih Brand Aktif" onClose={() => setOpen(false)} />
      <ModalBody>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          Kamu memiliki akses ke beberapa brand. Pilih salah satu untuk mulai bekerja.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {options.map((b) => (
            <button
              key={b.id}
              onClick={() => activateBrand(b.slug)}
              disabled={loading}
              className="group flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              {b.logoUrl ? (
                <Image src={b.logoUrl} alt={b.name} width={28} height={28} className="object-contain" />
              ) : (
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-semibold"
                  style={{ backgroundColor: b.primaryColor || "#0EA5E9" }}
                >
                  {b.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex flex-col items-start">
                <span className="text-sm font-medium text-gray-900 dark:text-white">{b.name}</span>
                {b.primaryColor && (
                  <span className="text-[11px] text-gray-500">Theme: {b.primaryColor}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      </ModalBody>
      <ModalFooter>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-3 py-2 rounded-md text-sm border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          Nanti Saja
        </button>
      </ModalFooter>
    </Modal>
  );
}
