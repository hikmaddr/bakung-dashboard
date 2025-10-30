"use client";

import { useEffect, useState } from "react";

export type ProductUnit = {
  id: number;
  name: string;
  symbol: string;
  description?: string | null;
};

export function useProductUnits() {
  const [units, setUnits] = useState<ProductUnit[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/product-units", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load product units");
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error("Invalid units payload");
        if (active) {
          const normalized = data
            .map((unit) => ({
              id: Number(unit.id),
              name: String(unit.name ?? unit.symbol ?? "").trim() || "pcs",
              symbol: String(unit.symbol ?? unit.name ?? "").trim() || "pcs",
              description: unit.description ?? null,
            }))
            .filter((unit) => unit.symbol.length > 0);
          setUnits(normalized);
        }
      } catch {
        if (active) setUnits([{ id: 0, name: "pcs", symbol: "pcs" }]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return { units, loading };
}

