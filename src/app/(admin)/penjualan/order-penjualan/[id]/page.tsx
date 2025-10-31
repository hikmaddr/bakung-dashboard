"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Trash2,
  Pencil,
  Paperclip,
  PlusCircle,
  Send,
  ChevronDown,
} from "lucide-react";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import FeatureGuard from "@/components/FeatureGuard";
import {
  resolveTheme,
  resolveThankYou,
  resolvePaymentLines,
  DEFAULT_TERMS,
} from "@/lib/quotationTheme";

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

export default function SalesOrderDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const [order, setOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatingInvoice, setCreatingInvoice] = useState(false);

  const [brand, setBrand] = useState<any | null>(null);
  const [brandLoading, setBrandLoading] = useState(true);
  const [actor, setActor] = useState<any | null>(null);
  const [actorLoading, setActorLoading] = useState(true);

  // Kirim modal state
  const [sendOpen, setSendOpen] = useState(false);
  const [sendMethod, setSendMethod] = useState<"wa" | "email" | "pdf">("email");

  // Dropdown tindakan (Invoice)
  const [actionOpen, setActionOpen] = useState(false);
  // Pembayaran untuk SO ini
  const [payments, setPayments] = useState<any[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const res = await fetch(`/api/sales-orders/${id}`);
        const data = await res.json();
        if (!res.ok || !data?.success) {
          toast.error(data?.message || "Sales Order tidak ditemukan");
          router.push("/penjualan/order-penjualan");
          return;
        }
        setOrder(data.data);
      } catch (error) {
        toast.error("Gagal ambil data Sales Order");
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [id, router]);

  useEffect(() => {
    const fetchBrand = async () => {
      setBrandLoading(true);
      try {
        const res = await fetch("/api/brand-profiles", { cache: "no-store" });
        if (!res.ok) throw new Error();
        const payload = await res.json();
        const active =
          Array.isArray(payload) && payload.length
            ? payload.find((item: any) => item.isActive) ?? payload[0]
            : null;
        setBrand(active ?? null);
      } catch (error) {
        console.error("Failed to fetch brand profile", error);
        setBrand(null);
      } finally {
        setBrandLoading(false);
      }
    };
    fetchBrand();
  }, []);

  // Tidak menampilkan opsi Ubah Invoice; aksi edit SO dipindah ke dropdown

  useEffect(() => {
    const fetchActor = async () => {
      setActorLoading(true);
      try {
        const res = await fetch("/api/profile", { cache: "no-store" });
        if (!res.ok) throw new Error();
        const payload = await res.json();
        setActor(payload?.data ?? null);
      } catch (error) {
        console.error("Failed to fetch user profile", error);
        setActor(null);
      } finally {
        setActorLoading(false);
      }
    };
    fetchActor();
  }, []);

  // Ambil daftar pembayaran untuk SO ini
  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!id) return;
      setLoadingPayments(true);
      try {
        const res = await fetch(`/api/payments?refType=SALES_ORDER&refId=${id}`, { cache: "no-store" });
        const json = await res.json();
        if (active) {
          if (res.ok && json?.success !== false) {
            setPayments(Array.isArray(json?.data) ? json.data : []);
          } else {
            setPayments([]);
          }
        }
      } catch {
        if (active) setPayments([]);
      } finally {
        if (active) setLoadingPayments(false);
      }
    };
    run();
    return () => { active = false; };
  }, [id]);

  const currentTheme = useMemo(() => {
    const templateId =
      (brand?.templateDefaults?.invoice as string | undefined) ?? undefined;
    return resolveTheme(brand ?? {}, templateId);
  }, [brand]);
  const thankYouAndTerms = useMemo(() => {
    if (!brand)
      return {
        message: "Thank you for your business",
        terms: DEFAULT_TERMS,
      };
    return resolveThankYou(brand);
  }, [brand]);

  const paymentLines = useMemo(
    () => resolvePaymentLines(brand ?? {}),
    [brand]
  );

  const notesLines = useMemo(() => {
    if (!order?.notes) return [];
    return String(order.notes)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }, [order?.notes]);

  const projectLines = useMemo(() => {
    const desc = order?.quotation?.projectDesc;
    if (!desc) return [];
    return String(desc)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }, [order?.quotation?.projectDesc]);

  const brandContactLines = useMemo(() => {
    if (!brand) return [];
    const lines: Array<string | undefined> = [];
    if (brand.showBrandEmail !== false && brand.email) lines.push(brand.email);
    if (brand.showBrandWebsite !== false && brand.website)
      lines.push(brand.website);
    if (brand.showBrandAddress !== false && brand.address)
      lines.push(brand.address);
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
    () =>
      [actor?.email, actor?.phone].filter(
        (value): value is string => Boolean(value)
      ),
    [actor?.email, actor?.phone]
  );

  const customerHeading = useMemo(() => {
    if (!order?.customer) return "Customer";
    const parts = [order.customer.pic, order.customer.company]
      .filter(Boolean)
      .filter((value, index, array) => array.indexOf(value) === index);
    return parts.length ? parts.join(" | ") : "Customer";
  }, [order?.customer]);

  const hasItemImage = useMemo(
    () => Boolean(order?.items?.some((item: any) => item.imageUrl)),
    [order?.items]
  );
  const columnDefinitions = useMemo(() => {
    const columns: Array<{
      key: string;
      label: string;
      align: "left" | "center" | "right";
      width: number;
    }> = [];
    columns.push({
      key: "description",
      label: "Description",
      align: "left",
      width: hasItemImage ? 0.34 : 0.5,
    });
    if (hasItemImage) {
      columns.push({ key: "image", label: "Image", align: "center", width: 0.16 });
    }
    columns.push({ key: "qty", label: "Qty", align: "center", width: 0.1 });
    columns.push({ key: "unit", label: "Unit", align: "center", width: 0.12 });
    columns.push({
      key: "price",
      label: "Price",
      align: "right",
      width: hasItemImage ? 0.14 : 0.12,
    });
    columns.push({
      key: "amount",
      label: "Amount",
      align: "right",
      width: hasItemImage ? 0.14 : 0.12,
    });
    return columns;
  }, [hasItemImage]);

  const subtotal = normalizeNumber(order?.subtotal);
  const lineDiscount = normalizeNumber(order?.lineDiscount);
  const extraDiscount = normalizeNumber(order?.extraDiscount);
  const taxAmount = normalizeNumber(order?.taxAmount);
  const totalAmount = normalizeNumber(order?.totalAmount);

  const handleDelete = async () => {
    if (!confirm("Yakin ingin menghapus Sales Order ini?")) return;
    try {
      const res = await fetch(`/api/sales-orders/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Sales Order berhasil dihapus");
      router.push("/penjualan/order-penjualan");
    } catch (error) {
      toast.error("Gagal menghapus Sales Order");
    }
  };

  const handleCreateInvoice = async () => {
    if (!order) return;
    try {
      setCreatingInvoice(true);
      await fetch(`/api/sales-orders/${order.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Approved" }),
      });
      setOrder((prev: any) =>
        prev ? { ...prev, status: "Approved" } : prev
      );

      const payload = {
        from: "sales-order",
        orderId: order.id,
        orderNumber: order.orderNumber,
        date: order.date,
        quotationId: order.quotationId || null,
        quotationNumber: order.quotation?.quotationNumber || null,
        customer: {
          id: order.customer?.id,
          pic: order.customer?.pic || "",
          company: order.customer?.company || "",
          email: order.customer?.email || "",
          phone: order.customer?.phone || "",
          address: order.customer?.address || "",
        },
        items:
          order.items?.map((item: any) => ({
            name: item.product,
            description: item.description || "",
            qty: item.quantity,
            unit: item.unit || "pcs",
            price: item.price,
            discount: 0,
            tax: 0,
          })) ?? [],
        total: order.totalAmount,
      };
      localStorage.setItem("newInvoiceFromSO", JSON.stringify(payload));
      router.push(`/penjualan/invoice-penjualan/add?from=so&soId=${order.id}`);
    } catch (error) {
      toast.error("Gagal mengarahkan ke Invoice");
    } finally {
      setCreatingInvoice(false);
    }
  };

  // Generate & download PDF untuk Sales Order saat kirim
  const generatePDF = async () => {
    if (!order) return;
    try {
      const res = await fetch(`/api/sales-orders/${order.id}/pdf`);
      if (!res.ok) throw new Error("Gagal mengambil PDF");
      const blob = await res.blob();
      const safePicName = (order.customer?.pic || "").replace(/\s+/g, "_").replace(/[^a-zA-Z0-9-_]/g, "");
      const fileName = `${order.orderNumber} - ${safePicName}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("PDF disimpan");
    } catch (e: any) {
      toast.error(e?.message || "Gagal menyimpan PDF");
    }
  };

  // Handle kirim: update status menjadi Sent lalu jalankan aksi sesuai metode
  const handleSend = async () => {
    if (!order) return;
    try {
      const res = await fetch(`/api/sales-orders/${order.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Sent" }),
      });
      if (!res.ok) throw new Error("Gagal memperbarui status");
      setOrder((prev: any) => (prev ? { ...prev, status: "Sent" } : prev));

      if (sendMethod === "pdf") {
        await generatePDF();
      } else if (sendMethod === "wa") {
        const msg = encodeURIComponent(
          `Hi ${order.customer?.pic || "Customer"},\nAnda telah menerima Sales Order:\nNo: ${order.orderNumber}\nTanggal: ${formatDate(order.date)}\nTotal: ${formatCurrency(totalAmount)}\n\nUntuk info lebih lanjut hubungi kami.\nTerima kasih.`
        );
        window.open(`https://wa.me/?text=${msg}`, "_blank");
        toast.success("Sales Order dikirim via WhatsApp & status: Sent");
      } else {
        const subject = encodeURIComponent(`Sales Order ${order.orderNumber}`);
        const body = encodeURIComponent(
          `Hi ${order.customer?.pic || "Customer"},\nAnda telah menerima Sales Order:\nNo: ${order.orderNumber}\nTanggal: ${formatDate(order.date)}\nTotal: ${formatCurrency(totalAmount)}\n\nUntuk info lebih lanjut hubungi kami.\nTerima kasih.`
        );
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
        toast.success("Sales Order dikirim via Email & status: Sent");
      }
    } catch (e) {
      toast.error("Gagal mengirim Sales Order");
    } finally {
      setSendOpen(false);
      setSendMethod("email");
    }
  };
  if (loading) {
    return (
      <FeatureGuard feature="sales.order">
        <div className="min-h-screen p-6">
          <LoadingSpinner label="Memuat detail Sales Order..." />
        </div>
      </FeatureGuard>
    );
  }

  if (!order) {
    return (
      <FeatureGuard feature="sales.order">
        <div className="min-h-screen p-6 text-center text-red-500">
          Sales Order tidak ditemukan
        </div>
      </FeatureGuard>
    );
  }

  return (
    <FeatureGuard feature="sales.order">
      <div className="px-6 py-6 sm:px-10">
        <PageBreadcrumb
          {...({
            pageTitle: "Detail Sales Order",
            items: [
              { label: "Penjualan", href: "/penjualan/order-penjualan" },
              { label: "Sales Order", href: "/penjualan/order-penjualan" },
              { label: order.orderNumber || `SO-${order.id}` },
            ],
          } as any)}
        />

        <div
          className="mt-6 rounded-2xl border bg-gradient-to-br from-white via-white to-slate-50 px-6 py-5 shadow-sm"
          style={{ borderColor: `${currentTheme.tableBorderColor}33` }}
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-8">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Total
                </div>
                <div className="text-xl font-bold text-slate-900">
                  {formatCurrency(totalAmount)}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Number
                </div>
                <div className="text-sm font-semibold text-slate-900">
                  {order.orderNumber || `SO-${order.id}`}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Date
                </div>
                <div className="text-sm font-semibold text-slate-900">
                  {formatDate(order.date)}
                </div>
              </div>
              {order?.quotation?.quotationNumber ? (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Ref Quotation
                  </div>
                  <div className="text-sm font-semibold text-slate-900">
                    {order.quotation.quotationNumber}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="text-left md:text-right">
              <span
                className="inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
                style={{
                  backgroundColor: currentTheme.secondaryColor,
                  color: currentTheme.headerAccentColor,
                }}
              >
                {order.status || "Draft"}
              </span>
            </div>
          </div>

          {/* Mini Progress Bar: Quotation -> Order -> Payment -> Delivery */}
          <div className="mt-5">
            {(() => {
              const hasQuotation = Boolean(order?.quotationId);
              const paid = normalizeNumber(order?.paidAmount) >= normalizeNumber(order?.totalAmount) || String(order?.paymentStatus).toUpperCase() === "PAID";
              const hasAnyPayment = payments.length > 0;

              type Step = { key: string; label: string; state: "done" | "current" | "upcoming" };
              const steps: Step[] = [
                { key: "quotation", label: "Quotation", state: hasQuotation ? "done" : "upcoming" },
                { key: "order", label: "Order", state: "done" },
                { key: "payment", label: "Payment", state: paid ? "done" : hasAnyPayment ? "current" : "upcoming" },
                { key: "delivery", label: "Delivery", state: "upcoming" },
              ];

              const dot = (s: Step, idx: number) => {
                const base = "flex items-center";
                const isLast = idx === steps.length - 1;
                const color = s.state === "done"
                  ? "bg-emerald-600 border-emerald-600 text-white"
                  : s.state === "current"
                  ? "bg-amber-100 border-amber-500 text-amber-700"
                  : "bg-slate-100 border-slate-300 text-slate-500";
                const barColor = s.state === "done" ? "bg-emerald-500" : s.state === "current" ? "bg-amber-300" : "bg-slate-200";
                return (
                  <div key={s.key} className={`${base} w-full`}> 
                    <div className={`flex items-center gap-2`}>
                      <div className={`h-2.5 w-2.5 rounded-full border ${color}`} aria-hidden />
                      <span className="text-xs font-medium select-none">{s.label}</span>
                    </div>
                    {!isLast && <div className={`mx-2 h-[2px] flex-1 ${barColor}`} />}
                  </div>
                );
              };

              return (
                <div className="rounded-lg border border-slate-200/60 bg-white px-3 py-2">
                  <div className="flex items-center">{steps.map((s, i) => dot(s, i))}</div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
                    {hasQuotation ? (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-emerald-700">✓ Quotation terhubung</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded bg-slate-50 px-2 py-0.5">• Tanpa Quotation</span>
                    )}
                    {paid ? (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-emerald-700">✓ Lunas</span>
                    ) : hasAnyPayment ? (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-amber-700">• Pembayaran berjalan</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded bg-slate-50 px-2 py-0.5">• Belum ada pembayaran</span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          const payload = {
                            recvName: order?.customer?.pic || "",
                            recvAddress: order?.customer?.address || "",
                            recvPhone: order?.customer?.phone || "",
                          };
                          localStorage.setItem("sjOpen", JSON.stringify(payload));
                        } catch {}
                        window.open("/penjualan/surat-jalan/add", "_blank");
                      }}
                      className="ml-auto inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-200"
                    >
                      Buat Surat Jalan
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            <button
              onClick={() => setSendOpen(true)}
              className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-blue-700"
            >
              <Send className="h-4 w-4" />
              Kirim
            </button>
            {/* Dropdown Tindakan: gabungkan Buat/Ubah Invoice */}
            <div className="relative inline-block text-left">
              <button
                onClick={() => setActionOpen((v) => !v)}
                disabled={creatingInvoice}
                className="inline-flex items-center gap-2 rounded-full bg-green-600 px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Tindakan
                <ChevronDown className="h-4 w-4" />
              </button>
              {actionOpen && (
                <div className="absolute right-0 z-20 mt-2 w-56 rounded-md border border-slate-200 bg-white p-1 shadow-lg">
                  <button
                    onClick={() => {
                      setActionOpen(false);
                      handleCreateInvoice();
                    }}
                    className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                  >
                    {creatingInvoice ? (
                      <svg
                        className="h-4 w-4 animate-spin"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                    ) : (
                      <PlusCircle className="h-4 w-4" />
                    )}
                    <span>Buat Invoice</span>
                  </button>
                  <button
                    onClick={() => {
                      setActionOpen(false);
                      router.push(`/penjualan/order-penjualan/edit/${order.id}?from=detail`);
                    }}
                    className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                  >
                    <Pencil className="h-4 w-4" />
                    <span>Edit SO</span>
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={handleDelete}
              className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-red-700"
            >
              <Trash2 className="h-4 w-4" />
              Hapus
            </button>
            <Link
              href="/penjualan/order-penjualan"
              className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
            >
              <ArrowLeft className="h-4 w-4" />
              Kembali
            </Link>
            <Link
              href={`/finance/payment?type=IN&refType=SALES_ORDER&refId=${id}`}
              className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-blue-700"
            >
              Tambah Pembayaran
            </Link>
          </div>
        </div>
        <div className="mt-4">
          <div className="rounded border bg-white p-4">
            <div className="mb-2 text-sm font-semibold">Pembayaran & Kwitansi</div>
            {loadingPayments ? (
              <div className="text-sm text-gray-500">Memuat...</div>
            ) : payments.length === 0 ? (
              <div className="text-sm text-gray-500">Belum ada pembayaran</div>
            ) : (
              <div className="space-y-1">
                {payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <div>
                      {new Date(p.paidAt).toLocaleString("id-ID")} • {p.method} • {p.type} • Rp{Number(p.amount).toLocaleString("id-ID")}
                    </div>
                    <div>
                      {p.receipt ? (
                        <a className="text-blue-600 underline" href={`/api/receipts/${p.receipt.id}/pdf`} target="_blank" rel="noreferrer">{p.receipt.receiptNumber}</a>
                      ) : (
                        <span className="text-gray-500">Tanpa kwitansi</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="mt-8 flex justify-center">
          <div
            className="w-full max-w-[820px] overflow-hidden rounded-xl border bg-white shadow"
            style={{ borderColor: `${currentTheme.tableBorderColor}55` }}
          >
            <div
              className="space-y-10 px-10 py-10 text-sm leading-relaxed"
              style={{ color: currentTheme.headerTextColor }}
            >
              <header className="flex flex-wrap items-start justify-between gap-6">
                <div className="flex flex-1 items-start gap-3">
                  <div className="flex flex-col items-start">
                    {brand?.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={brand.logoUrl}
                        alt={brand.name ?? "Brand logo"}
                        className="h-16 w-auto object-contain"
                      />
                    ) : (
                      <div
                        className="flex h-16 w-24 items-center justify-center rounded bg-slate-100 text-xs font-semibold uppercase"
                        style={{
                          backgroundColor: currentTheme.secondaryColor,
                          color: currentTheme.mutedText,
                        }}
                      >
                        Logo
                      </div>
                    )}
                    {brandContactLines.length > 0 && (
                      <div
                        className="mt-2 space-y-0.5 text-xs"
                        style={{ color: currentTheme.mutedText }}
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
                        style={{ color: currentTheme.primaryColor }}
                      >
                        {brand.name}
                      </h2>
                    )}
                    {brand?.showBrandDescription !== false && brand?.overview && (
                      <p
                        className="mt-1 text-sm"
                        style={{ color: currentTheme.mutedText }}
                      >
                        {brand.overview}
                      </p>
                    )}
                  </div>
                </div>

                <div className="min-w-[220px] text-right">
                  <div
                    className="text-[28px] font-extrabold tracking-tight"
                    style={{ color: currentTheme.primaryColor }}
                  >
                    SALES ORDER
                  </div>
                  <div
                    className="mt-5 space-y-3 text-xs"
                    style={{ color: currentTheme.mutedText }}
                  >
                    <div className="flex justify-between gap-6">
                      <span>Number</span>
                      <span
                        className="text-sm font-semibold"
                        style={{ color: currentTheme.headerTextColor }}
                      >
                        {order.orderNumber || `SO-${order.id}`}
                      </span>
                    </div>
                    <div className="flex justify-between gap-6">
                      <span>Date</span>
                      <span
                        className="text-sm font-semibold"
                        style={{ color: currentTheme.headerTextColor }}
                      >
                        {formatDate(order.date)}
                      </span>
                    </div>
                    {order.status && (
                      <div className="flex justify-between gap-6">
                        <span>Status</span>
                        <span
                          className="text-sm font-semibold"
                          style={{ color: currentTheme.headerTextColor }}
                        >
                          {order.status}
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
                    style={{ color: currentTheme.headerAccentColor }}
                  >
                    From
                  </div>
                  <div
                    className="mt-2 h-0.5 w-10 rounded-full"
                    style={{ backgroundColor: currentTheme.tableBorderColor }}
                  />
                  <div className="mt-4 space-y-1.5 text-sm">
                    <div
                      className="font-semibold"
                      style={{ color: currentTheme.headerTextColor }}
                    >
                      {actorHeading}
                    </div>
                    {actorContactLines.map((line) => (
                      <div key={line} style={{ color: currentTheme.mutedText }}>
                        {line}
                      </div>
                    ))}
                    {brand?.showBrandAddress !== false && brand?.address && (
                      <div
                        className="whitespace-pre-line text-xs"
                        style={{ color: currentTheme.mutedText }}
                      >
                        {brand.address}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <div
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color: currentTheme.headerAccentColor }}
                  >
                    Bill To
                  </div>
                  <div
                    className="mt-2 h-0.5 w-10 rounded-full"
                    style={{ backgroundColor: currentTheme.tableBorderColor }}
                  />
                  <div className="mt-4 space-y-1.5 text-sm">
                    <div
                      className="font-semibold"
                      style={{ color: currentTheme.headerTextColor }}
                    >
                      {customerHeading}
                    </div>
                    {order.customer?.address && (
                      <div
                        className="whitespace-pre-line text-xs"
                        style={{ color: currentTheme.mutedText }}
                      >
                        {order.customer.address}
                      </div>
                    )}
                    {[order.customer?.email, order.customer?.phone]
                      .filter((value): value is string => Boolean(value))
                      .map((value) => (
                        <div key={value} style={{ color: currentTheme.mutedText }}>
                          {value}
                        </div>
                      ))}
                  </div>
                </div>
              </section>

              {projectLines.length > 0 && (
                <section className="space-y-3">
                  <div
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color: currentTheme.headerAccentColor }}
                  >
                    Project Overview
                  </div>
                  <ul
                    className="space-y-1 text-sm"
                    style={{ color: currentTheme.mutedText }}
                  >
                    {projectLines.map((line, idx) => (
                      <li key={`${line}-${idx}`}>- {line}</li>
                    ))}
                  </ul>
                </section>
              )}

              <section className="space-y-4">
                <div
                  className="text-xs font-semibold uppercase tracking-wide"
                  style={{ color: currentTheme.headerAccentColor }}
                >
                  Itemised Summary
                </div>
                <div
                  className="overflow-hidden rounded-lg border"
                  style={{ borderColor: currentTheme.tableBorderColor }}
                >
                  <table className="w-full border-collapse text-sm">
                    <colgroup>
                      {columnDefinitions.map((col) => (
                        <col key={col.key} style={{ width: `${col.width * 100}%` }} />
                      ))}
                    </colgroup>
                    <thead>
                      <tr
                        style={{
                          backgroundColor: currentTheme.totalBackground,
                          color: "#FFFFFF",
                        }}
                      >
                        {columnDefinitions.map((col) => (
                          <th
                            key={col.key}
                            className={`px-4 py-3 text-xs uppercase tracking-wide ${
                              col.align === "right"
                                ? "text-right"
                                : col.align === "center"
                                ? "text-center"
                                : "text-left"
                            }`}
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {order.items?.map((item: any, index: number) => {
                        const quantity = normalizeNumber(item.quantity);
                        const price = normalizeNumber(item.price);
                        const lineAmount = normalizeNumber(
                          item.subtotal || quantity * price
                        );
                        const background =
                          index % 2 === 0
                            ? currentTheme.zebraRowColor
                            : "#FFFFFF";

                        return (
                          <tr
                            key={item.id ?? `${item.product}-${index}`}
                            style={{
                              backgroundColor: background,
                              borderBottom: `1px solid ${currentTheme.tableBorderColor}`,
                            }}
                          >
                            {columnDefinitions.map((column) => {
                              if (column.key === "description") {
                                return (
                                  <td key={column.key} className="px-4 py-4 align-top">
                                    <div
                                      className="text-sm font-semibold text-slate-900"
                                      style={{ color: currentTheme.headerTextColor }}
                                    >
                                      {item.product || "-"}
                                    </div>
                                    {item.description && (
                                      <p
                                        className="mt-2 text-xs leading-relaxed text-slate-600"
                                        style={{ color: currentTheme.mutedText }}
                                      >
                                        {item.description}
                                      </p>
                                    )}
                                  </td>
                                );
                              }

                              if (column.key === "image") {
                                return (
                                  <td key={column.key} className="px-4 py-4 text-center align-top">
                                    {item.imageUrl ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        src={item.imageUrl}
                                        alt={item.product || "Item image"}
                                        className="mx-auto h-16 w-16 rounded object-cover"
                                      />
                                    ) : (
                                      <div
                                        className="mx-auto flex h-16 w-16 items-center justify-center rounded border text-xs text-slate-400"
                                        style={{ borderColor: currentTheme.tableBorderColor }}
                                      >
                                        No Img
                                      </div>
                                    )}
                                  </td>
                                );
                              }

                              if (column.key === "qty") {
                                return (
                                  <td key={column.key} className="px-4 py-4 text-center align-middle">
                                    {quantity.toLocaleString("id-ID")}
                                  </td>
                                );
                              }

                              if (column.key === "unit") {
                                return (
                                  <td key={column.key} className="px-4 py-4 text-center align-middle">
                                    {item.unit || "-"}
                                  </td>
                                );
                              }

                              if (column.key === "price") {
                                return (
                                  <td key={column.key} className="px-4 py-4 text-right align-middle">
                                    {formatCurrency(price)}
                                  </td>
                                );
                              }

                              if (column.key === "amount") {
                                return (
                                  <td
                                    key={column.key}
                                    className="px-4 py-4 text-right align-middle font-semibold"
                                    style={{ color: currentTheme.headerTextColor }}
                                  >
                                    {formatCurrency(lineAmount)}
                                  </td>
                                );
                              }

                              return null;
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
              <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(240px,1fr)]">
                <div className="space-y-6">
                  <div>
                    <div
                      className="text-xs font-semibold uppercase tracking-wide"
                      style={{ color: currentTheme.headerAccentColor }}
                    >
                      Notes
                    </div>
                    <div
                      className="mt-3 space-y-2 text-sm"
                      style={{ color: currentTheme.mutedText }}
                    >
                      {notesLines.length ? (
                        notesLines.map((line, idx) => (
                          <div key={`${line}-${idx}`}>{line}</div>
                        ))
                      ) : (
                        <div className="italic text-slate-400">
                          Tidak ada catatan tambahan.
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <div
                      className="text-xs font-semibold uppercase tracking-wide"
                      style={{ color: currentTheme.headerAccentColor }}
                    >
                      Payment Info
                    </div>
                    <div
                      className="mt-3 space-y-2 text-sm"
                      style={{ color: currentTheme.mutedText }}
                    >
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
                      style={{ color: currentTheme.headerAccentColor }}
                    >
                      Terms &amp; Conditions
                    </div>
                    <div
                      className="mt-3 space-y-2 text-sm"
                      style={{ color: currentTheme.mutedText }}
                    >
                      {(thankYouAndTerms.terms ?? DEFAULT_TERMS).map(
                        (line, idx) => (
                          <div key={`${line}-${idx}`}>- {line}</div>
                        )
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <div
                    className="rounded-2xl p-6 text-right shadow-sm"
                    style={{
                      backgroundColor: currentTheme.totalBackground,
                      color: currentTheme.totalTextColor,
                    }}
                  >
                    <div className="text-xs font-semibold uppercase tracking-wide">
                      Total Due
                    </div>
                    <div className="mt-3 text-3xl font-bold">
                      {formatCurrency(totalAmount)}
                    </div>
                    {thankYouAndTerms.message && (
                      <div className="mt-4 text-xs">
                        {thankYouAndTerms.message}
                      </div>
                    )}
                  </div>

                  <div
                    className="mt-4 space-y-2 rounded-xl border px-5 py-4 text-sm text-slate-600"
                    style={{
                      borderColor: `${currentTheme.tableBorderColor}55`,
                    }}
                  >
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span>{formatCurrency(subtotal)}</span>
                    </div>
                    {lineDiscount > 0 && (
                      <div className="flex justify-between">
                        <span>Line Discount</span>
                        <span>-{formatCurrency(lineDiscount)}</span>
                      </div>
                    )}
                    {extraDiscount > 0 && (
                      <div className="flex justify-between">
                        <span>Additional Discount</span>
                        <span>-{formatCurrency(extraDiscount)}</span>
                      </div>
                    )}
                    {taxAmount > 0 && (
                      <div className="flex justify-between">
                        <span>Tax</span>
                        <span>{formatCurrency(taxAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t pt-3 font-semibold text-slate-900">
                      <span>Total</span>
                      <span>{formatCurrency(totalAmount)}</span>
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <div
                  className="text-xs font-semibold uppercase tracking-wide"
                  style={{ color: currentTheme.headerAccentColor }}
                >
                  Signature
                </div>
                <div
                  className="rounded-xl border px-6 py-8 text-center"
                  style={{ borderColor: `${currentTheme.tableBorderColor}88` }}
                >
                  <div
                    className="text-sm font-semibold"
                    style={{ color: currentTheme.headerTextColor }}
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
        </div>
        <div className="mx-auto mt-6 flex max-w-[820px] flex-col gap-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {order.projectFile ? (
              <a
                href={`/uploads/${order.projectFile}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border px-4 py-2 transition hover:bg-slate-50"
              >
                <Paperclip className="h-4 w-4" />
                Lihat Lampiran
              </a>
            ) : (
              <span className="italic text-slate-400">
                Tidak ada lampiran
              </span>
            )}
          </div>
          <div className="text-right text-sm text-slate-500">
            {brandLoading || actorLoading ? "Memuat informasi brand..." : ""}
          </div>
        </div>

        {/* Modal Kirim Sales Order */}
        {sendOpen && order && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b px-6 py-4">
                <h2 className="text-lg font-semibold">Kirim Sales Order</h2>
                <button
                  onClick={() => {
                    setSendOpen(false);
                    setSendMethod("email");
                  }}
                  className="text-xl text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>

              <div className="grid grid-cols-1 divide-y md:grid-cols-2 md:divide-y-0 md:divide-x">
                <div className="space-y-3 p-6">
                  <p className="mb-2 font-medium text-gray-800">Pilih metode</p>
                  <label
                    onClick={() => setSendMethod("wa")}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition ${
                      sendMethod === "wa"
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" />
                    <span>WhatsApp</span>
                  </label>
                  <label
                    onClick={() => setSendMethod("email")}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition ${
                      sendMethod === "email"
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" />
                    <span>Email</span>
                  </label>
                  <label
                    onClick={() => setSendMethod("pdf")}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition ${
                      sendMethod === "pdf"
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-gray-500" />
                    <span>Simpan sebagai PDF</span>
                  </label>
                </div>

                <div className="p-6">
                  <p className="mb-2 font-medium text-gray-800">Preview Pesan</p>
                  <textarea
                    readOnly
                    className="h-56 w-full resize-none rounded-lg border border-gray-300 p-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={
                      `Hi ${order.customer?.pic || "Customer"},\n` +
                      `Anda telah menerima Sales Order:\n` +
                      `No: ${order.orderNumber}\n` +
                      `Tanggal: ${formatDate(order.date)}\n` +
                      `Total: ${formatCurrency(totalAmount)}\n\n` +
                      `Untuk info lebih lanjut hubungi kami.\nTerima kasih.`
                    }
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t px-6 py-4">
                <button
                  onClick={() => {
                    setSendOpen(false);
                    setSendMethod("email");
                  }}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
                >
                  Batal
                </button>
                <button
                  onClick={handleSend}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  {sendMethod === "wa"
                    ? "Kirim via WhatsApp"
                    : sendMethod === "email"
                    ? "Kirim via Email"
                    : "Simpan PDF"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </FeatureGuard>
  );
}


