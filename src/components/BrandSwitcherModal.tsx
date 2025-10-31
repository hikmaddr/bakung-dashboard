"use client";
import React, { useEffect, useState, useCallback } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { useGlobal } from "@/context/AppContext";

type BrandItem = {
  id: number;
  name: string;
  slug: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  isActive?: boolean;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export default function BrandSwitcherModal({ isOpen, onClose }: Props) {
  const { refresh } = useGlobal();
  const [loading, setLoading] = useState(false);
  const [brands, setBrands] = useState<BrandItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activatingSlug, setActivatingSlug] = useState<string | null>(null);

  const loadBrands = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/brand-profiles", { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Gagal memuat daftar brand (${res.status})`);
      }
      const data = await res.json();
      const list: BrandItem[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.profiles)
        ? data.profiles
        : Array.isArray(data?.data)
        ? data.data
        : data
        ? [data]
        : [];
      const normalized = list.map((b: any) => ({
        id: Number(b.id),
        name: String(b.name || "Unnamed"),
        slug: String(b.slug || ""),
        logoUrl: b.logoUrl ?? b.logo ?? null,
        primaryColor: b.primaryColor ?? "#0EA5E9",
        secondaryColor: b.secondaryColor ?? "#ECFEFF",
        isActive: Boolean(b.isActive),
      }));
      setBrands(normalized);
    } catch (e: any) {
      setError(e?.message || "Terjadi kesalahan saat memuat brand");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadBrands();
    }
  }, [isOpen, loadBrands]);

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

  const handleActivate = async (slug: string) => {
    setActivatingSlug(slug);
    setError(null);
    try {
      const res = await fetch("/api/brand-profiles/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.success) {
        throw new Error(j?.message || "Gagal mengaktifkan brand");
      }
      await refresh();
      await applyBrandCssVars();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("brand-modules:updated"));
      }
      onClose();
    } catch (e: any) {
      setError(e?.message || "Aktivasi brand gagal");
    } finally {
      setActivatingSlug(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-[700px] p-5 lg:p-6">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold text-gray-900 dark:text-white">Pilih Brand Aktif</h4>
        <Button variant="outline" size="sm" onClick={loadBrands} disabled={loading}>
          Refresh
        </Button>
      </div>
      {error && (
        <div className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</div>
      )}
      {loading ? (
        <div className="py-8 text-center text-gray-500">Memuat brand…</div>
      ) : brands.length === 0 ? (
        <div className="py-8 text-center text-gray-500">Tidak ada brand tersedia.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {brands.map((b) => (
            <div key={b.slug} className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
              {b.logoUrl ? (
                <Image src={b.logoUrl} alt={b.name} width={36} height={36} className="object-contain" />
              ) : (
                <div className="w-9 h-9 rounded bg-gray-200 flex items-center justify-center text-gray-600 font-semibold">
                  {b.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 dark:text-white truncate">{b.name}</span>
                  {b.isActive && (
                    <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">Aktif</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: b.primaryColor || "#0EA5E9" }} />
                  <span className="inline-block w-3 h-3 rounded border" style={{ backgroundColor: b.secondaryColor || "#ECFEFF" }} />
                </div>
              </div>
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => handleActivate(b.slug)}
                disabled={Boolean(activatingSlug)}
              >
                {activatingSlug === b.slug ? "Mengaktifkan…" : "Aktifkan"}
              </Button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

