
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import toast from "react-hot-toast";
import PurchaseOrderForm, {
  type PurchaseOrderSavePayload,
} from "../_components/PurchaseOrderForm";
import FeatureGuard from "@/components/FeatureGuard";

export default function PurchaseOrderCreatePage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (payload: PurchaseOrderSavePayload) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/purchases/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || "Gagal membuat purchase order");
      }
      toast.success("Purchase order berhasil dibuat");
      router.push("/pembelian/order-pembelian");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Gagal membuat purchase order";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FeatureGuard feature="purchase.order">
      <div className="space-y-6 p-6">
        <PageBreadcrumb
          pageTitle="Buat Purchase Order"
          items={[
            { label: "Pembelian", href: "/pembelian/order-pembelian" },
            { label: "Order Pembelian", href: "/pembelian/order-pembelian" },
            { label: "Tambah" },
          ]}
        />

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="mb-6 text-2xl font-semibold text-gray-800">
            Form Purchase Order
          </h1>
          <PurchaseOrderForm
            mode="create"
            onSubmit={handleSubmit}
            submitLabel={submitting ? "Menyimpan..." : "Simpan Purchase Order"}
            disabled={submitting}
            onCancel={() => router.push("/pembelian/order-pembelian")}
          />
        </div>
      </div>
    </FeatureGuard>
  );
}
