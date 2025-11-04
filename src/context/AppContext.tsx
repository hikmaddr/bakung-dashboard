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

export const GlobalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const activeBrandId = useSessionStore((s) => s.activeBrandId);
  const user = useSessionStore((s) => s.user);
  const loading = useSessionStore((s) => s.loading);
  const setActiveBrandId = useSessionStore((s) => s.setActiveBrandId);
  const hydrate = useSessionStore((s) => s.hydrate);

  const didHydrate = useRef(false);
  useEffect(() => {
    if (didHydrate.current) return;
    didHydrate.current = true;
    // Initial hydration from API
    hydrate();
  }, [hydrate]);

  const hasRole = useCallback(
    (role: string) => {
      const r = role.toLowerCase();
      return Boolean(user?.roles?.some((x) => String(x).toLowerCase() === r));
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
