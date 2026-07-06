"use client";

import React, { createContext, useContext, useEffect, useMemo, useCallback, useRef } from "react";
import { useSessionStore, type UserInfo } from "@/store/useSessionStore";

type GlobalState = {
  activeBrandId: number | null;
  user: UserInfo | null;
  loading: boolean;
  setActiveBrandId: (id: number | null) => void;
  hasRole: (role: string) => boolean;
  refresh: () => Promise<void>;
};

const GlobalContext = createContext<GlobalState | undefined>(undefined);

// Static selectors for GlobalProvider
const selectActiveBrandId = (s: any) => s.activeBrandId;
const selectUser = (s: any) => s.user;
const selectLoading = (s: any) => s.loading;
const selectSetActiveBrandId = (s: any) => s.setActiveBrandId;
const selectHydrate = (s: any) => s.hydrate;

export const GlobalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const activeBrandId = useSessionStore(selectActiveBrandId);
  const user = useSessionStore(selectUser);
  const loading = useSessionStore(selectLoading);
  const setActiveBrandId = useSessionStore(selectSetActiveBrandId);
  const hydrate = useSessionStore(selectHydrate);

  const didHydrate = useRef(false);
  useEffect(() => {
    if (didHydrate.current) return;
    didHydrate.current = true;
    
    // Controlled hydration sequence
    const init = async () => {
      await useSessionStore.persist.rehydrate();
      await hydrate();
    };
    init();
  }, [hydrate]);

  const hasRole = useCallback(
    (role: string) => {
      const r = role.toLowerCase();
      return Boolean(user?.roles?.some((x: any) => String(x).toLowerCase() === r));
    },
    [user]
  );

  const refresh = useCallback(async () => {
    await hydrate();
  }, [hydrate]);

  const value = useMemo<GlobalState>(
    () => ({ activeBrandId, user, loading, setActiveBrandId, hasRole, refresh }),
    [activeBrandId, user, loading, setActiveBrandId, hasRole, refresh]
  );

  return <GlobalContext.Provider value={value}>{children}</GlobalContext.Provider>;
};

export function useGlobal() {
  const ctx = useContext(GlobalContext);
  if (!ctx) throw new Error("useGlobal must be used within GlobalProvider");
  return ctx;
}
