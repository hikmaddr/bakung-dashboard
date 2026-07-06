"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useGlobal } from "@/context/AppContext";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Edit, Copy, Send, X, ArrowLeft, MessageCircle } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import toast from "react-hot-toast";
import { resolveTheme, resolveThankYou, resolvePaymentLines, DEFAULT_TERMS } from "@/lib/quotationTheme";
import { formatDownloadFileName } from "@/utils/downloadFilename";

const normalizeWhatsappPhone = (value?: string | null) => {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  return digits.startsWith("62") ? digits : `62${digits}`;
};

type SendMethod = "email" | "savepdf" | "whatsapp";

export default function QuotationDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [quotation, setQuotation] = useState<any>({ items: [] });
  const [loading, setLoading] = useState(true);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [method, setMethod] = useState<SendMethod>("email");
  const [message, setMessage] = useState("");
  const [messageInitialized, setMessageInitialized] = useState(false);
  const [sendingWhatsapp, setSendingWhatsapp] = useState(false);
  const lastDefaultMessageRef = useRef("");
  
  // Approval & Negotiation Modal states
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [hasNegotiation, setHasNegotiation] = useState(false);
  const [negotiatedAmount, setNegotiatedAmount] = useState<number | "">("");
  const [negotiationNotes, setNegotiationNotes] = useState("");
  const [clientPo, setClientPo] = useState<File | null>(null);
  const [clientSo, setClientSo] = useState<File | null>(null);
  const [clientOtherFiles, setClientOtherFiles] = useState<FileList | null>(null);
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);
  const [negotiatedItems, setNegotiatedItems] = useState<any[]>([]);

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
    setMessageInitialized(false);
  }, [id]);

  useEffect(() => {
    fetchDetail();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchBrand = useCallback(async () => {
    setBrandLoading(true);
    try {
      // Prefer active endpoint for consistency across app
      let active: any = null;
      const resActive = await fetch("/api/brand-profiles/active", { cache: "no-store" });
      if (resActive.ok) {
        active = await resActive.json();
      } else {
        // Fallback to list endpoint and pick active or first
        const res = await fetch("/api/brand-profiles", { cache: "no-store" });
        if (res.ok) {
          const payload = await res.json();
          if (Array.isArray(payload) && payload.length) {
            active = payload.find((item: any) => item.isActive) ?? payload[0];
          } else if (Array.isArray(payload?.profiles)) {
            const list = payload.profiles;
            active = list.find((p: any) => p?.isActive) ?? list[0] ?? null;
          } else if (Array.isArray(payload?.data)) {
            const list = payload.data;
            active = list.find((p: any) => p?.isActive) ?? list[0] ?? null;
          } else if (payload && typeof payload === "object") {
            active = payload;
          }
        }
      }
      setBrand(active ?? null);
    } catch (error) {
      console.error("Failed to fetch brand profile", error);
      setBrand(null);
    } finally {
      setBrandLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBrand();
    // Listen to brand module updates and refetch brand info
    const handler = () => fetchBrand();
    window.addEventListener("brand-modules:updated", handler);
    return () => window.removeEventListener("brand-modules:updated", handler);
  }, [fetchBrand]);

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
  const handleAction = async (action: "convertToSO" | "convertToInvoice" | "edit" | "approve" | "reject") => {
  if (action === "edit") {
    router.push(`/penjualan/quotation/edit/${id}`);
    return;
  }
  
  if (action === "approve") {
    // Initialize negotiated items with current prices
    const items = (quotation.items || []).map((item: any) => ({
      id: item.id,
      product: item.product,
      quantity: item.quantity,
      originalPrice: item.price,
      negotiatedPrice: item.price
    }));
    setNegotiatedItems(items);
    setNegotiatedAmount(total);
    setIsApproveModalOpen(true);
    return;
  }

  if (action === "reject") {
    toast(
      (t) => (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium">
            Apakah Anda yakin ingin menolak (<b>Reject</b>) quotation ini?
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
                toast.promise(
                  fetch(`/api/quotations/${id}`, { 
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: "Rejected" })
                  }).then(async (res) => {
                    if (!res.ok) throw new Error("Gagal mereject quotation.");
                    await fetchDetail();
                    router.refresh();
                  }),
                  {
                    loading: "Mereject quotation...",
                    success: "Quotation telah direject.",
                    error: "Gagal mereject quotation.",
                  }
                );
              }}
              className="rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
            >
              Ya, Reject
            </button>
          </div>
        </div>
      ),
      { duration: 5000, position: "bottom-center" }
    );
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
                toast.promise(
                  fetch(`/api/quotations/${id}/convert-to-so`, { method: "POST" }).then(async (res) => {
                    if (!res.ok) {
                      let msg = "Gagal menyalin ke Sales Order.";
                      try {
                        const data = await res.json();
                        msg = (data && typeof data === "object" && "message" in data)
                          ? String((data as any).message || msg)
                          : msg;
                      } catch {
                        const text = await res.text();
                        try {
                          const parsed = JSON.parse(text);
                          msg = (parsed && typeof parsed === "object" && "message" in parsed)
                            ? String((parsed as any).message || msg)
                            : (text || msg);
                        } catch {
                          msg = text || msg;
                        }
                      }
                      throw new Error(msg);
                    }
                    await fetchDetail();
                    router.refresh();
                    // Setelah berhasil disalin, arahkan ke halaman daftar Sales Order
                    router.push("/penjualan/order-penjualan");
                  }),
                  {
                    loading: "Menyalin ke Sales Order...",
                    success: "Berhasil disalin ke Sales Order.",
                    error: (e) => (e instanceof Error ? e.message : "Gagal menyalin ke Sales Order."),
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
  if (action === "convertToInvoice") {
    toast(
      (t) => (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium">
            Yakin ingin <b>Salin ke Invoice</b> dan mengubah status quotation menjadi <b>Confirmed</b>?
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
                toast.promise(
                  fetch(`/api/quotations/${id}/convert-to-invoice`, { method: "POST" }).then(async (res) => {
                    if (!res.ok) {
                      let msg = "Gagal menyalin ke Invoice.";
                      try {
                        const data = await res.json();
                        msg = (data && typeof data === "object" && "message" in data) ? String((data as any).message || msg) : msg;
                      } catch {
                        const text = await res.text();
                        try {
                          const parsed = JSON.parse(text);
                          msg = (parsed && typeof parsed === "object" && "message" in parsed) ? String((parsed as any).message || msg) : (text || msg);
                        } catch {
                          msg = text || msg;
                        }
                      }
                      throw new Error(msg);
                    }
                    await fetchDetail();
                    router.refresh();
                    // Setelah berhasil disalin, arahkan ke halaman daftar invoice
                    router.push("/penjualan/invoice-penjualan");
                  }),
                  {
                    loading: "Menyalin ke Invoice...",
                    success: "Berhasil disalin ke Invoice.",
                    error: (e) => (e instanceof Error ? e.message : "Gagal menyalin ke Invoice."),
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

const handleApproveSubmit = async () => {
  setIsSubmittingApproval(true);
  try {
    const formData = new FormData();
    
    // 1. Send all core quotation data to satisfy backend validation
    formData.append("quotationNumber", quotation.quotationNumber || "");
    formData.append("date", quotation.date || "");
    formData.append("validUntil", quotation.validUntil || "");
    formData.append("customerId", String(quotation.customerId || ""));
    formData.append("projectDescription", quotation.projectDesc || "");
    formData.append("notes", quotation.notes || "");
    
    // 2. Map negotiated items back to standard items format
    const updatedItems = (quotation.items || []).map((orig: any) => {
      // Find the negotiated version of this item
      const nego = negotiatedItems.find((ni: any) => ni.id === orig.id);
      return {
        ...orig,
        quantity: nego ? Number(nego.quantity) : orig.quantity,
        price: nego ? Number(nego.negotiatedPrice) : orig.price,
        // Ensure other internal fields are preserved
        supplierCost: orig.supplierCost,
        titipanCostAdjustment: orig.titipanCostAdjustment,
        hiddenMargin: orig.hiddenMargin,
        taxAdjustment: orig.taxAdjustment
      };
    });
    formData.append("items", JSON.stringify(updatedItems));

    // 3. Approval specific fields
    formData.append("status", "Approved");
    formData.append("isNegotiated", String(hasNegotiation));
    
    if (hasNegotiation) {
      const finalTotal = negotiatedItems.reduce((acc, item) => acc + (Number(item.negotiatedPrice) * item.quantity), 0);
      formData.append("negotiatedAmount", String(finalTotal));
      formData.append("originalAmount", String(total));
      formData.append("marginChange", String(finalTotal - total));
      formData.append("negotiationNotes", negotiationNotes);
    }
    
    if (clientPo) formData.append("clientPo", clientPo);
    if (clientSo) formData.append("clientSo", clientSo);
    if (clientOtherFiles) {
      for (let i = 0; i < clientOtherFiles.length; i++) {
        formData.append(`clientOtherFile_${i}`, clientOtherFiles[i]);
      }
    }

    const res = await fetch(`/api/quotations/${id}`, {
      method: "PUT",
      body: formData,
    });

    const json = await res.json();
    if (json.success) {
      toast.success("Quotation approved successfully!");
      setIsApproveModalOpen(false);
      fetchDetail();
    } else {
      toast.error(json.message || "Failed to approve quotation");
    }
  } catch (error) {
    console.error(error);
    toast.error("An error occurred during approval");
  } finally {
    setIsSubmittingApproval(false);
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
    // Parsing safety for JSON fields
    const defaults = typeof brand?.templateDefaults === "string" 
      ? JSON.parse(brand.templateDefaults) 
      : brand?.templateDefaults;

    // 1. Prioritaskan Signature Name dari Brand Settings
    const sigName = defaults?.signatureName;
    if (sigName) return sigName;

    // 2. Fallback ke profile user (actor)
    if (actor) {
      const parts = [
        actor.name,
        [actor.firstName, actor.lastName].filter(Boolean).join(" ").trim(),
        actor.company,
        brand?.name,
      ]
        .filter(Boolean)
        .map((v) => String(v).trim());
      const found = parts.find((v) => v.length);
      if (found) return found;
    }

    // 3. Fallback terakhir ke Brand Name
    return brand?.name || "Our Company";
  }, [actor, brand]);

  const actorContactLines = useMemo(() => {
    const lines: string[] = [];
    
    // Parsing safety for JSON fields
    const defaults = typeof brand?.templateDefaults === "string" 
      ? JSON.parse(brand.templateDefaults) 
      : brand?.templateDefaults;

    // Prioritaskan info dari signature settings jika ada
    const sigEmail = defaults?.signatureEmail;
    if (sigEmail) lines.push(sigEmail);
    else if (actor?.email) lines.push(actor.email);

    return lines;
  }, [actor, brand]);

  const actorPhone = useMemo(() => {
    const defaults = typeof brand?.templateDefaults === "string" 
      ? JSON.parse(brand.templateDefaults) 
      : brand?.templateDefaults;
    return defaults?.signaturePhone || actor?.phone || null;
  }, [actor, brand]);

  const signatureUrl = useMemo(() => {
    try {
      const defaults = typeof brand?.templateDefaults === "string" 
        ? JSON.parse(brand.templateDefaults) 
        : brand?.templateDefaults || {};
      
      return brand?.signatureImageUrl || defaults.signatureImageUrl || defaults.signatureUrl || null;
    } catch (e) {
      return brand?.signatureImageUrl || null;
    }
  }, [brand]);

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
  const formattedValidUntil = useMemo(
    () =>
      quotation?.validUntil
        ? new Date(quotation.validUntil).toLocaleDateString("id-ID", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })
        : "",
    [quotation?.validUntil]
  );

  useEffect(() => {
    if (!quotation || !quotation.id) return;
    const custName =
      (quotation.customer?.pic || quotation.customer?.company || "Customer").trim() || "Customer";
    const quotationNumber =
      quotation.quotationNumber || (quotation.id ? `QUO-${quotation.id}` : "Quotation");
    const formattedTotal = `Rp ${Number(total ?? 0).toLocaleString("id-ID")}`;
    const dateText = formattedDate || "-";
    const defaultMsg = `Halo ${custName},

Kami mengirimkan quotation ${quotationNumber} dengan total ${formattedTotal}.
Tanggal: ${dateText}.

Mohon ditinjau dan beri tahu kami jika ada pertanyaan.

Terima kasih.`;

    const shouldUpdate =
      !messageInitialized ||
      !message ||
      message === lastDefaultMessageRef.current;

    if (shouldUpdate && message !== defaultMsg) {
      setMessage(defaultMsg);
    }
    if (shouldUpdate) {
      lastDefaultMessageRef.current = defaultMsg;
      setMessageInitialized(true);
    }
  }, [quotation, total, formattedDate, messageInitialized, message]);

  const ensureShareLink = useCallback(async (): Promise<string> => {
    if (!quotation || !quotation.id) throw new Error("Quotation tidak tersedia");
    if (quotation.shareUrl) return quotation.shareUrl as string;

    const response = await fetch(`/api/share/drive-upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "quotation", id: quotation.id }),
    });
    const json = await response.json().catch(() => null);
    if (!response.ok || json?.success !== true || (!json?.url && !json?.shortUrl)) {
      throw new Error(json?.message || "Gagal membuat link dokumen");
    }
    const link: string = json.shortUrl || json.url;
    setQuotation((prev: any) => (prev ? { ...prev, shareUrl: link } : prev));
    return link;
  }, [quotation]);

  const createWhatsappLink = useCallback(async (): Promise<string> => {
    if (!quotation) throw new Error("Quotation tidak tersedia");
    const shareLink = await ensureShareLink();
    const phone = normalizeWhatsappPhone(quotation.customer?.phone);
    const encoded = encodeURIComponent(`${message}\n\nLink dokumen: ${shareLink}`);
    return phone ? `https://wa.me/${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
  }, [ensureShareLink, quotation, message]);

  const handleWhatsappQuick = useCallback(async () => {
    if (!quotation) return;
    const win = typeof window !== "undefined" ? window.open("about:blank") : null;
    setSendingWhatsapp(true);
    try {
      const waLink = await createWhatsappLink();
      if (win) win.location.href = waLink;
      else window.location.href = waLink;
      // Tandai status: Sent via WhatsApp
      try {
        const res = await fetch(`/api/quotations/${id}/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ via: "whatsapp" }),
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.success) {
          setQuotation((prev: any) => (prev ? { ...prev, status: "Sent", sentVia: "whatsapp" } : prev));
        }
      } catch {}
      toast.success("Mengarahkan ke WhatsApp dan menandai status terkirim.");
    } catch (err: any) {
      const fallbackMsg = encodeURIComponent(
        `${message}\n\nLink dokumen tidak tersedia. Silakan hubungi kami.`
      );
      const phone = normalizeWhatsappPhone(quotation.customer?.phone);
      const fallbackLink = phone
        ? `https://wa.me/${phone}?text=${fallbackMsg}`
        : `https://wa.me/?text=${fallbackMsg}`;
      if (win) win.location.href = fallbackLink;
      else window.location.href = fallbackLink;
      toast.error(err?.message || "Gagal membuat link dokumen, tetap membuka WhatsApp");
    } finally {
      setSendingWhatsapp(false);
    }
  }, [createWhatsappLink, quotation, message]);

  if (loading) return <div className="p-6 text-center">Loading...</div>;

  // ========================
  // PDF GENERATOR
  // ========================
  const generatePDF = async (): Promise<string> => {
    try {
      const queryParams = new URLSearchParams({
        showImage: String(options.showImage),
        showDescription: String(options.showDescription),
        showProjectDesc: String(options.showProjectDesc),
        showSignature: String(options.showSignature),
      });
      
      const res = await fetch(`/api/quotations/${id}/pdf?${queryParams.toString()}`);
      if (!res.ok) throw new Error("Gagal generate PDF dari server");
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      
      let fileName = `${quotation.quotationNumber || id}.pdf`;
      const dispo = res.headers.get("Content-Disposition");
      if (dispo) {
        const m = /filename="?([^";]+)"?/i.exec(dispo);
        if (m) fileName = m[1];
      } else {
        fileName = formatDownloadFileName(
          quotation.quotationNumber,
          quotation.customer?.pic || quotation.customer?.company,
          quotation.quotationNumber || `QUO-${quotation.id}`,
          quotation.customer?.pic || quotation.customer?.company || "Customer"
        );
      }
      
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      
      return fileName;
    } catch (err) {
      console.error(err);
      toast.error("Gagal membuat PDF");
      return "";
    }
  };

  // ========================
  const handleSend = async () => {
    if (method === "whatsapp") {
      await handleWhatsappQuick();
      setIsSendModalOpen(false);
      return;
    }

    if (method === "savepdf") {
      await generatePDF();
      try {
        const res = await fetch(`/api/quotations/${id}/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ via: "pdf" }),
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.success) {
          setQuotation((prev: any) => (prev ? { ...prev, status: "Sent", sentVia: "pdf" } : prev));
        }
      } catch {}
      toast.success("File PDF berhasil diunduh dan status diperbarui.");
      setIsSendModalOpen(false);
      return;
    }

    await generatePDF(); // simpan file untuk dibagikan manual
    const email = quotation.customer?.email || "";
    const subject = encodeURIComponent(`Quotation ${quotation.quotationNumber || ""}`);
    const body = encodeURIComponent(
      `${message}\n\n(Lampiran PDF telah disimpan di perangkat Anda. Lampirkan secara manual ke email ini.)`
    );
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
    try {
      const res = await fetch(`/api/quotations/${id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ via: "email" }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) {
        setQuotation((prev: any) => (prev ? { ...prev, status: "Sent", sentVia: "email" } : prev));
      }
    } catch {}
    toast.success("Mengarahkan ke Email dan menandai status terkirim.");
    setIsSendModalOpen(false);
  };
  

  

  // ========================
  // UI COMPONENT
  // ========================
  return (
    <div className="px-6 py-6 sm:px-10">
      {/* Breadcrumb */}
      <PageBreadcrumb pageTitle="Detail Quotation" />
  
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
              {quotation.status === "Sent" && quotation.sentVia
                ? `Sent via ${quotation.sentVia.charAt(0).toUpperCase() + quotation.sentVia.slice(1)}`
                : quotation.status || "Draft"}
            </span>
          </div>
        </div>
  
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          <button
            onClick={() => setIsSendModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-blue-700"
          >
            <Send className="h-4 w-4" />
            Kirim Quotation
          </button>
          {/* Actions for Pending/Sent quotations */}
          {!(["approved", "converted", "rejected"].includes((quotation.status || "").toLowerCase())) && (
            <>
              <button
                onClick={() => handleAction("approve")}
                className="inline-flex items-center gap-2 rounded-full bg-green-600 px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-green-700"
              >
                <Copy className="h-4 w-4" />
                Approve Quotation
              </button>
              <button
                onClick={() => handleAction("reject")}
                className="inline-flex items-center gap-2 rounded-full bg-red-50 px-4 py-2 text-sm font-medium text-red-600 border border-red-200 shadow-sm transition hover:bg-red-100"
              >
                <X className="h-4 w-4" />
                Reject
              </button>
            </>
          )}

          {/* Scope-based action buttons */}
          {String(brand?.businessScope || "").toUpperCase() === "CREATIVE" ? (
            <button
              onClick={() => handleAction("convertToInvoice")}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-emerald-700"
            >
              <Copy className="h-4 w-4" />
              Salin ke Invoice
            </button>
          ) : (
            <button
              onClick={() => handleAction("convertToSO")}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-emerald-700"
            >
              <Copy className="h-4 w-4" />
              Salin ke Sales Order
            </button>
          )}
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
          className="mx-auto w-[794px] overflow-hidden bg-white shadow-xl border-t"
          style={{ 
            borderColor: "#f1f5f9",
            minHeight: "1123px" 
          }}
        >
          <div
            className="space-y-10 px-10 py-10 text-sm leading-relaxed"
            style={{ color: currentTheme.headerTextColor }}
          >
            <header className="flex flex-wrap items-start justify-between gap-6">
              <div className="flex flex-1 items-center gap-3">
                <div className="flex flex-col items-start">
                  {brand?.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <Image src={brand.logoUrl} alt={brand.name ?? "Brand logo"} width={200} height={64} className="h-16 w-auto object-contain" />
                  ) : (
                    <div
                      className="flex h-16 w-24 items-center justify-center rounded bg-slate-100 text-xs font-semibold uppercase"
                      style={{ backgroundColor: currentTheme.secondaryColor, color: currentTheme.mutedText }}
                    >
                      Logo
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  {brand?.showBrandName !== false && brand?.name && (
                    <h2 className="whitespace-nowrap text-2xl font-semibold leading-tight" style={{ color: currentTheme.primaryColor }}>
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
                  {formattedValidUntil && (
                    <div className="flex justify-between gap-6">
                      <span>Valid Until</span>
                      <span className="text-sm font-semibold" style={{ color: currentTheme.headerTextColor }}>
                        {formattedValidUntil}
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
                  {actorPhone && (
                    <div style={{ color: currentTheme.mutedText }}>
                      {actorPhone}
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
                  {quotation.customer?.email && (
                    <div style={{ color: currentTheme.mutedText }}>
                      {quotation.customer.email}
                    </div>
                  )}
                  {quotation.customer?.address && (
                    <div className="whitespace-pre-line text-xs" style={{ color: currentTheme.mutedText }}>
                      {quotation.customer.address}
                    </div>
                  )}
                  {quotation.customer?.phone && (
                    <div style={{ color: currentTheme.mutedText }}>
                      {quotation.customer.phone}
                    </div>
                  )}
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
              <div className="overflow-hidden border-b border-slate-200">
                <table className="w-full border-collapse text-sm">
                  <colgroup>
                    <col style={{ width: options.showImage ? "34%" : "46%" }} />
                    {options.showImage && <col style={{ width: "18%" }} />}
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: options.showImage ? "14%" : "16%" }} />
                    <col style={{ width: options.showImage ? "14%" : "18%" }} />
                  </colgroup>
                  <thead>
                    <tr style={{ backgroundColor: currentTheme.primaryColor, color: "#FFFFFF" }}>
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
                                <div className="relative mx-auto h-16 w-16 overflow-hidden rounded-md border bg-gray-50 flex items-center justify-center shadow-sm">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={item.imageUrl}
                                    alt={item.product}
                                    className="h-full w-full object-contain"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src = "/no-image.svg";
                                      (e.target as HTMLImageElement).className = "h-8 w-8 opacity-20 object-contain";
                                    }}
                                  />
                                </div>
                              ) : (
                                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-md border border-dashed border-gray-200 bg-gray-50/50">
                                  <span className="text-[10px] text-gray-300 italic">No Img</span>
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
                      <div key={`${line}-${idx}`}>{line}</div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {/* Summary Lines moved ABOVE the box */}
                <div className="space-y-2 px-2 text-sm font-medium text-slate-500">
                  <div className="flex justify-between border-b border-slate-100 pb-2">
                    <span>Subtotal</span>
                    <span className="font-semibold text-slate-700">{`Rp ${total.toLocaleString("id-ID")}`}</span>
                  </div>
                </div>

                <div
                  className="rounded-2xl p-8 text-right shadow-sm"
                  style={{ backgroundColor: currentTheme.primaryColor, color: "#FFFFFF" }}
                >
                  <div className="text-xs font-semibold uppercase tracking-wide opacity-80">Total Due</div>
                  <div className="mt-3 text-4xl font-bold">{`Rp ${total.toLocaleString("id-ID")}`}</div>
                  {thankYouAndTerms.message && <div className="mt-4 text-xs opacity-90">{thankYouAndTerms.message}</div>}
                </div>
              </div>
            </section>

            {options.showSignature && (
              <section className="flex flex-col items-end pt-10">
                <div className="text-center">
                  <div className="text-sm font-bold mb-4 text-right">Hormat Kami,</div>
                  <div className="flex justify-end mb-4 h-24">
                    {signatureUrl ? (
                      <img src={signatureUrl} alt="Signature" className="h-full w-auto object-contain" />
                    ) : (
                      <div className="w-48 border-b-2 border-slate-300 self-end"></div>
                    )}
                  </div>
                  <div className="text-sm font-bold text-right" style={{ color: currentTheme.headerTextColor }}>
                    {actorHeading || brand?.name || "Authorized Signature"}
                  </div>
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
                    {method === "savepdf" ? "Simpan PDF" : method === "whatsapp" ? "Kirim WhatsApp" : "Kirim via Email"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== Modal Approval ===== */}
        {isApproveModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="relative w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl animate-in fade-in zoom-in duration-200">
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <h2 className="text-lg font-bold text-slate-800">Approve Quotation</h2>
                <button onClick={() => setIsApproveModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>

              <div className="max-h-[80vh] overflow-y-auto px-6 py-6 space-y-6">
                {/* Negotiation Section */}
                <div className="space-y-4 rounded-xl bg-slate-50 p-5 border border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700">Apakah ada negosiasi harga?</span>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="negosiasi" checked={hasNegotiation} onChange={() => setHasNegotiation(true)} className="accent-blue-600" />
                        <span className="text-sm">Ya</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="negosiasi" checked={!hasNegotiation} onChange={() => setHasNegotiation(false)} className="accent-blue-600" />
                        <span className="text-sm">Tidak</span>
                      </label>
                    </div>
                  </div>

                  {hasNegotiation && (
                    <div className="mt-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
                      <div className="overflow-hidden rounded-lg border border-slate-200">
                        <table className="w-full text-sm text-left">
                          <thead className="bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider">
                            <tr>
                              <th className="px-3 py-2">Produk</th>
                              <th className="px-3 py-2 text-center">Qty</th>
                              <th className="px-3 py-2 text-right">Harga Awal</th>
                              <th className="px-3 py-2 text-right w-40">Harga Nego</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {negotiatedItems.map((item, idx) => (
                              <tr key={item.id || idx}>
                                <td className="px-3 py-2 font-medium text-slate-700">{item.product}</td>
                                <td className="px-3 py-2">
                                  <input
                                    type="number"
                                    value={item.quantity}
                                    onChange={(e) => {
                                      const newItems = [...negotiatedItems];
                                      newItems[idx].quantity = Number(e.target.value);
                                      setNegotiatedItems(newItems);
                                      const newTotal = newItems.reduce((acc, it) => acc + (Number(it.negotiatedPrice) * it.quantity), 0);
                                      setNegotiatedAmount(newTotal);
                                    }}
                                    className="w-16 text-center font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded px-1 py-1 outline-none focus:ring-1 focus:ring-blue-400"
                                  />
                                </td>
                                <td className="px-3 py-2 text-right text-slate-400">
                                  {item.originalPrice.toLocaleString("id-ID")}
                                </td>
                                <td className="px-3 py-2">
                                  <div className="flex items-center gap-1">
                                    <span className="text-slate-400 text-xs">Rp</span>
                                    <input
                                      type="number"
                                      value={item.negotiatedPrice}
                                      onChange={(e) => {
                                        const newItems = [...negotiatedItems];
                                        newItems[idx].negotiatedPrice = e.target.value;
                                        setNegotiatedItems(newItems);
                                        // Update total summary
                                        const newTotal = newItems.reduce((acc, it) => acc + (Number(it.negotiatedPrice) * it.quantity), 0);
                                        setNegotiatedAmount(newTotal);
                                      }}
                                      className="w-full text-right font-semibold text-blue-600 bg-blue-50/50 border border-blue-100 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400"
                                    />
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-xl bg-blue-50/50 p-3 border border-blue-100">
                          <label className="block text-[10px] font-bold text-blue-600 uppercase mb-1">Total Setelah Nego</label>
                          <div className="text-lg font-bold text-blue-700">
                            {negotiatedItems.reduce((acc, it) => acc + (Number(it.negotiatedPrice) * it.quantity), 0).toLocaleString("id-ID", { style: "currency", currency: "IDR" })}
                          </div>
                        </div>
                        <div className={`rounded-xl p-3 border ${Number(negotiatedAmount) - total >= 0 ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100"}`}>
                          <label className={`block text-[10px] font-bold uppercase mb-1 ${Number(negotiatedAmount) - total >= 0 ? "text-green-600" : "text-red-600"}`}>Selisih Margin</label>
                          <div className={`text-lg font-bold ${Number(negotiatedAmount) - total >= 0 ? "text-green-700" : "text-red-700"}`}>
                            {(Number(negotiatedAmount) - total).toLocaleString("id-ID", { style: "currency", currency: "IDR" })}
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Catatan Negosiasi Tambahan</label>
                        <textarea
                          value={negotiationNotes}
                          onChange={(e) => setNegotiationNotes(e.target.value)}
                          className="w-full text-sm text-slate-900 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                          rows={2}
                          placeholder="Misal: Diskon khusus volume pengerjaan..."
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Upload Section */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    Upload Dokumen Client
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500 uppercase">Purchase Order (PO)</label>
                      <input type="file" onChange={(e) => setClientPo(e.target.files?.[0] || null)} className="w-full text-xs file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                      <p className="text-[10px] text-slate-400 italic">Bukti pemesanan resmi dari pelanggan sebagai dasar penagihan.</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500 uppercase">Sales Order (SO)</label>
                      <input type="file" onChange={(e) => setClientSo(e.target.files?.[0] || null)} className="w-full text-xs file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                      <p className="text-[10px] text-slate-400 italic">Dokumen konfirmasi pengerjaan untuk bagian operasional.</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Dokumen Pendukung Lainnya</label>
                    <input type="file" multiple onChange={(e) => setClientOtherFiles(e.target.files)} className="w-full text-xs file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                    <p className="text-[10px] text-slate-400 italic">Foto lokasi, file desain final, atau lampiran teknis tambahan.</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4 bg-slate-50/50">
                <button
                  disabled={isSubmittingApproval}
                  onClick={() => setIsApproveModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  disabled={isSubmittingApproval}
                  onClick={handleApproveSubmit}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2 text-sm font-bold text-white shadow-lg shadow-blue-200 hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {isSubmittingApproval ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-white" />
                      Memproses...
                    </>
                  ) : (
                    "Konfirmasi Approve"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
