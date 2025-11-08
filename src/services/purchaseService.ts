// Placeholder purchase service to host business logic related to purchases/PO
// Expand gradually as features are implemented.


export type PurchaseItem = {
  productId?: number;
  name: string;
  qty: number;
  unit: string;
  price: number;
};

export async function normalizePurchaseItems(rawItems: unknown[]): Promise<PurchaseItem[]> {
  return (rawItems || []).map((raw) => {
    const it = raw as Record<string, unknown>;
    return {
      productId: Number(it.productId) > 0 ? Number(it.productId) : undefined,
      name: String(it.name || it.product || "").trim(),
      qty: Math.max(0, Math.round(Number(it.qty ?? it.quantity ?? 0))),
      unit: String(it.unit || "pcs"),
      price: Math.max(0, Number(it.price) || 0),
    };
  });
}

export async function computePurchaseTotals(items: PurchaseItem[]) {
  const subtotal = items.reduce((acc, it) => acc + it.qty * it.price, 0);
  return { subtotal, total: subtotal };
}

export async function createPurchaseOrder() {
  // Intentionally left minimal; implement when PO feature is built.
  // This function is a stub to centralize future business logic.
  return { ok: true };
}

