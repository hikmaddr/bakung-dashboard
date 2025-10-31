
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import FeatureGuard from "@/components/FeatureGuard";
import {
  resolveTheme,
  resolveThankYou,
  resolvePaymentLines,
  DEFAULT_TERMS,
} from "@/lib/quotationTheme";

interface InvoiceItem {
  id?: number;
  name: string;
  description?: string | null;
  qty?: number;
  unit?: string | null;
  price?: number;
  discount?: number;
  discountType?: "percent" | "amount";
  subtotal?: number | null;
}

interface Customer {
  id?: number;
  pic?: string | null;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
}

interface InvoiceData {
  id: number;
  invoiceNumber?: string | null;
  issueDate?: string | null;
  dueDate?: string | null;
  status?: string | null;
  notes?: string | null;
  terms?: string | null;
  subtotal?: number | null;
  lineDiscount?: number | null;
  extraDiscountType?: "percent" | "amount" | null;
  extraDiscountValue?: number | null;
  shippingCost?: number | null;
  taxMode?: string | null;
  taxAmount?: number | null;
  downPayment?: number | null;
  total?: number | null;
  items?: InvoiceItem[];
  customer?: Customer | null;
  quotation?: { id: number; quotationNumber?: string | null } | null;
}

const normalizeNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatCurrency = (value: number | null | undefined) =>
  `Rp ${normalizeNumber(value ?? 0).toLocaleString("id-ID")}`;

const formatDate = (value: string | Date | null | undefined) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

