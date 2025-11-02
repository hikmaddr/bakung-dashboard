"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AutoRefresh({ intervalMs = 60_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    const refresh = () => {
      if (mounted && typeof document !== "undefined" && !document.hidden) {
        router.refresh();
      }
    };

    const id = setInterval(refresh, intervalMs);

    const handleVisibility = () => {
      if (!document.hidden) refresh();
    };
    const handleBrandModulesUpdated = () => refresh();
    const handleBrandListUpdated = () => refresh();

    if (typeof window !== "undefined") {
      window.addEventListener("visibilitychange", handleVisibility);
      window.addEventListener("brand-modules:updated", handleBrandModulesUpdated);
      window.addEventListener("brand-list:updated", handleBrandListUpdated);
    }

    return () => {
      mounted = false;
      clearInterval(id);
      if (typeof window !== "undefined") {
        window.removeEventListener("visibilitychange", handleVisibility);
        window.removeEventListener("brand-modules:updated", handleBrandModulesUpdated);
        window.removeEventListener("brand-list:updated", handleBrandListUpdated);
      }
    };
  }, [router, intervalMs]);

  return null;
}
