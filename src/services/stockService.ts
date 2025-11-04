// Placeholder stock service to host business logic related to inventory/stock
// Expand gradually as features are implemented.

import { prisma } from "@/lib/prisma";

export type StockMovement = {
  productId: number;
  qty: number;
  type: "in" | "out";
  ref?: string | null;
};

export async function adjustStock(movements: StockMovement[]) {
  // Minimal stub: in future, handle reservations, batch/lot, and valuation.
  // For now this does nothing and returns input for traceability.
  return { success: true, applied: movements.length };
}

export async function getStockOnHand(productId: number) {
  // Minimal stub: query stock tables when available.
  return { productId, onHand: 0 };
}

