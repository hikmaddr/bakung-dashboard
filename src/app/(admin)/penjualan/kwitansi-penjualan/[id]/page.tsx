"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Truck } from "lucide-react";
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
import { terbilangRupiah } from "@/lib/terbilang";

interface ReceiptItem {
  id?: number;
  name: string;
  description?: string | null;
  qty?: number;
  unit?: string | null;
  price?: number;
  subtotal?: number | null;
}

interface ReceiptCustomer {
  id?: number;
  pic?: string | null;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
}

interface ReceiptData {
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
  taxAmount?: number | null;
  downPayment?: number | null;
  total?: number | null;
  items?: ReceiptItem[];
  customer?: ReceiptCustomer | null;
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

export default function ReceiptDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();

  const receiptId = useMemo(() => {
    const raw = params?.id;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [params?.id]);

  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [brand, setBrand] = useState<any | null>(null);
  const [brandLoading, setBrandLoading] = useState(true);
  const [actor, setActor] = useState<any | null>(null);
  const [actorLoading, setActorLoading] = useState(true);

  const [sendOpen, setSendOpen] = useState(false);
  const [sendMethod, setSendMethod] = useState<"wa" | "email" | "pdf">("pdf");
  const [fromInvoiceContext, setFromInvoiceContext] = useState(false);

  const [spell, setSpell] = useState("-");

  const savePdf = useCallback(() => {
    if (!receiptId) return;
    window.open(`/api/receipts/${receiptId}/pdf`, "_blank");
  }, [receiptId]);

  // Deteksi konteks pembuatan dari Invoice menggunakan localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('newReceiptFromInvoice');
      if (!raw) { setFromInvoiceContext(false); return; }
      const payload = JSON.parse(raw);
      const isFromInvoice = payload && payload.from === 'invoice' && String(payload.invoiceId) === String(receiptId);
      setFromInvoiceContext(Boolean(isFromInvoice));
    } catch {
      setFromInvoiceContext(false);
    }
  }, [receiptId]);

  useEffect(() => {
    let active = true;
    const fetchReceipt = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/invoices/${receiptId}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok || json?.success === false) {
          throw new Error(json?.message || "Gagal memuat kwitansi");
        }
        if (active) {
          setReceipt(json.data);
          setSpell(terbilangRupiah(normalizeNumber(json.data?.total)));
        }
      } catch (err: any) {
        if (active) setError(err?.message || "Gagal memuat kwitansi");
      } finally {
        if (active) setLoading(false);
      }
    };

    if (receiptId) fetchReceipt();
    return () => {
      active = false;
    };
  }, [receiptId]);

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
      return { message: "Terima kasih atas pembayaran Anda", terms: DEFAULT_TERMS };
    }
    return resolveThankYou(brand);
  }, [brand]);

  const paymentLines = useMemo(() => resolvePaymentLines(brand ?? {}), [brand]);

  const items = receipt?.items ?? [];

  const computedSubtotal = useMemo(() => {
    if (typeof receipt?.subtotal === "number") return receipt.subtotal;
    return items.reduce((total, item) => total + normalizeNumber(item.subtotal ?? normalizeNumber(item.qty) * normalizeNumber(item.price)), 0);
  }, [receipt?.subtotal, items]);

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
    if (!receipt?.customer) return "Customer";
    const parts = [receipt.customer.pic, receipt.customer.company]
      .filter(Boolean)
      .filter((value, index, array) => array.indexOf(value) === index);
    return parts.length ? parts.join(" | ") : "Customer";
  }, [receipt?.customer]);

  const paymentNarrative = useMemo(() => {
    const amountText = formatCurrency(receipt?.total);
    const spelled = spell && spell !== "-" ? spell : "";
    const customer = receipt?.customer?.company || receipt?.customer?.pic || "Customer";
    return `Telah diterima uang sejumlah ${amountText}${spelled ? ` (${spelled})` : ""} dari ${customer}.`;
  }, [receipt?.total, receipt?.customer, spell]);

  const linesWithSubtotal = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        subtotal: normalizeNumber(item.subtotal ?? normalizeNumber(item.qty) * normalizeNumber(item.price)),
      })),
    [items]
  );

  const isBusy = loading || brandLoading || actorLoading;

  const renderPreview = () => {
    if (loading) return <LoadingSpinner label="Memuat detail Kwitansi..." />;
    if (error) return <div className="py-12 text-center text-red-500">{error}</div>;
    if (!receipt) return <div className="py-12 text-center text-gray-500">Kwitansi tidak ditemukan.</div>;

    return (
      <div
        className="w-full max-w-[820px] overflow-hidden rounded-xl border bg-white shadow"
        style={{ borderColor: `${theme.tableBorderColor}55` }}
      >
        <div className="space-y-10 px-10 py-10 text-sm leading-relaxed" style={{ color: theme.headerTextColor }}>
          <header className="flex flex-wrap items-start justify-between gap-6">
            <div className="flex flex-1 items-start gap-3">
              <div className="flex flex-col items-start">
                {brand?.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={brand.logoUrl} alt={brand.name ?? "Brand logo"} className="h-16 w-auto object-contain" />
                ) : (
                  <div
                    className="flex h-16 w-24 items-center justify-center rounded bg-slate-100 text-xs font-semibold uppercase"
                    style={{ backgroundColor: theme.secondaryColor, color: theme.mutedText }}
                  >
                    Logo
                  </div>
                )}
                {brandContactLines.length > 0 && (
                  <div className="mt-2 space-y-0.5 text-xs" style={{ color: theme.mutedText }}>
                    {brandContactLines.map((line) => (
                      <div key={line}>{line}</div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex-1">
                {brand?.showBrandName !== false && brand?.name && (
                  <h2 className="text-2xl font-semibold leading-tight" style={{ color: theme.primaryColor }}>
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
              <div className="text-[28px] font-extrabold tracking-tight" style={{ color: theme.primaryColor }}>
                RECEIPT
              </div>
              <div className="mt-6 space-y-3 text-xs" style={{ color: theme.mutedText }}>
                <div className="flex justify-between gap-6">
                  <span>Number</span>
                  <span className="text-sm font-semibold" style={{ color: theme.headerTextColor }}>
                    {receipt.invoiceNumber || `RCPT-${receipt.id}`}
                  </span>
                </div>
                <div className="flex justify-between gap-6">
                  <span>Date</span>
                  <span className="text-sm font-semibold" style={{ color: theme.headerTextColor }}>
                    {formatDate(receipt.issueDate)}
                  </span>
                </div>
                {receipt.status && (
                  <div className="flex justify-between gap-6">
                    <span>Status</span>
                    <span className="text-sm font-semibold" style={{ color: theme.headerTextColor }}>
                      {receipt.status}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </header>

          <section className="rounded-xl border px-6 py-5" style={{ borderColor: `${theme.tableBorderColor}55`, backgroundColor: `${theme.secondaryColor}22` }}>
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.headerAccentColor }}>
              Pengantar
            </div>
            <p className="mt-3 text-sm" style={{ color: theme.headerTextColor }}>
              {paymentNarrative}
            </p>
          </section>

          <section className="grid gap-8 md:grid-cols-2">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.headerAccentColor }}>
                From
              </div>
              <div className="mt-2 h-0.5 w-10 rounded-full" style={{ backgroundColor: theme.tableBorderColor }} />
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
                  <div className="whitespace-pre-line text-xs" style={{ color: theme.mutedText }}>
                    {brand.address}
                  </div>
                )}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.headerAccentColor }}>
                Received From
              </div>
              <div className="mt-2 h-0.5 w-10 rounded-full" style={{ backgroundColor: theme.tableBorderColor }} />
              <div className="mt-4 space-y-1.5 text-sm">
                <div className="font-semibold" style={{ color: theme.headerTextColor }}>
                  {customerHeading}
                </div>
                {receipt.customer?.address && (
                  <div className="whitespace-pre-line text-xs" style={{ color: theme.mutedText }}>
                    {receipt.customer.address}
                  </div>
                )}
                {[receipt.customer?.email, receipt.customer?.phone]
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
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.headerAccentColor }}>
              Itemised Summary
            </div>
            <div className="overflow-hidden rounded-lg border" style={{ borderColor: theme.tableBorderColor }}>
              <table className="w-full border-collapse text-sm">
                <colgroup>
                  <col style={{ width: "50%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "13%" }} />
                  <col style={{ width: "13%" }} />
                </colgroup>
                <thead>
                  <tr style={{ backgroundColor: theme.totalBackground, color: "#FFFFFF" }}>
                    {["Description", "Qty", "Unit", "Price", "Amount"].map((label) => (
                      <th
                        key={label}
                        className="px-4 py-3 text-xs uppercase tracking-wide"
                        style={{ textAlign: label === "Description" ? "left" : label === "Qty" || label === "Unit" ? "center" : "right" }}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {linesWithSubtotal.map((item, index) => {
                    const background = index % 2 === 0 ? theme.zebraRowColor : "#FFFFFF";
                    return (
                      <tr
                        key={item.id ?? `${item.name}-${index}`}
                        style={{ backgroundColor: background, borderBottom: `1px solid ${theme.tableBorderColor}` }}
                      >
                        <td className="px-4 py-4 align-top">
                          <div className="text-sm font-semibold" style={{ color: theme.headerTextColor }}>
                            {item.name || "-"}
                          </div>
                          {item.description && (
                            <p className="mt-2 text-xs leading-relaxed" style={{ color: theme.mutedText }}>
                              {item.description}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-4 text-center align-middle">{normalizeNumber(item.qty).toLocaleString("id-ID")}</td>
                        <td className="px-4 py-4 text-center align-middle">{item.unit || "pcs"}</td>
                        <td className="px-4 py-4 text-right align-middle">{formatCurrency(item.price)}</td>
                        <td className="px-4 py-4 text-right align-middle font-semibold" style={{ color: theme.headerTextColor }}>
                          {formatCurrency(item.subtotal)}
                        </td>
                      </tr>
                    );
                  })}
                  {linesWithSubtotal.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-400">
                        Belum ada item pada kwitansi ini.
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
                <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.headerAccentColor }}>
                  Payment Info
                </div>
                <div className="mt-3 space-y-2 text-sm" style={{ color: theme.mutedText }}>
                  {paymentLines.length ? (
                    paymentLines.map((line, idx) => <div key={`${line}-${idx}`}>{line}</div>)
                  ) : (
                    <div className="italic text-slate-400">Silakan hubungi kami untuk informasi pembayaran.</div>
                  )}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.headerAccentColor }}>
                  Terms &amp; Conditions
                </div>
                <div className="mt-3 space-y-2 text-sm" style={{ color: theme.mutedText }}>
                  {(receipt.terms?.split(/\r?\n/) ?? thankYouAndTerms.terms).map((line, idx) => (
                    <div key={`${line}-${idx}`}>- {line}</div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.headerAccentColor }}>
                  Notes
                </div>
                <div className="mt-3 space-y-2 text-sm" style={{ color: theme.mutedText }}>
                  {receipt.notes ? (
                    receipt.notes.split(/\r?\n/).map((line, idx) => <div key={`${line}-${idx}`}>{line}</div>)
                  ) : (
                    <div className="italic text-slate-400">Tidak ada catatan tambahan.</div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <div
                className="rounded-2xl p-6 text-right shadow-sm"
                style={{ backgroundColor: theme.totalBackground, color: theme.totalTextColor }}
              >
                <div className="text-xs font-semibold uppercase tracking-wide">Jumlah Diterima</div>
                <div className="mt-3 text-3xl font-bold">{formatCurrency(receipt.total)}</div>
                {thankYouAndTerms.message && <div className="mt-4 text-xs">{thankYouAndTerms.message}</div>}
              </div>

              <div className="mt-4 space-y-2 rounded-xl border px-5 py-4 text-sm text-slate-600" style={{ borderColor: `${theme.tableBorderColor}55` }}>
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatCurrency(computedSubtotal)}</span>
                </div>
                {normalizeNumber(receipt?.lineDiscount) > 0 && (
                  <div className="flex justify-between">
                    <span>Line Discount</span>
                    <span>- {formatCurrency(receipt?.lineDiscount)}</span>
                  </div>
                )}
                {normalizeNumber(receipt?.taxAmount) > 0 && (
                  <div className="flex justify-between">
                    <span>Tax</span>
                    <span>{formatCurrency(receipt?.taxAmount)}</span>
                  </div>
                )}
                {normalizeNumber(receipt?.downPayment) > 0 && (
                  <div className="flex justify-between">
                    <span>Down Payment</span>
                    <span>- {formatCurrency(receipt?.downPayment)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-3 font-semibold text-slate-900">
                  <span>Total</span>
                  <span>{formatCurrency(receipt.total)}</span>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.headerAccentColor }}>
              Signature
            </div>
            <div className="rounded-xl border px-6 py-8 text-center" style={{ borderColor: `${theme.tableBorderColor}88` }}>
              <div className="text-sm font-semibold" style={{ color: theme.headerTextColor }}>
                {actorHeading || brand?.name || "Authorized"}
              </div>
              <div className="mt-6 text-xs text-slate-400">(Tanda tangan dan stempel jika diperlukan)</div>
            </div>
          </section>
        </div>
      </div>
    );
  };

  const simpanDraft = () => {
    if (!receipt) return;
    try {
      const draftsRaw = localStorage.getItem("kwitansiDrafts") || "[]";
      let drafts: any[] = [];
      try {
        drafts = JSON.parse(draftsRaw);
      } catch {
        drafts = [];
      }
      drafts = Array.isArray(drafts) ? drafts.filter((draft) => draft?.invoiceId !== receipt.id) : [];
      drafts.push({
        ts: Date.now(),
        invoiceId: receipt.id,
        invoiceNumber: receipt.invoiceNumber,
        spell,
        total: receipt.total,
        customer: receipt.customer || null,
      });
      localStorage.setItem("kwitansiDrafts", JSON.stringify(drafts));
      toast.success("Draft kwitansi disimpan");
    } catch {
      toast.error("Gagal menyimpan draft");
    }
  };

  const handleSend = async () => {
    if (!receipt) return;
    try {
      // Simpan otomatis ke list kwitansi saat submit kirim
      simpanDraft();
      if (sendMethod === "pdf") {
        savePdf();
        setSendOpen(false);
        return;
      }
      if (sendMethod === "wa") {
        const msg = encodeURIComponent(`Kwitansi ${receipt.invoiceNumber || receipt.id} sebesar ${formatCurrency(receipt.total)}.`);
        window.open(`https://wa.me/?text=${msg}`, "_blank");
      } else {
        const subject = encodeURIComponent(`Kwitansi ${receipt.invoiceNumber || receipt.id}`);
        const body = encodeURIComponent(`Kwitansi ${receipt.invoiceNumber || receipt.id} sebesar ${formatCurrency(receipt.total)}.`);
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
      }
      setSendOpen(false);
    } catch {
      toast.error("Gagal mengirim kwitansi");
    }
  };

  const autoDownload = searchParams?.get("download") === "1";
  useEffect(() => {
    if (!autoDownload || loading || error || !receipt) return;
    const handle = window.setTimeout(() => savePdf(), 350);
    return () => window.clearTimeout(handle);
  }, [autoDownload, loading, error, receipt, savePdf]);

  return (
    <FeatureGuard feature="sales.receipt">
      <div className="px-6 py-6 sm:px-10">
        <PageBreadcrumb
          {...({
            pageTitle: "Detail Kwitansi",
            items: [
              { label: "Penjualan", href: "/penjualan/kwitansi-penjualan" },
              { label: "Kwitansi", href: "/penjualan/kwitansi-penjualan" },
              { label: receipt?.invoiceNumber || `RCPT-${receipt?.id ?? "-"}` },
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
                  {formatCurrency(receipt?.total)}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Number
                </div>
                <div className="text-sm font-semibold text-slate-900">
                  {receipt?.invoiceNumber || (receipt ? `RCPT-${receipt.id}` : "-")}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Date
                </div>
                <div className="text-sm font-semibold text-slate-900">
                  {formatDate(receipt?.issueDate)}
                </div>
              </div>
            </div>
            <div className="text-left md:text-right">
              <span
                className="inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
                style={{ backgroundColor: theme.secondaryColor, color: theme.headerAccentColor }}
              >
                {receipt?.status || "Draft"}
              </span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            {!fromInvoiceContext && (
              <button
                onClick={savePdf}
                disabled={!receipt || loading}
                className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Unduh PDF
              </button>
            )}
            <button
              onClick={simpanDraft}
              disabled={!receipt || loading}
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Simpan Draft
            </button>
            <Link
              href={receipt ? `/penjualan/surat-jalan/add?from=receipt&invoiceId=${receipt.id}` : "/penjualan/surat-jalan"}
              className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Truck className="h-4 w-4" />
              Surat Jalan
            </Link>
            <button
              onClick={() => setSendOpen(true)}
              disabled={!receipt || loading}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Kirim Kwitansi
            </button>
            <Link
              href="/penjualan/kwitansi-penjualan"
              className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
            >
              Kembali
            </Link>
          </div>
        </div>

        <div className="mt-8 flex justify-center">{renderPreview()}</div>

        <div className="mx-auto mt-6 flex max-w-[820px] flex-col gap-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-500">{isBusy ? "Memuat informasi brand..." : ""}</div>
        </div>

        {sendOpen && receipt && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={(event) => {
              if (event.target === event.currentTarget) setSendOpen(false);
            }}
          >
            <div className="w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b px-6 py-4">
                <h2 className="text-lg font-semibold">Kirim Kwitansi</h2>
                <button onClick={() => setSendOpen(false)} className="text-gray-400 hover:text-gray-600">
                  ×
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x">
                <div className="space-y-3 p-6">
                  <p className="mb-2 font-medium text-gray-800">Pilih metode</p>
                  <label
                    onClick={() => setSendMethod("wa")}
                    className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition ${
                      sendMethod === "wa" ? "border-green-500 bg-green-50" : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" /> WhatsApp
                  </label>
                  <label
                    onClick={() => setSendMethod("email")}
                    className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition ${
                      sendMethod === "email" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" /> Email
                  </label>
                  <label
                    onClick={() => setSendMethod("pdf")}
                    className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition ${
                      sendMethod === "pdf" ? "border-slate-500 bg-slate-50" : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-500" /> Simpan sebagai PDF
                  </label>
                </div>
                <div className="p-6">
                  <p className="mb-2 font-medium text-gray-800">Preview Pesan</p>
                  <textarea
                    className="h-56 w-full resize-none rounded-lg border border-gray-300 p-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    readOnly
                    value={`Kwitansi ${receipt.invoiceNumber || receipt.id} sebesar ${formatCurrency(receipt.total)}.`}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 border-t px-6 py-4">
                <button
                  onClick={() => setSendOpen(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
                >
                  Batal
                </button>
                <button
                  onClick={handleSend}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Kirim
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </FeatureGuard>
  );
}
