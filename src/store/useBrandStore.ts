"use client";

import { create } from "zustand";

export type BrandProfile = {
  id: number;
  slug: string;
  name: string;
  businessScope: "CREATIVE" | "PROCUREMENT" | "SOUVENIR";
  modules: any;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  logoUrl?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
};

type BrandState = {
  activeBrand: BrandProfile | null;
  loading: boolean;
  error: string | null;
  lastFetched: number | null;
  fetchActiveBrand: (force?: boolean) => Promise<void>;
  clearCache: () => void;
};

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const useBrandStore = create<BrandState>((set, get) => ({
  activeBrand: null,
  loading: false,
  error: null,
  lastFetched: null,

  fetchActiveBrand: async (force = false) => {
    const { loading, activeBrand, lastFetched } = get();
    const now = Date.now();

    // Skip if already loading
    if (loading) return;

    // Skip if we have data and it's fresh enough (and not forced)
    if (!force && activeBrand && lastFetched && now - lastFetched < CACHE_DURATION) {
      return;
    }

    set({ loading: true, error: null });

    try {
      // Use no-store only when forced
      const response = await fetch("/api/brand-profiles/active", {
        cache: force ? "no-store" : "default",
      });

      if (!response.ok) {
        if (response.status === 404) {
          set({ activeBrand: null, loading: false, lastFetched: now });
          return;
        }
        throw new Error("Failed to fetch active brand profile");
      }

      const data = await response.json();
      set({ activeBrand: data, loading: false, lastFetched: now });
    } catch (err: any) {
      console.error("[useBrandStore] fetch error:", err);
      set({ error: err.message || "Unknown error", loading: false });
    }
  },

  clearCache: () => set({ activeBrand: null, error: null, lastFetched: null }),
}));
