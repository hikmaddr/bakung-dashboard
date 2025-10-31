"use client";

import React, { useEffect, useState, useCallback, useRef, useLayoutEffect } from "react";
import Image from "next/image";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { DropdownItem } from "../ui/dropdown/DropdownItem";
import toast from "react-hot-toast";

type BrandInfo = {
  id: number;
  slug?: string | null;
  name: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
};

type BrandOption = {
  id: number;
  slug: string;
  name: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
};

export default function BrandBadge() {
  const [brand, setBrand] = useState<BrandInfo | null>(null);
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<BrandOption[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [menuStyles, setMenuStyles] = useState<React.CSSProperties | undefined>(undefined);

  const applyBrandCssVars = useCallback(async () => {
    try {
      const res = await fetch("/api/brand-profiles/active", { cache: "no-store" });
      if (!res.ok) return;
      const b = await res.json();
      const primary = b?.primaryColor || "#0EA5E9";
      const secondary = b?.secondaryColor || "#ECFEFF";
      if (typeof window !== "undefined") {
        const root = document.documentElement;
        root.style.setProperty("--brand-primary", primary);
        root.style.setProperty("--brand-secondary", secondary);
      }
    } catch {}
  }, []);

  const loadActive = useCallback(async () => {
    try {
      const res = await fetch("/api/brand-profiles/active", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const info: BrandInfo = {
        id: Number(data?.id || 0),
        slug: data?.slug ?? null,
        name: String(data?.name || "Brand"),
        logoUrl: data?.logoUrl ?? data?.logo ?? null,
        primaryColor: data?.primaryColor ?? null,
        secondaryColor: data?.secondaryColor ?? null,
      };
      setBrand(info);
      await applyBrandCssVars();
    } catch {}
  }, [applyBrandCssVars]);

  const loadOptions = useCallback(async () => {
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
        id: Number(b?.id ?? 0),
        slug: String(b?.slug || ""),
        name: String(b?.name || "Unnamed"),
        logoUrl: b?.logoUrl ?? b?.logo ?? null,
        primaryColor: b?.primaryColor ?? null,
      }));
      setOptions(rows);
    } catch {}
  }, []);

  const activateBrand = useCallback(async (slug: string) => {
    if (!slug) return;
    try {
      const res = await fetch("/api/brand-profiles/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      if (res.ok) {
        await loadActive();
        await applyBrandCssVars();
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("brand-modules:updated"));
        }
        toast.success("Brand aktif diperbarui");
      } else {
        const j = await res.json().catch(() => ({}));
        toast.error(j?.message || "Gagal mengaktifkan brand");
      }
    } catch {}
  }, [applyBrandCssVars, loadActive]);

  useEffect(() => {
    loadActive();
    const handler = () => loadActive();
    window.addEventListener("brand-modules:updated", handler);
    return () => window.removeEventListener("brand-modules:updated", handler);
  }, [loadActive]);

  useEffect(() => {
    if (open && options.length === 0) {
      loadOptions();
    }
  }, [open, options.length, loadOptions]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const padding = 12;
      const minWidth = 260;
      const maxWidth = 360;
      const available = window.innerWidth - padding * 2;
      const width = Math.min(Math.max(minWidth, Math.min(maxWidth, available)), 380);

      const viewportLeft = padding;
      const viewportRight = window.innerWidth - padding - width;
      const preferredLeft = Math.round(rect.right - width);
      const left = Math.min(Math.max(preferredLeft, viewportLeft), viewportRight);

      const estimatedHeight = Math.min(520, Math.round(window.innerHeight * 0.8));
      const below = Math.round(rect.bottom + 8);
      const viewportBottom = window.innerHeight - padding;
      let top = below;
      if (below + estimatedHeight > viewportBottom) {
        const above = Math.round(rect.top - estimatedHeight - 8);
        top = Math.max(above, padding);
      }

      setMenuStyles({ position: "fixed", top, left, width, zIndex: 60 });
    };
    updatePosition();
    const handler = () => updatePosition();
    window.addEventListener("resize", handler);
    window.addEventListener("scroll", handler, true);
    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("scroll", handler, true);
    };
  }, [open]);

  const displayName = brand?.name || "Brand";
  const logo = brand?.logoUrl || null;
  const color = brand?.primaryColor || "#0EA5E9";

  return (
    <div ref={containerRef} className="relative select-none">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative dropdown-toggle flex items-center justify-center text-gray-500 transition-colors bg-white border border-gray-200 rounded-full hover:text-gray-700 h-11 w-11 hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
        aria-label={displayName}
      >
        {logo ? (
          <Image
            src={logo}
            alt={displayName}
            width={28}
            height={28}
            className="object-contain"
          />
        ) : (
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[11px] font-semibold"
            style={{ backgroundColor: color as string }}
          >
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
      </button>

      <Dropdown
        isOpen={open}
        onClose={() => setOpen(false)}
        position="fixed"
        style={menuStyles}
        className="flex flex-col w-full max-w-[94vw] max-h-[80vh] rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark"
      >
        <ul className="flex flex-col h-auto overflow-y-auto custom-scrollbar" style={{ maxHeight: "calc(80vh - 16px)" }}>
          {options.map((opt) => (
            <li key={opt.slug}>
              <DropdownItem
                onItemClick={() => {
                  setOpen(false);
                  activateBrand(opt.slug);
                }}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 font-medium text-gray-700 group text-theme-sm hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300 ${
                  opt.slug === brand?.slug ? "bg-gray-50 dark:bg-white/10" : ""
                }`}
              >
                {opt.logoUrl ? (
                  <Image
                    src={opt.logoUrl}
                    alt={opt.name}
                    width={28}
                    height={28}
                    className="object-contain rounded"
                  />
                ) : (
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center text-white text-[12px] font-semibold"
                    style={{ backgroundColor: (opt.primaryColor as string) || "#0EA5E9" }}
                  >
                    {opt.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                  {opt.name}
                </span>
              </DropdownItem>
            </li>
          ))}
        </ul>
      </Dropdown>
    </div>
  );
}