export default function InvoiceDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();

  const invoiceId = useMemo(() => {
    const raw = params?.id;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [params?.id]);

  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [brand, setBrand] = useState<any | null>(null);
  const [brandLoading, setBrandLoading] = useState(true);
  const [actor, setActor] = useState<any | null>(null);
  const [actorLoading, setActorLoading] = useState(true);

  const [dpOpen, setDpOpen] = useState(false);
  const [dpChoice, setDpChoice] = useState<"50" | "30" | "100" | "custom">("50");
  const [dpValue, setDpValue] = useState("");

  const savePdf = useCallback(() => {
    if (!invoiceId) return;
    window.open(`/api/invoices/${invoiceId}/pdf`, "_blank");
  }, [invoiceId]);

  useEffect(() => {
    let active = true;
    const fetchInvoice = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/invoices/${invoiceId}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok || json?.success === false) {
          throw new Error(json?.message || "Gagal memuat invoice");
        }
        if (active) setInvoice(json.data);
      } catch (err: any) {
        if (active) setError(err?.message || "Gagal memuat invoice");
      } finally {
        if (active) setLoading(false);
      }
    };

    if (invoiceId) fetchInvoice();
    return () => {
      active = false;
    };
  }, [invoiceId]);


  useEffect(() => {
    let active = true;
    const fetchBrand = async () => {
      setBrandLoading(true);
      try {
        const res = await fetch("/api/brand-profiles", { cache: "no-store" });
        if (!res.ok) throw new Error();
        const payload = await res.json();
        const activeBrand = Array.isArray(payload)
          ? payload.find((item: any) => item.isActive) ?? payload[0]
          : null;
        if (active) setBrand(activeBrand ?? null);
      } catch (err) {
        console.error("Failed to fetch brand", err);
        if (active) setBrand(null);
      } finally {
        if (active) setBrandLoading(false);
      }
    };
    fetchBrand();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const fetchActor = async () => {
      setActorLoading(true);
      try {
        const res = await fetch("/api/profile", { cache: "no-store" });
        if (!res.ok) throw new Error();
        const payload = await res.json();
        if (active) setActor(payload?.data ?? null);
      } catch (err) {
        console.error("Failed to fetch actor", err);
        if (active) setActor(null);
      } finally {
        if (active) setActorLoading(false);
      }
    };
    fetchActor();
    return () => {
      active = false;
    };
  }, []);
  const theme = useMemo(() => {
    const templateId = brand?.templateDefaults?.invoice as string | undefined;
    return resolveTheme(brand ?? {}, templateId);
  }, [brand]);

  const thankYouAndTerms = useMemo(() => {
    if (!brand) {
      return { message: "Thank you for your business", terms: DEFAULT_TERMS };
    }
    return resolveThankYou(brand);
  }, [brand]);

  const paymentLines = useMemo(() => resolvePaymentLines(brand ?? {}), [brand]);

  const items = invoice?.items ?? [];

  const computedSubtotal = useMemo(() => {
    if (typeof invoice?.subtotal === "number") return invoice.subtotal;
    return items.reduce((total, item) => {
      const qty = normalizeNumber(item.qty);
      const price = normalizeNumber(item.price);
      const defaultSubtotal = qty * price;
      if (typeof item.subtotal === "number") return total + item.subtotal;
      if (typeof item.discount === "number" && item.discount > 0) {
        if (item.discountType === "percent") {
          return total + defaultSubtotal * (1 - item.discount / 100);
        }
        return total + Math.max(defaultSubtotal - item.discount, 0);
      }
      return total + defaultSubtotal;
    }, 0);
  }, [invoice?.subtotal, items]);

  const extraDiscountAmount = useMemo(() => {
    const value = normalizeNumber(invoice?.extraDiscountValue);
    if (!value) return 0;
    if (invoice?.extraDiscountType === "percent") {
      return Math.round(computedSubtotal * (value / 100));
    }
    return value;
  }, [invoice?.extraDiscountType, invoice?.extraDiscountValue, computedSubtotal]);

  const brandContactLines = useMemo(() => {
    if (!brand) return [] as string[];
    const lines: Array<string | undefined> = [];
    if (brand.showBrandEmail !== false && brand.email) lines.push(brand.email);
    if (brand.showBrandWebsite !== false && brand.website) lines.push(brand.website);
    if (brand.showBrandAddress !== false && brand.address) lines.push(brand.address);
    return lines.filter((value): value is string => Boolean(value));
  }, [brand]);

  const actorHeading = useMemo(() => {
    if (!actor) return brand?.name || "Our Company";
    const parts = [
      actor?.name,
      [actor?.firstName, actor?.lastName].filter(Boolean).join(" ").trim(),
      actor?.company,
      brand?.name,
    ]
      .filter(Boolean)
      .map((value) => String(value).trim());
    return parts.find((value) => value.length) || "Our Company";
  }, [actor, brand]);

  const actorContactLines = useMemo(
    () => [actor?.email, actor?.phone].filter((value): value is string => Boolean(value)),
    [actor?.email, actor?.phone]
  );

  const customerHeading = useMemo(() => {
    if (!invoice?.customer) return "Customer";
    const parts = [invoice.customer.pic, invoice.customer.company]
      .filter(Boolean)
      .filter((value, index, array) => array.indexOf(value) === index);
    return parts.length ? parts.join(" | ") : "Customer";
  }, [invoice?.customer]);

  useEffect(() => {
    if (searchParams?.get("download") === "1" && invoice && !loading && !error) {
      const handle = window.setTimeout(() => savePdf(), 400);
      return () => window.clearTimeout(handle);
    }
    return undefined;
  }, [searchParams, invoice, loading, error, savePdf]);
  const renderPreview = () => {
    if (loading) {
      return <LoadingSpinner label="Memuat detail Invoice..." />;
    }
    if (error) {
      return <div className="py-12 text-center text-red-500">{error}</div>;
    }
    if (!invoice) {
      return <div className="py-12 text-center text-gray-500">Invoice tidak ditemukan.</div>;
    }

    return (
      <div
        className="w-full max-w-[820px] overflow-hidden rounded-xl border bg-white shadow"
        style={{ borderColor: `${theme.tableBorderColor}55` }}
      >
        <div
          className="space-y-10 px-10 py-10 text-sm leading-relaxed"
          style={{ color: theme.headerTextColor }}
        >
          <header className="flex flex-wrap items-start justify-between gap-6">
            <div className="flex flex-1 items-start gap-3">
              <div className="flex flex-col items-start">
                {brand?.logoUrl ? (
                  <img
                    src={brand.logoUrl}
                    alt={brand.name ?? "Brand logo"}
                    className="h-16 w-auto object-contain"
                  />
                ) : (
                  <div
                    className="flex h-16 w-24 items-center justify-center rounded bg-slate-100 text-xs font-semibold uppercase"
                    style={{
                      backgroundColor: theme.secondaryColor,
                      color: theme.mutedText,
                    }}
                  >
                    Logo
                  </div>
                )}
                {brandContactLines.length > 0 && (
                  <div
                    className="mt-2 space-y-0.5 text-xs"
                    style={{ color: theme.mutedText }}
                  >
                    {brandContactLines.map((line) => (
                      <div key={line}>{line}</div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex-1">
                {brand?.showBrandName !== false && brand?.name && (
                  <h2
                    className="text-2xl font-semibold leading-tight"
                    style={{ color: theme.primaryColor }}
                  >
                    {brand.name}
                  </h2>
                )}
                {brand?.showBrandDescription !== false && brand?.overview && (
                  <p className="mt-1 text-sm" style={{ color: theme.mutedText }}>
                    {brand.overview}
                  </p>
                )}
              </div>
            </div>

            <div className="min-w-[220px] text-right">
              <div
                className="text-[28px] font-extrabold tracking-tight"
                style={{ color: theme.primaryColor }}
              >
                INVOICE
              </div>
              <div className="mt-6 space-y-3 text-xs" style={{ color: theme.mutedText }}>
                <div className="flex justify-between gap-6">
                  <span>Number</span>
                  <span
                    className="text-sm font-semibold"
                    style={{ color: theme.headerTextColor }}
                  >
                    {invoice.invoiceNumber || `INV-${invoice.id}`}
                  </span>
                </div>
                <div className="flex justify-between gap-6">
                  <span>Issue Date</span>
                  <span
                    className="text-sm font-semibold"
                    style={{ color: theme.headerTextColor }}
                  >
                    {formatDate(invoice.issueDate)}
                  </span>
                </div>
                <div className="flex justify-between gap-6">
                  <span>Due Date</span>
                  <span
                    className="text-sm font-semibold"
                    style={{ color: theme.headerTextColor }}
                  >
                    {formatDate(invoice.dueDate)}
                  </span>
                </div>
                {invoice.status && (
                  <div className="flex justify-between gap-6">
                    <span>Status</span>
                    <span
                      className="text-sm font-semibold"
                      style={{ color: theme.headerTextColor }}
                    >
                      {invoice.status}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </header>
          <section className="grid gap-8 md:grid-cols-2">
            <div>
              <div
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: theme.headerAccentColor }}
              >
                From
              </div>
              <div
                className="mt-2 h-0.5 w-10 rounded-full"
                style={{ backgroundColor: theme.tableBorderColor }}
              />
              <div className="mt-4 space-y-1.5 text-sm">
                <div className="font-semibold" style={{ color: theme.headerTextColor }}>
                  {actorHeading}
                </div>
                {actorContactLines.map((line) => (
                  <div key={line} style={{ color: theme.mutedText }}>
                    {line}
                  </div>
                ))}
                {brand?.showBrandAddress !== false && brand?.address && (
                  <div
                    className="whitespace-pre-line text-xs"
                    style={{ color: theme.mutedText }}
                  >
                    {brand.address}
                  </div>
                )}
              </div>
            </div>
            <div>
              <div
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: theme.headerAccentColor }}
              >
                Bill To
              </div>
              <div
                className="mt-2 h-0.5 w-10 rounded-full"
                style={{ backgroundColor: theme.tableBorderColor }}
              />
              <div className="mt-4 space-y-1.5 text-sm">
                <div className="font-semibold" style={{ color: theme.headerTextColor }}>
                  {customerHeading}
                </div>
                {invoice.customer?.address && (
                  <div
                    className="whitespace-pre-line text-xs"
                    style={{ color: theme.mutedText }}
                  >
                    {invoice.customer.address}
                  </div>
                )}
                {[invoice.customer?.email, invoice.customer?.phone]
                  .filter((value): value is string => Boolean(value))
                  .map((value) => (
                    <div key={value} style={{ color: theme.mutedText }}>
                      {value}
                    </div>
                  ))}
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: theme.headerAccentColor }}
            >
              Itemised Summary
            </div>
            <div
              className="overflow-hidden rounded-lg border"
              style={{ borderColor: theme.tableBorderColor }}
            >
              <table className="w-full border-collapse text-sm">
                <colgroup>
                  <col style={{ width: "50%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "13%" }} />
                  <col style={{ width: "13%" }} />
                </colgroup>
                <thead>
                  <tr
                    style={{
                      backgroundColor: theme.totalBackground,
                      color: "#FFFFFF",
                    }}
                  >
                    {[
                      "Description",
                      "Qty",
                      "Unit",
                      "Price",
                      "Amount",
                    ].map((label) => (
                      <th
                        key={label}
                        className="px-4 py-3 text-xs uppercase tracking-wide"
                        style={{
                          textAlign:
                            label === "Description"
                              ? "left"
                              : label === "Qty" || label === "Unit"
                              ? "center"
                              : "right",
                        }}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => {
                    const qty = normalizeNumber(item.qty);
                    const price = normalizeNumber(item.price);
                    const amount = normalizeNumber(
                      item.subtotal ?? qty * price
                    );
                    const background = index % 2 === 0 ? theme.zebraRowColor : "#FFFFFF";
                    return (
                      <tr
                        key={item.id ?? `${item.name}-${index}`}
                        style={{
                          backgroundColor: background,
                          borderBottom: `1px solid ${theme.tableBorderColor}`,
                        }}
                      >
                        <td className="px-4 py-4 align-top">
                          <div
                            className="text-sm font-semibold"
                            style={{ color: theme.headerTextColor }}
                          >
                            {item.name || "-"}
                          </div>
                          {item.description && (
                            <p
                              className="mt-2 text-xs leading-relaxed"
                              style={{ color: theme.mutedText }}
                            >
                              {item.description}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-4 text-center align-middle">
                          {qty.toLocaleString("id-ID")}
                        </td>
                        <td className="px-4 py-4 text-center align-middle">
                          {item.unit || "pcs"}
                        </td>
                        <td className="px-4 py-4 text-right align-middle">
                          {formatCurrency(price)}
                        </td>
                        <td
                          className="px-4 py-4 text-right align-middle font-semibold"
                          style={{ color: theme.headerTextColor }}
                        >
                          {formatCurrency(amount)}
                        </td>
                      </tr>
                    );
                  })}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-400">
                        Belum ada item pada invoice ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
          <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(240px,1fr)]">
            <div className="space-y-6">
              <div>
                <div
                  className="text-xs font-semibold uppercase tracking-wide"
                  style={{ color: theme.headerAccentColor }}
                >
                  Payment Info
                </div>
                <div className="mt-3 space-y-2 text-sm" style={{ color: theme.mutedText }}>
                  {paymentLines.length ? (
                    paymentLines.map((line, idx) => (
                      <div key={`${line}-${idx}`}>{line}</div>
                    ))
                  ) : (
                    <div className="italic text-slate-400">
                      Silakan hubungi kami untuk informasi pembayaran.
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div
                  className="text-xs font-semibold uppercase tracking-wide"
                  style={{ color: theme.headerAccentColor }}
                >
                  Instruksi Khusus
                </div>
                <div className="mt-3 space-y-2 text-sm" style={{ color: theme.mutedText }}>
                  {(invoice.terms
                    ? invoice.terms.split(/\r?\n/)
                    : invoice.notes
                    ? invoice.notes.split(/\r?\n/)
                    : thankYouAndTerms.terms
                  ).map((line, idx) => (
                    <div key={`${line}-${idx}`}>{line}</div>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <div
                className="rounded-2xl p-6 text-right shadow-sm"
                style={{
                  backgroundColor: theme.totalBackground,
                  color: theme.totalTextColor,
                }}
              >
                <div className="text-xs font-semibold uppercase tracking-wide">
                  Total Due
                </div>
                <div className="mt-3 text-3xl font-bold">
                  {formatCurrency(invoice.total)}
                </div>
                {thankYouAndTerms.message && (
                  <div className="mt-4 text-xs">{thankYouAndTerms.message}</div>
                )}
              </div>

              <div
                className="mt-4 space-y-2 rounded-xl border px-5 py-4 text-sm text-slate-600"
                style={{ borderColor: `${theme.tableBorderColor}55` }}
              >
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatCurrency(computedSubtotal)}</span>
                </div>
                {normalizeNumber(invoice?.lineDiscount) > 0 && (
                  <div className="flex justify-between">
                    <span>Line Discount</span>
                    <span>- {formatCurrency(invoice?.lineDiscount)}</span>
                  </div>
                )}
                {extraDiscountAmount > 0 && (
                  <div className="flex justify-between">
                    <span>Extra Discount</span>
                    <span>- {formatCurrency(extraDiscountAmount)}</span>
                  </div>
                )}
                {normalizeNumber(invoice?.shippingCost) > 0 && (
                  <div className="flex justify-between">
                    <span>Shipping</span>
                    <span>{formatCurrency(invoice?.shippingCost)}</span>
                  </div>
                )}
                {normalizeNumber(invoice?.taxAmount) > 0 && (
                  <div className="flex justify-between">
                    <span>Tax</span>
                    <span>{formatCurrency(invoice?.taxAmount)}</span>
                  </div>
                )}
                {normalizeNumber(invoice?.downPayment) > 0 && (
                  <div className="flex justify-between">
                    <span>Down Payment</span>
                    <span>- {formatCurrency(invoice?.downPayment)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-3 font-semibold text-slate-900">
                  <span>Total</span>
                  <span>{formatCurrency(invoice.total)}</span>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: theme.headerAccentColor }}
            >
              Signature
            </div>
            <div
              className="rounded-xl border px-6 py-8 text-center"
              style={{ borderColor: `${theme.tableBorderColor}88` }}
            >
              <div
                className="text-sm font-semibold"
                style={{ color: theme.headerTextColor }}
              >
                {actorHeading || brand?.name || "Authorized"}
              </div>
              <div className="mt-6 text-xs text-slate-400">
                (Tanda tangan dan stempel jika diperlukan)
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  };

  const handleDpSave = async () => {
    if (!invoice) return;
    let value = 0;
    if (dpChoice === "50") value = Math.round(normalizeNumber(invoice.total) * 0.5);
    else if (dpChoice === "30") value = Math.round(normalizeNumber(invoice.total) * 0.3);
    else if (dpChoice === "100") value = Math.round(normalizeNumber(invoice.total));
    else value = normalizeNumber(dpValue.replace(/[^0-9.-]/g, ""));

    try {
      const isHundred = dpChoice === "100" || value >= normalizeNumber(invoice.total);
      const statusToSend = isHundred ? "Paid" : "DP";
      const res = await fetch(`/api/invoices/${invoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ downPayment: value, status: statusToSend }),
      });
      if (!res.ok) throw new Error();
      toast.success("DP tersimpan. Silakan lanjut ke Invoice Pembayaran.");
      window.location.href = "/penjualan/invoice-penjualan?tab=payment";
    } catch {
      toast.error("Gagal menyimpan DP");
    }
  };

  const isBusy = loading || brandLoading || actorLoading;

  return (
    <FeatureGuard feature="sales.invoice">
      <div className="px-6 py-6 sm:px-10">
        <PageBreadcrumb
          {...({
            pageTitle: "Detail Invoice",
            items: [
              { label: "Penjualan", href: "/penjualan/invoice-penjualan" },
              { label: "Invoice", href: "/penjualan/invoice-penjualan" },
              { label: invoice?.invoiceNumber || `INV-${invoice?.id ?? "-"}` },
            ],
          } as any)}
        />
        <div
          className="mt-6 rounded-2xl border bg-gradient-to-br from-white via-white to-slate-50 px-6 py-5 shadow-sm"
          style={{ borderColor: `${theme.tableBorderColor}33` }}
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-8">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Total
                </div>
                <div className="text-xl font-bold text-slate-900">
                  {formatCurrency(invoice?.total)}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Number
                </div>
                <div className="text-sm font-semibold text-slate-900">
                  {invoice?.invoiceNumber || (invoice ? `INV-${invoice.id}` : "-")}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Issue Date
                </div>
                <div className="text-sm font-semibold text-slate-900">
                  {formatDate(invoice?.issueDate)}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Due Date
                </div>
                <div className="text-sm font-semibold text-slate-900">
                  {formatDate(invoice?.dueDate)}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Ref. Quotation
                </div>
                <div className="text-sm font-semibold text-slate-900">
                  {invoice?.quotation?.id ? (
                    <Link href={`/penjualan/quotation/${invoice.quotation.id}`} className="text-blue-600 hover:underline">
                      {invoice.quotation.quotationNumber || `Q-${invoice.quotation.id}`}
                    </Link>
                  ) : (
                    "-"
                  )}
                </div>
              </div>
            </div>
            <div className="text-left md:text-right">
              <span
                className="inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
                style={{
                  backgroundColor: theme.secondaryColor,
                  color: theme.headerAccentColor,
                }}
              >
                {invoice?.status || "Draft"}
              </span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            <button
              onClick={savePdf}
              disabled={!invoice || loading}
              className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Unduh PDF
            </button>
            <button
              onClick={() => setDpOpen(true)}
              disabled={!invoice || loading}
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Rekam DP
            </button>
            {invoice && (
              <Link
                href={`/penjualan/invoice-penjualan/edit/${invoice.id}?from=detail`}
                className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-amber-600"
              >
                Ubah
              </Link>
            )}
            <Link
              href="/penjualan/invoice-penjualan"
              className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
            >
              Kembali
            </Link>
          </div>
        </div>

        <div className="mt-8 flex justify-center">
          {renderPreview()}
        </div>

        <div className="mx-auto mt-6 flex max-w-[820px] flex-col gap-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-500">
            {isBusy ? "Memuat informasi brand..." : ""}
          </div>
        </div>

        {dpOpen && invoice && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={(event) => {
              if (event.target === event.currentTarget) setDpOpen(false);
            }}
          >
            <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b px-6 py-4">
                <h2 className="text-lg font-semibold">
              Rekam DP
            </h2>
                <button
                  onClick={() => setDpOpen(false)}
                  className="text-gray-400 hover:text-gray-600">
                  x
                </button>
              </div>
              <div className="space-y-3 px-6 py-4">
                <p className="text-sm text-gray-700">
                  Pilih besaran DP untuk invoice {invoice.invoiceNumber || `INV-${invoice.id}`}.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDpChoice("50")}
                    className={`px-3 py-2 rounded border ${dpChoice === "50" ? "border-blue-500 bg-blue-50" : "border-gray-300"}`}
                  >
                    50%
                  </button>
                  <button
                    onClick={() => setDpChoice("30")}
                    className={`px-3 py-2 rounded border ${dpChoice === "30" ? "border-blue-500 bg-blue-50" : "border-gray-300"}`}
                  >
                    30%
                  </button>
                  <button
                    onClick={() => setDpChoice("100")}
                    className={`px-3 py-2 rounded border ${dpChoice === "100" ? "border-blue-500 bg-blue-50" : "border-gray-300"}`}
                  >
                    100%
                  </button>
                  <button
                    onClick={() => setDpChoice("custom")}
                    className={`px-3 py-2 rounded border ${dpChoice === "custom" ? "border-blue-500 bg-blue-50" : "border-gray-300"}`}
                  >
                    Nominal (Rp)
                  </button>
                </div>
                {dpChoice === "custom" && (
                  <input
                    value={dpValue}
                    onChange={(event) => setDpValue(event.target.value)}
                    placeholder="Masukkan nominal"
                    className="w-full rounded border px-3 py-2 text-sm"
                  />
                )}
              </div>
              <div className="flex justify-end gap-3 border-t px-6 py-4">
                <button
                  onClick={() => setDpOpen(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
                >
                  Batal
                </button>
                <button
                  onClick={handleDpSave}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Simpan
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </FeatureGuard>
  );
}



















