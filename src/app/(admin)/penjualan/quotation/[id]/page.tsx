"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Edit, Copy, Send, X, ArrowLeft } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import toast from "react-hot-toast";
import { resolveTheme, resolveThankYou, resolvePaymentLines, DEFAULT_TERMS } from "@/lib/quotationTheme";


type SendMethod = "whatsapp" | "email" | "savepdf";

export default function QuotationDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [quotation, setQuotation] = useState<any>({ items: [] });
  const [loading, setLoading] = useState(true);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [method, setMethod] = useState<SendMethod>("whatsapp");

  // Brand & Actor (untuk menyamakan tampilan dengan Sales Order)
  const [brand, setBrand] = useState<any | null>(null);
  const [brandLoading, setBrandLoading] = useState(true);
  const [actor, setActor] = useState<any | null>(null);
  const [actorLoading, setActorLoading] = useState(true);

  const [options, setOptions] = useState({
    showImage: true,
    showDescription: true,
    showProjectDesc: true,
    showSignature: true,
  });

  const toggleOption = (key: keyof typeof options) => {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    fetchDetail();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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

  // ========================
  // FETCH DATA
  // ========================
  const fetchDetail = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/quotations/${id}`, { cache: "no-store" });
      const json = await res.json();
      
      if (json.success) {
        // Menggunakan data asli dari API yang sudah ditransformasi
        setQuotation(json.data); 
      }
      else toast.error("Gagal memuat detail quotation.");
    } catch (error) {
      toast.error("Terjadi kesalahan saat memuat data.");
    } finally {
      setLoading(false);
    }
  };


  // ========================
  // ACTION HANDLER (Menggunakan Toast Interaktif untuk Konfirmasi)
  // ========================
  const handleAction = async (action: "convertToSO" | "edit") => {
  if (action === "edit") {
    router.push(`/penjualan/quotation/edit/${id}`);
    return;
  }

  if (action === "convertToSO") {
    toast(
      (t) => (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium">
            Yakin ingin <b>Salin ke Sales Order</b> dan mengubah status quotation menjadi <b>Confirmed</b>?
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => toast.dismiss(t.id)}
              className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100"
            >
              Batal
            </button>
            <button
              onClick={async () => {
                toast.dismiss(t.id);
                await toast.promise(
                  fetch(`/api/quotations/${id}/convert-to-so`, {
                    method: "POST",
                  }).then(async (res) => {
                    if (!res.ok) {
                      const errorText = await res.text();
                      throw new Error(errorText || "Gagal salin.");
                    }
                    await fetchDetail(); // refresh detail halaman ini
                    router.refresh();   // refresh list di halaman utama
                  }),
                  {
                    loading: "Menyalin ke Sales Order...",
                    success: "Berhasil disalin dan status quotation menjadi Confirmed.",
                    error: "Gagal menyalin ke Sales Order.",
                  }
                );
              }}
              className="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700"
            >
              Ya, Lanjutkan
            </button>
          </div>
        </div>
      ),
      { duration: 10000, position: "bottom-center" }
    );
  }
};



  // ========================
  // FORMAT DATA
  // ========================
  const currentTheme = useMemo(() => {
    const templateId = (brand?.templateDefaults?.invoice as string | undefined) ?? undefined;
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

  const paymentLines = useMemo(() => resolvePaymentLines(brand ?? {}), [brand]);

  const brandContactLines = useMemo(() => {
    if (!brand) return [] as string[];
    const lines: Array<string | undefined> = [];
    if (brand.showBrandEmail !== false && brand.email) lines.push(brand.email);
    if (brand.showBrandWebsite !== false && brand.website) lines.push(brand.website);
    if (brand.showBrandAddress !== false && brand.address) lines.push(brand.address);
    return lines.filter((v): v is string => Boolean(v));
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
    () => [actor?.email, actor?.phone].filter((v): v is string => Boolean(v)),
    [actor?.email, actor?.phone]
  );

  const customerHeading = useMemo(() => {
    if (!quotation?.customer) return "Customer";
    const parts = [quotation.customer.pic, quotation.customer.company]
      .filter(Boolean)
      .filter((value, index, array) => array.indexOf(value) === index);
    return parts.length ? parts.join(" | ") : "Customer";
  }, [quotation?.customer]);

  const total = useMemo(
    () =>
      quotation.items?.reduce(
        (acc: number, item: any) => acc + item.price * item.quantity,
        0
      ) ?? 0,
    [quotation.items]
  );

  const formattedDate = useMemo(
    () =>
      quotation?.date
        ? new Date(quotation.date).toLocaleDateString("id-ID", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })
        : "",
    [quotation?.date]
  );

  const message = useMemo(
    () =>
      `Hi ${quotation.customer?.pic ?? ""},
${quotation.customer?.company ?? ""} telah menerima Quotation:
No: ${quotation.quotationNumber}
Tanggal: ${formattedDate}
Total: Rp${total.toLocaleString("id-ID")}

Untuk info lebih lanjut hubungi kami.
Terima kasih.`,
    [quotation, total, formattedDate]
  );

  if (loading) return <div className="p-6 text-center">Loading...</div>;

  // ========================
// PDF GENERATOR (revisi nama file)
// ========================
const generatePDF = async (): Promise<string> => {
  const el = document.getElementById("quotation-pdf");
  if (!el) return "";

  const canvas = await html2canvas(el, { scale: 2 });
  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF("p", "mm", "a4");

  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
  pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);

  // Buat nama file dari nomor Quotation dan PIC
  const safePicName = (quotation.customer?.pic || "Customer")
    .replace(/\s+/g, "_")          // spasi jadi underscore
    .replace(/[^a-zA-Z0-9-_]/g, ""); // hapus karakter aneh

  const fileName = `${quotation.quotationNumber || "Quotation"} - ${safePicName}.pdf`;

  pdf.save(fileName);
  return fileName;
};


  // ========================
  // HANDLE KIRIM
  // ========================
  const handleSend = async () => {
    if (method === "savepdf") {
      await generatePDF();
      toast.success("File PDF berhasil diunduh.");
      setIsSendModalOpen(false);
      return;
    }

    if (method === "whatsapp") {
      await generatePDF(); // sementara: hanya simpan file
      const phone = quotation.customer?.phone?.replace(/^0/, "62") || "";
      const encoded = encodeURIComponent(
        `${message}\n\n(Lampiran PDF telah disimpan di perangkat Anda. Lampirkan secara manual ke chat ini.)`
      );
      const waLink = `https://wa.me/${phone}?text=${encoded}`;
      window.open(waLink, "_blank");
      toast.success("Mengarahkan ke WhatsApp.");
      setIsSendModalOpen(false);
      return;
    }

    if (method === "email") {
      await generatePDF(); // sementara: hanya simpan file
      const email = quotation.customer?.email || "";
      const subject = encodeURIComponent(
        `Quotation ${quotation.quotationNumber || ""}`
      );
      const body = encodeURIComponent(
        `${message}\n\n(Lampiran PDF telah disimpan di perangkat Anda. Lampirkan secara manual ke email ini.)`
      );
      window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
      toast.success("Mengarahkan ke Email.");
      setIsSendModalOpen(false);
      return;
    }
  };
  

  // ========================
  // UI COMPONENT
  // ========================
  return (
    <div className="px-6 py-6 sm:px-10">
      {/* Breadcrumb */}
      <PageBreadcrumb pageTitle="Lihat Quotation" />
  
      <div className="mt-6 rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-white to-slate-50 px-6 py-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-8">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Total
              </div>
              <div className="text-xl font-bold text-slate-900">
                {total.toLocaleString("id-ID", { style: "currency", currency: "IDR" })}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Number
              </div>
              <div className="text-sm font-semibold text-slate-900">
                {quotation.quotationNumber || `QUO-${quotation.id}`}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Date
              </div>
              <div className="text-sm font-semibold text-slate-900">
                {formattedDate || "-"}
              </div>
            </div>
          </div>
          <div className="text-left md:text-right">
            <span className="inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide bg-slate-100 text-slate-700">
              {quotation.status || "Draft"}
            </span>
          </div>
        </div>
  
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          <button
            onClick={() => setIsSendModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-blue-700"
          >
            <Send className="h-4 w-4" />
            Kirim
          </button>
          <button
            onClick={() => handleAction("convertToSO")}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-emerald-700"
          >
            <Copy className="h-4 w-4" />
            Salin ke Sales Order
          </button>
          <Link
            href={`/penjualan/quotation/edit/${id}`}
            className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-amber-600"
          >
            <Edit className="h-4 w-4" />
            Ubah
          </Link>
          <Link
            href="/penjualan/quotation"
            className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali
          </Link>
        </div>
      </div>
  
      {/* ====== A4 Card Preview (disamakan dengan Sales Order) ====== */}
      <div className="mt-8 flex justify-center">
        <div
          id="quotation-pdf"
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
                    <img src={brand.logoUrl} alt={brand.name ?? "Brand logo"} className="h-16 w-auto object-contain" />
                  ) : (
                    <div
                      className="flex h-16 w-24 items-center justify-center rounded bg-slate-100 text-xs font-semibold uppercase"
                      style={{ backgroundColor: currentTheme.secondaryColor, color: currentTheme.mutedText }}
                    >
                      Logo
                    </div>
                  )}
                  {brandContactLines.length > 0 && (
                    <div className="mt-2 space-y-0.5 text-xs" style={{ color: currentTheme.mutedText }}>
                      {brandContactLines.map((line) => (
                        <div key={line}>{line}</div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  {brand?.showBrandName !== false && brand?.name && (
                    <h2 className="text-2xl font-semibold leading-tight" style={{ color: currentTheme.primaryColor }}>
                      {brand.name}
                    </h2>
                  )}
                  {brand?.showBrandDescription !== false && brand?.overview && (
                    <p className="mt-1 text-sm" style={{ color: currentTheme.mutedText }}>
                      {brand.overview}
                    </p>
                  )}
                </div>
              </div>

              <div className="min-w-[220px] text-right">
                <div className="text-[28px] font-extrabold tracking-tight" style={{ color: currentTheme.primaryColor }}>
                  QUOTATION
                </div>
                <div className="mt-5 space-y-3 text-xs" style={{ color: currentTheme.mutedText }}>
                  <div className="flex justify-between gap-6">
                    <span>Number</span>
                    <span className="text-sm font-semibold" style={{ color: currentTheme.headerTextColor }}>
                      {quotation.quotationNumber || `QUO-${quotation.id}`}
                    </span>
                  </div>
                  <div className="flex justify-between gap-6">
                    <span>Date</span>
                    <span className="text-sm font-semibold" style={{ color: currentTheme.headerTextColor }}>
                      {formattedDate}
                    </span>
                  </div>
                  {quotation.status && (
                    <div className="flex justify-between gap-6">
                      <span>Status</span>
                      <span className="text-sm font-semibold" style={{ color: currentTheme.headerTextColor }}>
                        {quotation.status}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </header>

            <section className="grid gap-8 md:grid-cols-2">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: currentTheme.headerAccentColor }}>
                  From
                </div>
                <div className="mt-2 h-0.5 w-10 rounded-full" style={{ backgroundColor: currentTheme.tableBorderColor }} />
                <div className="mt-4 space-y-1.5 text-sm">
                  <div className="font-semibold" style={{ color: currentTheme.headerTextColor }}>
                    {actorHeading}
                  </div>
                  {actorContactLines.map((line) => (
                    <div key={line} style={{ color: currentTheme.mutedText }}>
                      {line}
                    </div>
                  ))}
                  {brand?.showBrandAddress !== false && brand?.address && (
                    <div className="whitespace-pre-line text-xs" style={{ color: currentTheme.mutedText }}>
                      {brand.address}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: currentTheme.headerAccentColor }}>
                  Bill To
                </div>
                <div className="mt-2 h-0.5 w-10 rounded-full" style={{ backgroundColor: currentTheme.tableBorderColor }} />
                <div className="mt-4 space-y-1.5 text-sm">
                  <div className="font-semibold" style={{ color: currentTheme.headerTextColor }}>
                    {customerHeading}
                  </div>
                  {quotation.customer?.address && (
                    <div className="whitespace-pre-line text-xs" style={{ color: currentTheme.mutedText }}>
                      {quotation.customer.address}
                    </div>
                  )}
                  {[quotation.customer?.email, quotation.customer?.phone]
                    .filter((value): value is string => Boolean(value))
                    .map((value) => (
                      <div key={value} style={{ color: currentTheme.mutedText }}>
                        {value}
                      </div>
                    ))}
                </div>
              </div>
            </section>

            {quotation.projectDesc && options.showProjectDesc && (
              <section className="space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: currentTheme.headerAccentColor }}>
                  Project Overview
                </div>
                <ul className="space-y-1 text-sm" style={{ color: currentTheme.mutedText }}>
                  {String(quotation.projectDesc)
                    .split(/\r?\n/)
                    .map((line, idx) => (
                      <li key={`${line}-${idx}`}>- {line.trim()}</li>
                    ))}
                </ul>
              </section>
            )}

            <section className="space-y-4">
              <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: currentTheme.headerAccentColor }}>
                Itemised Summary
              </div>
              <div className="overflow-hidden rounded-lg border" style={{ borderColor: currentTheme.tableBorderColor }}>
                <table className="w-full border-collapse text-sm">
                  <colgroup>
                    {/* Kolom mengikuti pola Sales Order; gambar opsional tergantung opsi */}
                    <col style={{ width: options.showImage ? "34%" : "50%" }} />
                    {options.showImage && <col style={{ width: "16%" }} />}
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: options.showImage ? "14%" : "12%" }} />
                    <col style={{ width: options.showImage ? "14%" : "12%" }} />
                  </colgroup>
                  <thead>
                    <tr style={{ backgroundColor: currentTheme.totalBackground, color: "#FFFFFF" }}>
                      <th className="px-4 py-3 text-left text-xs uppercase tracking-wide">Description</th>
                      {options.showImage && (
                        <th className="px-4 py-3 text-center text-xs uppercase tracking-wide">Image</th>
                      )}
                      <th className="px-4 py-3 text-center text-xs uppercase tracking-wide">Qty</th>
                      <th className="px-4 py-3 text-center text-xs uppercase tracking-wide">Unit</th>
                      <th className="px-4 py-3 text-right text-xs uppercase tracking-wide">Price</th>
                      <th className="px-4 py-3 text-right text-xs uppercase tracking-wide">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotation.items?.map((item: any, index: number) => {
                      const quantity = Number(item.quantity) || 0;
                      const price = Number(item.price) || 0;
                      const lineAmount = Number(item.subtotal || quantity * price) || 0;
                      const background = index % 2 === 0 ? currentTheme.zebraRowColor : "#FFFFFF";
                      return (
                        <tr key={item.id ?? `${item.product}-${index}`} style={{ backgroundColor: background, borderBottom: `1px solid ${currentTheme.tableBorderColor}` }}>
                          <td className="px-4 py-4 align-top">
                            <div className="text-sm font-semibold" style={{ color: currentTheme.headerTextColor }}>
                              {item.product || "-"}
                            </div>
                            {options.showDescription && item.description && (
                              <p className="mt-2 text-xs leading-relaxed" style={{ color: currentTheme.mutedText }}>
                                {item.description}
                              </p>
                            )}
                          </td>
                          {options.showImage && (
                            <td className="px-4 py-4 text-center align-top">
                              {item.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={item.imageUrl}
                                  alt={item.product || "Item image"}
                                  className="mx-auto h-16 w-16 rounded object-cover"
                                  onError={(e) => {
                                    const img = e.currentTarget as HTMLImageElement;
                                    img.onerror = null;
                                    img.src = "/no-image.svg";
                                  }}
                                />
                              ) : (
                                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded border text-xs text-slate-400" style={{ borderColor: currentTheme.tableBorderColor }}>
                                  No Img
                                </div>
                              )}
                            </td>
                          )}
                          <td className="px-4 py-4 text-center align-middle">{quantity.toLocaleString("id-ID")}</td>
                          <td className="px-4 py-4 text-center align-middle">{item.unit || "-"}</td>
                          <td className="px-4 py-4 text-right align-middle">{`Rp ${price.toLocaleString("id-ID")}`}</td>
                          <td className="px-4 py-4 text-right align-middle font-semibold" style={{ color: currentTheme.headerTextColor }}>
                            {`Rp ${lineAmount.toLocaleString("id-ID")}`}
                          </td>
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
                  <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: currentTheme.headerAccentColor }}>
                    Notes
                  </div>
                  <div className="mt-3 space-y-2 text-sm" style={{ color: currentTheme.mutedText }}>
                    {quotation.notes ? (
                      String(quotation.notes)
                        .split(/\r?\n/)
                        .map((line, idx) => <div key={`${line}-${idx}`}>{line.trim()}</div>)
                    ) : (
                      <div className="italic text-slate-400">Tidak ada catatan tambahan.</div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: currentTheme.headerAccentColor }}>
                    Payment Info
                  </div>
                  <div className="mt-3 space-y-2 text-sm" style={{ color: currentTheme.mutedText }}>
                    {paymentLines.length ? (
                      paymentLines.map((line, idx) => <div key={`${line}-${idx}`}>{line}</div>)
                    ) : (
                      <div className="italic text-slate-400">Silakan hubungi kami untuk informasi pembayaran.</div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: currentTheme.headerAccentColor }}>
                    Terms &amp; Conditions
                  </div>
                  <div className="mt-3 space-y-2 text-sm" style={{ color: currentTheme.mutedText }}>
                    {(thankYouAndTerms.terms ?? DEFAULT_TERMS).map((line: string, idx: number) => (
                      <div key={`${line}-${idx}`}>- {line}</div>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <div
                  className="rounded-2xl p-6 text-right shadow-sm"
                  style={{ backgroundColor: currentTheme.totalBackground, color: currentTheme.totalTextColor }}
                >
                  <div className="text-xs font-semibold uppercase tracking-wide">Total Due</div>
                  <div className="mt-3 text-3xl font-bold">{`Rp ${total.toLocaleString("id-ID")}`}</div>
                  {thankYouAndTerms.message && <div className="mt-4 text-xs">{thankYouAndTerms.message}</div>}
                </div>

                <div className="mt-4 space-y-2 rounded-xl border px-5 py-4 text-sm text-slate-600" style={{ borderColor: `${currentTheme.tableBorderColor}55` }}>
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{`Rp ${total.toLocaleString("id-ID")}`}</span>
                  </div>
                  <div className="flex justify-between border-t pt-3 font-semibold text-slate-900">
                    <span>Total</span>
                    <span>{`Rp ${total.toLocaleString("id-ID")}`}</span>
                  </div>
                </div>
              </div>
            </section>

            {options.showSignature && (
              <section className="space-y-4">
                <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: currentTheme.headerAccentColor }}>
                  Signature
                </div>
                <div className="rounded-xl border px-6 py-8 text-center" style={{ borderColor: `${currentTheme.tableBorderColor}88` }}>
                  <div className="text-sm font-semibold" style={{ color: currentTheme.headerTextColor }}>
                    {actorHeading || brand?.name || "Authorized"}
                  </div>
                  <div className="mt-6 text-xs text-slate-400">(Tanda tangan dan stempel jika diperlukan)</div>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>

        {/* ===== Modal Kirim (Dibiarkan sama) ===== */}
        {isSendModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="relative flex w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-lg md:flex-row">
              {/* Left */}
              <div className="space-y-3 border-r p-6 md:w-1/3">
                <h2 className="mb-2 text-lg font-semibold">Pilih metode</h2>

                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    checked={method === "whatsapp"}
                    onChange={() => setMethod("whatsapp")}
                  />
                  WhatsApp
                </label>

                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    checked={method === "email"}
                    onChange={() => setMethod("email")}
                  />
                  Email
                </label>

                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    checked={method === "savepdf"}
                    onChange={() => setMethod("savepdf")}
                  />
                  Simpan sebagai PDF
                </label>
              </div>

              {/* Right */}
              <div className="relative p-6 md:w-2/3">
                <button
                  onClick={() => setIsSendModalOpen(false)}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                >
                  <X size={20} />
                </button>

                <h3 className="mb-2 font-semibold">
                  {method === "savepdf" ? "Pratinjau Dokumen" : "Preview Pesan"}
                </h3>

                {method === "savepdf" ? (
                  <div className="text-sm text-gray-600">
                    PDF akan dibuat dari tampilan dokumen di bawah ini (A4). Klik{" "}
                    <span className="font-semibold">"Simpan PDF"</span> untuk
                    mengunduh, lalu lampirkan secara manual bila mengirim lewat
                    WA/Email.
                  </div>
                ) : (
                  <div className="min-h-[200px] whitespace-pre-line rounded-lg border bg-gray-50 p-4 text-sm">
                    {message}
                  </div>
                )}
                {/* Kontrol tampilan PDF */}
                <div className="space-y-2 border-t pt-3 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={options.showImage}
                      onChange={() => toggleOption("showImage")}
                    />
                    Tampilkan Gambar
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={options.showDescription}
                      onChange={() => toggleOption("showDescription")}
                    />
                    Tampilkan Deskripsi
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={options.showProjectDesc}
                      onChange={() => toggleOption("showProjectDesc")}
                    />
                    Tampilkan Project Description
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={options.showSignature}
                      onChange={() => toggleOption("showSignature")}
                    />
                    Tampilkan Tanda Tangan
                  </label>
                </div>

                <div className="mt-4 flex justify-end gap-3">
                  <button
                    onClick={() => setIsSendModalOpen(false)}
                    className="rounded border border-gray-300 px-4 py-2 hover:bg-gray-100"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleSend}
                    className="rounded bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
                  >
                    {method === "savepdf"
                      ? "Simpan PDF"
                      : method === "whatsapp"
                      ? "Kirim via WhatsApp"
                      : "Kirim via Email"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}


