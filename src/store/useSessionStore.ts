"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { api } from "@/utils/api";

export type UserInfo = {
  id: number;
  email: string;
  name: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  avatar?: string | null;
  isActive?: boolean;
  roles: string[];
};

type SessionState = {
  activeBrandId: number | null;
  activeBrand: any | null;
  brands: any[];
  metrics: {
    invoiceOpen: number;
  };
  user: UserInfo | null;
  loading: boolean;
  setActiveBrandId: (id: number | null) => void;
  setUser: (u: UserInfo | null) => void;
  setLoading: (v: boolean) => void;
  hydrate: () => Promise<void>;
};

const initialState = {
  activeBrandId: null,
  activeBrand: null,
  brands: [],
  metrics: {
    invoiceOpen: 0,
  },
  user: null,
  loading: true,
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      ...initialState,
      setActiveBrandId: (id) => set({ activeBrandId: id }),
      setUser: (u) => set({ user: u }),
      setLoading: (v) => set({ loading: v }),
      hydrate: async () => {
        const s = get();
        // Allow re-hydration even if loading, but not too frequently
        set({ loading: true });
        try {
          const res = await api.get<{ 
            success: boolean; 
            data?: {
              user: any;
              activeBrand: any;
              brands: any[];
              metrics: any;
            } 
          }>("/api/init");
          
          if (res?.success && res.data) {
            const { user, activeBrand, brands, metrics } = res.data;
            set({ 
              user: {
                ...user,
                name: user.name ?? null,
                roles: Array.isArray(user.roles) ? user.roles : [],
              },
              activeBrand,
              activeBrandId: activeBrand?.id ?? null,
              brands: Array.isArray(brands) ? brands : [],
              metrics: metrics ?? { invoiceOpen: 0 },
              loading: false
            });
          } else {
            set({ user: null, loading: false });
          }
        } catch (e: any) {
          // 401 is expected when not logged in — don't pollute the console
          if (e?.status !== 401) {
            console.error("[useSessionStore] Hydrate failed:", e);
          }
          set({ user: null, loading: false });
        }
      },
    }),
    {
      name: "app-session",
      storage: createJSONStorage(() => sessionStorage),
      skipHydration: true,
      partialize: (state) => ({
        activeBrandId: state.activeBrandId,
        activeBrand: state.activeBrand,
        brands: state.brands,
        user: state.user,
        metrics: state.metrics,
      }),
    }
  )
);
