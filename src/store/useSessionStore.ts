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
  avatar?: string | null;
  roles: string[];
};

type SessionState = {
  activeBrandId: number | null;
  user: UserInfo | null;
  loading: boolean;
  setActiveBrandId: (id: number | null) => void;
  setUser: (u: UserInfo | null) => void;
  setLoading: (v: boolean) => void;
  hydrate: () => Promise<void>;
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      activeBrandId: null,
      user: null,
      loading: true,
      setActiveBrandId: (id) => set({ activeBrandId: id }),
      setUser: (u) => set({ user: u }),
      setLoading: (v) => set({ loading: v }),
      hydrate: async () => {
        // Hindari hydrasi paralel, namun izinkan panggilan pertama saat state masih default
        const s = get();
        const isDefault = s.user == null && s.activeBrandId == null;
        if (s.loading && !isDefault) return;
        set({ loading: true });
        try {
          // Load user profile
          const profileRes = await api.get<{ success: boolean; data?: any }>("/api/profile");
          if (profileRes?.success && profileRes.data) {
            const d = profileRes.data;
            const user: UserInfo = {
              id: d.id,
              email: d.email,
              name: d.name ?? null,
              firstName: d.firstName ?? null,
              lastName: d.lastName ?? null,
              avatar: d.avatar ?? null,
              roles: Array.isArray(d.roles) ? d.roles : [],
            };
            set({ user });
          } else {
            set({ user: null });
          }

          // Resolve active brand id via brand access check
          const brandRes = await api.get<{
            success: boolean;
            allowed?: boolean;
            brandProfileId?: number;
            activeBrandId?: number;
          }>("/api/auth/brand-access-check");
          const resolved =
            typeof brandRes?.activeBrandId === "number"
              ? brandRes.activeBrandId
              : brandRes?.brandProfileId;
          if (brandRes?.success && brandRes.allowed && typeof resolved === "number") {
            set({ activeBrandId: resolved });
          }
        } catch (e) {
          set({ user: null });
        } finally {
          set({ loading: false });
        }
      },
    }),
    {
      name: "app-session",
      storage: createJSONStorage(() => sessionStorage),
      // Persist hanya field data; fungsi tidak ikut terserialisasi
      partialize: (state) => ({
        activeBrandId: state.activeBrandId,
        user: state.user,
      }),
      onRehydrateStorage: () => (state, error) => {
        // Setelah rehydrate dari storage, jangan tampilkan loading spinner panjang
        // AppContext tetap akan memanggil hydrate() untuk sinkronisasi server
        if (!error) {
          set({ loading: false });
        }
      },
    }
  )
);
