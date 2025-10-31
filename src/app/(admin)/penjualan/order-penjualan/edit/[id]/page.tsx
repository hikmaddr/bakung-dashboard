"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import toast from "react-hot-toast";
import FeatureGuard from "@/components/FeatureGuard";
import {
  SalesOrderForm,
  type SalesOrderFormInitialValues,
  type SalesOrderSavePayload,
} from "../../_components/SalesOrderForm";

type SalesOrderResponse = {
  success: boolean;
  message?: string;
  data?: {
    id: number;
    orderNumber: string;
    date: string;
    status: string;
    customerId: number;
    quotationId?: number | null;
    notes?: string | null;
    extraDiscount?: number | null;
    taxMode?: string | null;
    items: Array<{
      id: number;
      productId?: number | null;
      product: string;
      description: string;
      quantity: number;
      unit: string | null;
      price: number;
      discount?: number | null;
      imageUrl?: string | null;
    }>;
  };
};

const makeItemId = (prefix: string, index: number) =>
  `${prefix}-${index}-${Math.random().toString(36).slice(2)}`;

export default function SalesOrderEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const orderId = Number(params?.id);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [initialValues, setInitialValues] =
    useState<SalesOrderFormInitialValues | null>(null);

  useEffect(() => {
    if (!Number.isFinite(orderId)) {
      toast.error("ID sales order tidak valid");
      router.push("/penjualan/order-penjualan");
      return;
    }

    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/sales-orders/${orderId}`, {
          cache: "no-store",
        });
        const json: SalesOrderResponse = await res.json();
        if (!res.ok || !json.success || !json.data) {
          throw new Error(json.message || "Sales order tidak ditemukan");
        }
        if (!active) return;

        const order = json.data;
        setInitialValues({
          orderNumber: order.orderNumber,
          date: order.date ? order.date.slice(0, 10) : undefined,
          status: (order.status as any) ?? "Draft",
          customerId: order.customerId ?? null,
          quotationId:
            typeof order.quotationId === "number" ? order.quotationId : null,
          notes: order.notes ?? "",
          extraDiscount: order.extraDiscount ?? 0,
          taxMode: (order.taxMode as any) ?? "none",
          items:
            order.items?.map((item, index) => ({
              id: makeItemId(String(item.id ?? "item"), index),
              productId:
                typeof item.productId === "number" ? item.productId : null,
              product: item.product ?? "",
              description: item.description ?? "",
              quantity: Number(item.quantity) || 1,
              unit: item.unit ?? "pcs",
              price: Number(item.price) || 0,
              discount: Number(item.discount) || 0,
              discountType: "amount",
              imageUrl: item.imageUrl ?? null,
            })) ?? [],
        });
      } catch (error: any) {
        toast.error(error?.message || "Gagal mengambil data sales order");
        router.push("/penjualan/order-penjualan");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [orderId, router]);

  const handleSubmit = async (payload: SalesOrderSavePayload) => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/sales-orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || "Gagal memperbarui sales order");
      }
      toast.success("Sales order berhasil diperbarui");
      router.push("/penjualan/order-penjualan");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Gagal memperbarui sales order";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const breadcrumbTitle = useMemo(() => {
    if (!initialValues?.orderNumber) return "Edit Sales Order";
    return `Edit ${initialValues.orderNumber}`;
  }, [initialValues?.orderNumber]);

  if (loading) {
    return (
      <FeatureGuard feature="sales.order">
        <div className="p-6 text-sm text-gray-600">
          Memuat data sales order...
        </div>
      </FeatureGuard>
    );
  }

  if (!initialValues) {
    return (
      <FeatureGuard feature="sales.order">
        <div className="p-6 text-sm text-red-600">
          Data sales order tidak ditemukan.
        </div>
      </FeatureGuard>
    );
  }

  return (
    <FeatureGuard feature="sales.order">
    <div className="space-y-6 p-6">
      <PageBreadcrumb
        pageTitle={breadcrumbTitle}
        items={[
          { label: "Penjualan", href: "/penjualan/order-penjualan" },
          { label: "Sales Order", href: "/penjualan/order-penjualan" },
          { label: initialValues.orderNumber ?? "Edit" },
        ]}
      />

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="mb-6 text-2xl font-semibold text-gray-800">
          Perbarui Sales Order
        </h1>
        <SalesOrderForm
          mode="edit"
          initialValues={initialValues}
          onSubmit={handleSubmit}
          submitLabel={submitting ? "Menyimpan..." : "Simpan Perubahan"}
          disabled={submitting}
          onCancel={() => router.push("/penjualan/order-penjualan")}
        />
      </div>
    </div>
    </FeatureGuard>
  );
}
