"use client";

import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { api } from "@/utils/api";

type UserInfo = {
  id: number;
  email: string;
  name: string | null;
  roles: string[];
};

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
  const [activeBrandId, setActiveBrandId] = useState<number | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchInitial = useCallback(async () => {
    setLoading(true);
    try {
      // Load user profile
      const profileRes = await api.get<{ success: boolean; data?: any }>("/api/profile");
      if (profileRes?.success && profileRes.data) {
        const d = profileRes.data;
        setUser({ id: d.id, email: d.email, name: d.name ?? null, roles: Array.isArray(d.roles) ? d.roles : [] });
      } else {
        setUser(null);
      }

      // Resolve active brand id via brand access check
      const brandRes = await api.get<{ success: boolean; allowed?: boolean; brandProfileId?: number }>(
        "/api/auth/brand-access-check"
      );
      if (brandRes?.success && brandRes.allowed && typeof brandRes.brandProfileId === "number") {
        setActiveBrandId(brandRes.brandProfileId);
      }
    } catch (e) {
      // silence; unauthenticated or error
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInitial();
  }, [fetchInitial]);

  const hasRole = useCallback(
    (role: string) => {
      const r = role.toLowerCase();
      return Boolean(user?.roles?.some((x) => String(x).toLowerCase() === r));
    },
    [user]
  );

  const refresh = useCallback(async () => {
    await fetchInitial();
  }, [fetchInitial]);

  const value = useMemo<GlobalState>(
    () => ({ activeBrandId, user, loading, setActiveBrandId, hasRole, refresh }),
    [activeBrandId, user, loading, hasRole, refresh]
  );

  return <GlobalContext.Provider value={value}>{children}</GlobalContext.Provider>;
};

export function useGlobal() {
  const ctx = useContext(GlobalContext);
  if (!ctx) throw new Error("useGlobal must be used within GlobalProvider");
  return ctx;
}

