"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { toast } from "react-hot-toast";
import {
  SalesOrderForm,
  type SalesOrderSavePayload,
} from "../_components/SalesOrderForm";
import FeatureGuard from "@/components/FeatureGuard";

export default function SalesOrderCreatePage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (payload: SalesOrderSavePayload) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/sales-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || "Gagal membuat sales order");
      }
      toast.success("Sales order berhasil dibuat");
      router.push("/penjualan/order-penjualan");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Gagal membuat sales order";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FeatureGuard feature="sales.order">
    <div className="space-y-6 p-6">
      <PageBreadcrumb
        pageTitle="Buat Sales Order"
        items={[
          { label: "Penjualan", href: "/penjualan/order-penjualan" },
          { label: "Sales Order", href: "/penjualan/order-penjualan" },
          { label: "Tambah" },
        ]}
      />

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="mb-6 text-2xl font-semibold text-gray-800">
          Form Sales Order
        </h1>
        <SalesOrderForm
          mode="create"
          onSubmit={handleSubmit}
          submitLabel={submitting ? "Menyimpan..." : "Simpan"}
          disabled={submitting}
          onCancel={() => router.push("/penjualan/order-penjualan")}
        />
      </div>
    </div>
    </FeatureGuard>
  );
}
