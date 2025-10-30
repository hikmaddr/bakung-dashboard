"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import toast from "react-hot-toast";
import {
  Loader2,
  AlertTriangle,
  Trash2,
  Plus,
  FileText,
  PenTool,
  Home,
  ChevronRight,
  Sparkles,
  LayoutTemplate,
  Wand2,
  Palette,
} from "lucide-react";
import { Template, getAllTemplates, documentTypeLabels, categoryLabels } from "@/lib/templates";
import TemplateUploadForm from "@/components/TemplateUploadForm";
import SVGTemplatePreview from "@/components/SVGTemplatePreview";
// FileText sudah diimpor di atas; gunakan AlertTriangle yang sudah ada
import EmptyState from "@/components/EmptyState";

type SignatureProfile = {
  id: number;
  name: string;
  title?: string;
  imageUrl: string;
  createdAt: string;
};

export default function TemplateManagerPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; template: Template | null }>({
    open: false,
    template: null,
  });
  const [deleting, setDeleting] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'type' | 'category'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [activeBrand, setActiveBrand] = useState<any | null>(null);
  const [brandLoading, setBrandLoading] = useState(false);
  const [brandError, setBrandError] = useState<string | null>(null);
  const [builtInDialog, setBuiltInDialog] = useState<{
    open: boolean;
    template: Template | null;
    primary: string;
    secondary: string;
  }>({
    open: false,
    template: null,
    primary: "#0EA5E9",
    secondary: "#ECFEFF",
  });
  const [applyingTemplate, setApplyingTemplate] = useState(false);
  const [signatureProfiles, setSignatureProfiles] = useState<SignatureProfile[]>([]);
  const [signatureLoading, setSignatureLoading] = useState(false);
  const [signatureError, setSignatureError] = useState<string | null>(null);
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false);
  const [signatureUploading, setSignatureUploading] = useState(false);
  const [signatureForm, setSignatureForm] = useState<{ name: string; title: string; file: File | null }>({
    name: "",
    title: "",
    file: null,
  });
  const [signaturePreview, setSignaturePreview] = useState<string>("");

  // Preview PDF dialog state
  const [pdfDialog, setPdfDialog] = useState<{
    open: boolean;
    template: Template | null;
    pdfUrl: string | null;
    loading: boolean;
    error: string | null;
    placeholders: string[];
    missingVars: string[];
  }>({ open: false, template: null, pdfUrl: null, loading: false, error: null, placeholders: [], missingVars: [] });

  useEffect(() => {
    return () => {
      if (signaturePreview) {
        URL.revokeObjectURL(signaturePreview);
      }
    };
  }, [signaturePreview]);

  // Fetch templates
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const templatesData = await getAllTemplates();

      setTemplates(templatesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const normalizeBrandProfile = (profile: any) => ({
    id: profile?.id !== undefined && profile?.id !== null ? String(profile.id) : "",
    name: profile?.name ?? "",
    logo: profile?.logoUrl ?? profile?.logo ?? "",
    primaryColor: profile?.primaryColor ?? "#0EA5E9",
    secondaryColor: profile?.secondaryColor ?? "#ECFEFF",
    description: profile?.overview ?? profile?.description ?? "",
    website: profile?.website ?? "",
    email: profile?.email ?? "",
    address: profile?.address ?? "",
    phone: profile?.phone ?? "",
    footerText: profile?.footerText ?? "",
    templateDefaults: profile?.templateDefaults ?? {},
    numberFormats: profile?.numberFormats ?? {},
    modules: profile?.modules ?? {},
    isActive: Boolean(profile?.isActive),
  });

  const fetchActiveBrand = async () => {
    try {
      setBrandLoading(true);
      setBrandError(null);
      const response = await fetch("/api/brand-profiles");
      if (!response.ok) {
        throw new Error("Failed to load brand profiles");
      }
      const data = await response.json();

      let profiles: any[] = [];
      if (Array.isArray(data)) {
        profiles = data;
      } else if (Array.isArray(data?.profiles)) {
        profiles = data.profiles;
      } else if (Array.isArray(data?.data)) {
        profiles = data.data;
      } else if (data) {
        profiles = [data];
      }

      const normalized = profiles.map(normalizeBrandProfile);
      const active = normalized.find((profile) => profile.isActive) ?? normalized[0] ?? null;
      setActiveBrand(active);
    } catch (err) {
      setBrandError(err instanceof Error ? err.message : "Failed to load brand profile");
    } finally {
      setBrandLoading(false);
    }
  };

  const fetchSignatureProfiles = async () => {
    try {
      setSignatureLoading(true);
      setSignatureError(null);
      const response = await fetch("/api/signature-profiles", { cache: "no-store" });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || json?.success === false) {
        throw new Error(json?.error || "Failed to load signature profiles");
      }
      const rows: SignatureProfile[] = Array.isArray(json?.data) ? json.data : [];
      setSignatureProfiles(rows);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load signature profiles";
      setSignatureError(message);
    } finally {
      setSignatureLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchActiveBrand();
    void fetchSignatureProfiles();
  }, []);

  const extractPlaceholdersFromSvg = async (fileUrl?: string): Promise<string[]> => {
    if (!fileUrl) return [];
    try {
      const res = await fetch(fileUrl);
      const text = await res.text();
      const regex = /\{\{([^}]+)\}\}/g;
      const out = new Set<string>();
      let m: RegExpExecArray | null;
      while ((m = regex.exec(text)) !== null) {
        out.add(m[1]);
      }
      return Array.from(out);
    } catch {
      return [];
    }
  };

  const computeMissingVariables = (placeholders: string[], brand: any, sample: Record<string, any>): string[] => {
    const mapValue = (key: string): any => {
      const k = key.toUpperCase();
      const b = brand || {};
      const s = sample || {};
      const brandMap: Record<string, any> = {
        BRAND_NAME: b.name,
        BRAND_EMAIL: b.email,
        BRAND_PHONE: b.phone,
        BRAND_ADDRESS: b.address,
        BRAND_WEBSITE: b.website,
        BRAND_LOGO: b.logo,
        PRIMARY_COLOR: b.primaryColor,
        SECONDARY_COLOR: b.secondaryColor,
        FOOTER_TEXT: b.footerText,
        PAYMENT_INFO: b.paymentInfo,
        SIGNATURE_IMAGE_URL: b.signatureImageUrl || b.templateDefaults?.signatureImageUrl,
      };
      const sampleMap: Record<string, any> = {
        CUSTOMER_NAME: s.receiverName || s.customerName,
        CUSTOMER_ADDRESS: s.receiverAddress || s.customerAddress,
        CUSTOMER_PHONE: s.receiverPhone || s.customerPhone,
        INVOICE_NUMBER: s.number || s.invoiceNumber,
        DELIVERY_NUMBER: s.number,
        REF_INVOICE: s.refInvoice,
        DATE: s.date,
      };
      return brandMap[k] ?? sampleMap[k] ?? "__UNKNOWN__";
    };
    const missing: string[] = [];
    placeholders.forEach((ph) => {
      const val = mapValue(ph);
      if (val === "__UNKNOWN__") return; // abaikan token yang tidak dipetakan
      const empty = val === undefined || val === null || String(val).trim() === "";
      if (empty) missing.push(ph);
    });
    return missing;
  };

  const openPreviewPdf = async (template: Template) => {
    setPdfDialog((p) => ({ ...p, open: true, template, loading: true, error: null, pdfUrl: null, placeholders: [], missingVars: [] }));
    try {
      // 1) ambil placeholder dari file SVG
      const placeholders = await extractPlaceholdersFromSvg(template.fileUrl);

      // 2) siapkan sample payload untuk Delivery Note (paling generik, tanpa ubah data backend)
      const sample = {
        number: "SJ-PRV-001",
        date: new Date().toISOString().slice(0, 10),
        refInvoice: "INV-PRV-001",
        receiverName: "PT Contoh Pelanggan",
        receiverAddress: "Jl. Mawar No. 123, Jakarta",
        receiverPhone: "+62 812 3456 7890",
        items: [
          { name: "Produk A", qty: 2, unit: "pcs" },
          { name: "Produk B", qty: 1, unit: "box" },
        ],
        senderName: activeBrand?.name || "Gudang Pusat",
        expedition: "JNE Reg",
        shipDate: new Date().toISOString().slice(0, 10),
        etaDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
        note: "Preview template",
      };

      // 3) request PDF sebagai Blob via endpoint Delivery Note
      const res = await fetch("/api/deliveries/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sample),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "Gagal membuat PDF");
        throw new Error(errText || "Gagal membuat PDF");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      // 4) validasi variable yang belum terisi
      const missingVars = computeMissingVariables(placeholders, activeBrand, sample);

      setPdfDialog((p) => ({ ...p, loading: false, pdfUrl: url, placeholders, missingVars }));
    } catch (e: any) {
      setPdfDialog((p) => ({ ...p, loading: false, error: e?.message || "Gagal memuat preview PDF" }));
    }
  };

  const closePreviewPdf = () => {
    setPdfDialog((p) => {
      if (p.pdfUrl) URL.revokeObjectURL(p.pdfUrl);
      return { open: false, template: null, pdfUrl: null, loading: false, error: null, placeholders: [], missingVars: [] };
    });
  };

  // Handle template upload success
  const handleUploadSuccess = () => {
    setShowUploadForm(false);
    fetchData(); // Refresh templates
    toast.success("Template berhasil diunggah.");
  };

  const resetSignatureForm = () => {
    setSignatureForm({ name: "", title: "", file: null });
    if (signaturePreview) {
      URL.revokeObjectURL(signaturePreview);
      setSignaturePreview("");
    }
  };

  const handleSignatureFileChange = (file: File | null) => {
    if (signaturePreview) {
      URL.revokeObjectURL(signaturePreview);
      setSignaturePreview("");
    }
    setSignatureForm((prev) => ({ ...prev, file }));
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      setSignaturePreview(objectUrl);
    }
  };

  const handleCreateSignatureProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!signatureForm.name.trim()) {
      toast.error("Nama penanda tangan wajib diisi.");
      return;
    }
    if (!signatureForm.file) {
      toast.error("Unggah file tanda tangan terlebih dahulu.");
      return;
    }
    try {
      setSignatureUploading(true);
      // Upload image first
      const fd = new FormData();
      fd.append("signature", signatureForm.file);
      const uploadRes = await fetch("/api/upload/signature", { method: "POST", body: fd });
      const uploadJson = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok || uploadJson?.success === false || !uploadJson?.url) {
        throw new Error(uploadJson?.error || "Gagal mengunggah file tanda tangan.");
      }

      // Save profile
      const saveRes = await fetch("/api/signature-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: signatureForm.name.trim(),
          title: signatureForm.title.trim(),
          imageUrl: uploadJson.url,
        }),
      });
      const saveJson = await saveRes.json().catch(() => ({}));
      if (!saveRes.ok || saveJson?.success === false || !saveJson?.data) {
        throw new Error(saveJson?.error || "Gagal menyimpan signature profile.");
      }

      setSignatureProfiles((prev) => [...prev, saveJson.data as SignatureProfile]);
      toast.success("Signature profile berhasil dibuat.");
      setSignatureDialogOpen(false);
      resetSignatureForm();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal membuat signature profile.";
      toast.error(message);
    } finally {
      setSignatureUploading(false);
    }
  };

  const handleDeleteSignatureProfile = async (profile: SignatureProfile) => {
    if (!confirm(`Hapus signature profile "${profile.name}"?`)) return;
    try {
      const res = await fetch(`/api/signature-profiles?id=${profile.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) {
        throw new Error(json?.error || "Gagal menghapus signature profile.");
      }
      setSignatureProfiles((prev) => prev.filter((item) => item.id !== profile.id));
      toast.success("Signature profile dihapus.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal menghapus signature profile.";
      toast.error(message);
    }
  };

  // Handle template delete
  const handleDeleteTemplate = async (template: Template) => {
    if (!template.isUploaded) {
      setError('Cannot delete built-in templates');
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch(`/api/templates?id=${template.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete template');
      }

      setDeleteDialog({ open: false, template: null });
      fetchData(); // Refresh templates
      toast.success("Template berhasil dihapus.");
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete template');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading templates...</span>
      </div>
    );
  }

  // Filter and sort templates
  const filteredAndSortedTemplates = templates
    .filter(template => {
      const matchesType = filterType === 'all' || template.type === filterType;
      const matchesCategory = filterCategory === 'all' || template.category === filterCategory;
      return matchesType && matchesCategory;
    })
    .sort((a, b) => {
      let aValue: any;
      let bValue: any;

      aValue = a[sortBy as keyof Template] as any;
      bValue = b[sortBy as keyof Template] as any;

      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  // Separate built-in and uploaded templates
  const builtInTemplates = filteredAndSortedTemplates.filter(t => !t.isUploaded);
  const uploadedTemplates = filteredAndSortedTemplates.filter(t => t.isUploaded);

  const openBuiltInDialog = (template: Template) => {
    setBuiltInDialog({
      open: true,
      template,
      primary: template.primaryColor || "#0EA5E9",
      secondary: template.secondaryColor || "#ECFEFF",
    });
  };

  const closeBuiltInDialog = () => {
    setBuiltInDialog({
      open: false,
      template: null,
      primary: "#0EA5E9",
      secondary: "#ECFEFF",
    });
  };

  const handleApplyTemplateToBrand = async () => {
    if (!builtInDialog.template) {
      return;
    }

    if (!activeBrand) {
      toast.error("Tidak ada brand aktif yang bisa diperbarui.");
      return;
    }

    try {
      setApplyingTemplate(true);
      const payload = {
        id: activeBrand.id,
        name: activeBrand.name,
        logo: activeBrand.logo,
        primaryColor: builtInDialog.primary,
        secondaryColor: builtInDialog.secondary,
        description: activeBrand.description,
        website: activeBrand.website,
        email: activeBrand.email,
        address: activeBrand.address,
        phone: activeBrand.phone,
        footerText: activeBrand.footerText,
        templateDefaults: {
          ...activeBrand.templateDefaults,
          invoice: builtInDialog.template.id,
        },
        numberFormats: activeBrand.numberFormats,
        modules: activeBrand.modules,
        isActive: true,
      };

      const response = await fetch("/api/brand-profiles", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Gagal menerapkan template ke brand aktif.");
      }

      const updatedProfile = await response.json();
      setActiveBrand(normalizeBrandProfile(updatedProfile));
      toast.success("Template berhasil diterapkan ke brand aktif.");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("brand-modules:updated"));
      }
      closeBuiltInDialog();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan perubahan template.");
    } finally {
      setApplyingTemplate(false);
    }
  };

  return (
    <div className="space-y-6 px-4 pb-16 pt-6 md:px-8 lg:px-10">
      {/* Breadcrumb */}
      <nav className="flex items-center space-x-2 text-sm text-gray-500">
        <Home className="h-4 w-4" />
        <ChevronRight className="h-4 w-4" />
        <span>Template Branding</span>
        <ChevronRight className="h-4 w-4" />
        <span className="text-gray-900 font-medium">Template Manager</span>
      </nav>

      {/* Hero */}
      <header className="relative overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-indigo-100 p-6 shadow-sm sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.5fr,1fr] lg:items-center">
          <div className="space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-blue-600 shadow-sm ring-1 ring-blue-100 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              Template Manager
            </span>
            <div>
              <h1 className="text-3xl font-semibold text-gray-900 sm:text-4xl">
                Desain Dokumen Profesional dalam Sekali Klik
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-gray-600 sm:text-base">
                Pilih template bawaan, atur warna brand, atau unggah desain kustom untuk quotation, invoice, dan dokumen bisnis lainnya.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => setShowUploadForm(true)} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="mr-2 h-4 w-4" />
                Upload Template
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push("/template-branding/brand-settings")}
                className="border-blue-200 text-blue-700 hover:bg-blue-100/60"
              >
                <Palette className="mr-2 h-4 w-4" />
                Atur Brand Default
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-2xl bg-white/80 p-4 shadow-sm ring-1 ring-blue-100 backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <LayoutTemplate className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-blue-500">Total Template</p>
                  <p className="text-xl font-semibold text-gray-900">{templates.length}</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl bg-white/80 p-4 shadow-sm ring-1 ring-blue-100 backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <Wand2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-indigo-500">Template Bawaan</p>
                  <p className="text-xl font-semibold text-gray-900">{templates.filter((t) => !t.isUploaded).length}</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl bg-white/80 p-4 shadow-sm ring-1 ring-blue-100 backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-emerald-500">Template Custom</p>
                  <p className="text-xl font-semibold text-gray-900">{templates.filter((t) => t.isUploaded).length}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="rounded-2xl">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Tabs Section */}
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <Tabs defaultValue="templates" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="templates" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="signatures" className="flex items-center gap-2">
              <PenTool className="h-4 w-4" />
              Signatures
              {signatureProfiles.length > 0 ? (
                <Badge variant="secondary">{signatureProfiles.length}</Badge>
              ) : null}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="templates" className="space-y-8">
            {/* Filters */}
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                  <h2 className="text-sm font-semibold text-gray-900">Filter cepat</h2>
                  <p className="text-xs text-gray-500">Pilih jenis dokumen atau kategori untuk mempercepat pencarian template.</p>
                </div>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-6">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase text-gray-500">Jenis Dokumen</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: "all", label: "Semua" },
                        ...Object.entries(documentTypeLabels).map(([value, label]) => ({ value, label })),
                      ].map((item) => (
                        <button
                          key={item.value}
                          onClick={() => setFilterType(item.value)}
                          className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                            filterType === item.value
                              ? "bg-blue-600 text-white shadow"
                              : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase text-gray-500">Kategori</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: "all", label: "Semua" },
                        ...Object.entries(categoryLabels).map(([value, label]) => ({ value, label })),
                      ].map((item) => (
                        <button
                          key={item.value}
                          onClick={() => setFilterCategory(item.value)}
                          className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                            filterCategory === item.value
                              ? "bg-indigo-600 text-white shadow"
                              : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Badge variant="secondary" className="bg-blue-50 text-blue-600">
                    {filteredAndSortedTemplates.length}
                  </Badge>
                  template cocok dari {templates.length} total template
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-600">Urutkan</span>
                    <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                      <SelectTrigger className="w-36 border-gray-200 bg-white">
                        <SelectValue placeholder="Pilih" />
                      </SelectTrigger>
                      <SelectContent position="item-aligned" usePortal={false} className="z-[10000]">
                        <SelectItem value="name">Nama</SelectItem>
                        <SelectItem value="type">Tipe</SelectItem>
                        <SelectItem value="category">Kategori</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Select value={sortOrder} onValueChange={(value: any) => setSortOrder(value)}>
                    <SelectTrigger className="w-28 border-gray-200 bg-white">
                      <SelectValue placeholder="Order" />
                    </SelectTrigger>
                    <SelectContent position="item-aligned" usePortal={false} className="z-[10000]">
                      <SelectItem value="asc">A → Z</SelectItem>
                      <SelectItem value="desc">Z → A</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-8">
              {/* Built-in Templates */}
              {builtInTemplates.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-gray-900">Built-in Templates</h3>
                    <span className="text-sm text-gray-500 bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
                      {builtInTemplates.length}
                    </span>
                  </div>
                  {brandError && (
                    <Alert variant="destructive" className="rounded-xl">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>{brandError}</AlertDescription>
                    </Alert>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {builtInTemplates.map((template) => (
                      <SVGTemplatePreview
                        key={template.id}
                        template={template}
                        onEdit={(tpl) => openBuiltInDialog(tpl)}
                        onPreviewPdf={(tpl) => openPreviewPdf(tpl)}
                        enableEditForBuiltIn
                      />
                    ))}
                  </div>
                  {brandLoading && (
                    <div className="text-sm text-gray-500 flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Memuat informasi brand aktif...
                    </div>
                  )}
                  {!brandLoading && !activeBrand && (
                    <div className="text-sm text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-4 py-3">
                      Belum ada brand aktif. Buat atau aktifkan brand di halaman Brand Settings untuk menerapkan template ini.
                    </div>
                  )}
                </div>
              )}

              {/* Custom Templates */}
              {uploadedTemplates.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-gray-900">Custom Templates</h3>
                    <span className="text-sm text-gray-500 bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                      {uploadedTemplates.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {uploadedTemplates.map((template) => (
                      <SVGTemplatePreview
                        key={template.id}
                        template={template}
                        onEdit={() => {
                          // Navigate to edit page
                          router.push(`/template-branding/template-manager/edit/${template.id}`);
                        }}
                        onPreviewPdf={(tpl) => openPreviewPdf(tpl)}
                        onRemove={() =>
                          setDeleteDialog({ open: true, template })
                        }
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {filteredAndSortedTemplates.length === 0 && templates.length > 0 && (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No templates match your filters</h3>
                  <p className="text-sm text-gray-500 mb-6">
                    Try adjusting your filter criteria to see more templates.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFilterType('all');
                      setFilterCategory('all');
                    }}
                  >
                    Clear Filters
                  </Button>
                </div>
              )}

              {templates.length === 0 && (
                <EmptyState
                  title="Belum ada template dokumen"
                  description="Mulai dengan mengupload template PDF pertama Anda untuk digunakan dalam pembuatan dokumen bisnis."
                  actions={
                    <Button onClick={() => setShowUploadForm(true)} className="bg-blue-600 hover:bg-blue-700">
                      <Plus className="h-4 w-4 mr-2" />
                      Upload Template Pertama
                    </Button>
                  }
                />
              )}
            </div>
          </TabsContent>

          <TabsContent value="signatures" className="space-y-6">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 md:text-xl">
                  Signature Profiles
                </h2>
                <p className="text-sm text-gray-500">
                  Kelola tanda tangan digital untuk digunakan pada dokumen.
                </p>
              </div>
              <Button
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
                onClick={() => {
                  resetSignatureForm();
                  setSignatureDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Tambah Signature
              </Button>
            </div>

            {signatureError ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{signatureError}</AlertDescription>
              </Alert>
            ) : null}

            {signatureLoading ? (
              <div className="flex items-center justify-center py-20 text-gray-500">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span>Memuat signature profiles...</span>
              </div>
            ) : signatureProfiles.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-gray-200 rounded-2xl bg-white">
                <PenTool className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Belum ada signature profile</h3>
                <p className="text-sm text-gray-500 mb-6">
                  Buat signature profile pertama untuk menambahkan tanda tangan pada dokumen.
                </p>
                <Button
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={() => {
                    resetSignatureForm();
                    setSignatureDialogOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Buat Signature Profile
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {signatureProfiles.map((profile) => (
                  <div
                    key={profile.id}
                    className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-center bg-gray-50 rounded-xl border border-dashed border-gray-200 h-40 relative overflow-hidden">
                      <img
                        src={profile.imageUrl}
                        alt={profile.name}
                        className="max-h-full object-contain"
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-base font-semibold text-gray-900">{profile.name}</p>
                      {profile.title ? (
                        <p className="text-sm text-gray-500">{profile.title}</p>
                      ) : null}
                      <p className="text-xs text-gray-400">
                        Dibuat pada{" "}
                        {new Date(profile.createdAt).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => handleDeleteSignatureProfile(profile)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Hapus
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </section>

      {/* Signature create dialog */}
      <Dialog
        open={signatureDialogOpen}
        onOpenChange={(open) => {
          if (open) {
            setSignatureDialogOpen(true);
          } else {
            setSignatureDialogOpen(false);
            resetSignatureForm();
          }
        }}
      >
        <DialogContent className="max-w-lg bg-white border border-gray-200 rounded-2xl shadow-xl">
          <DialogHeader className="px-6 py-4 border-b border-gray-200">
            <DialogTitle className="text-lg font-semibold text-gray-900">Signature Profile Baru</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSignatureProfile}>
            <div className="px-6 py-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signature-name">Nama Penanda Tangan</Label>
                <Input
                  id="signature-name"
                  value={signatureForm.name}
                  onChange={(event) =>
                    setSignatureForm((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Contoh: Andi Saputra"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signature-title">Jabatan / Deskripsi (opsional)</Label>
                <Input
                  id="signature-title"
                  value={signatureForm.title}
                  onChange={(event) =>
                    setSignatureForm((prev) => ({
                      ...prev,
                      title: event.target.value,
                    }))
                  }
                  placeholder="Contoh: Direktur Utama"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signature-file">File Tanda Tangan</Label>
                <Input
                  id="signature-file"
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={(event) => handleSignatureFileChange(event.target.files?.[0] ?? null)}
                />
                <p className="text-xs text-gray-500">
                  Unggah tanda tangan dengan format PNG atau JPG. Disarankan latar belakang transparan. Maksimal 5MB.
                </p>
                {signaturePreview ? (
                  <div className="mt-2 flex justify-center">
                    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
                      <img src={signaturePreview} alt="Signature preview" className="h-32 object-contain" />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
            <DialogFooter className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSignatureDialogOpen(false);
                  resetSignatureForm();
                }}
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={signatureUploading}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {signatureUploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Simpan Signature
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* PDF Preview Dialog */}
      <Dialog open={pdfDialog.open} onOpenChange={(open) => (open ? null : closePreviewPdf())}>
        <DialogContent className="max-w-5xl w-full bg-white border border-gray-200 rounded-2xl shadow-xl">
          <DialogHeader className="px-6 py-4 border-b border-gray-200">
            <DialogTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Preview PDF
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 py-4 grid gap-4 grid-cols-1 lg:grid-cols-[2fr,1fr] min-h-[480px]">
            <div className="rounded-xl border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center">
              {pdfDialog.loading ? (
                <div className="flex items-center gap-2 text-gray-600"><Loader2 className="h-5 w-5 animate-spin" />Membuat PDF...</div>
              ) : pdfDialog.error ? (
                <div className="p-4 text-sm text-red-600 flex items-center gap-2"><AlertTriangle className="h-4 w-4" />{pdfDialog.error}</div>
              ) : pdfDialog.pdfUrl ? (
                <iframe src={pdfDialog.pdfUrl} className="w-full h-[520px] bg-white" />
              ) : (
                <div className="text-sm text-gray-500">Tidak ada konten</div>
              )}
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-gray-900">Validasi Variable</p>
                {pdfDialog.missingVars.length === 0 ? (
                  <div className="mt-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                    Semua variable terisi untuk preview contoh.
                  </div>
                ) : (
                  <div className="mt-2 rounded-lg border border-orange-200 bg-orange-50 p-3">
                    <p className="text-sm font-medium text-orange-700 mb-2">Belum terisi:</p>
                    <div className="flex flex-wrap gap-2">
                      {pdfDialog.missingVars.map((v) => (
                        <span key={v} className="text-xs bg-white text-orange-700 border border-orange-200 px-2 py-1 rounded-full">{`{{${v}}}`}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Placeholder Ditemukan</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {pdfDialog.placeholders.length === 0 ? (
                    <span className="text-xs text-gray-500">Tidak ada placeholder di file SVG</span>
                  ) : (
                    pdfDialog.placeholders.map((p) => (
                      <span key={p} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">{`{{${p}}}`}</span>
                    ))
                  )}
                </div>
              </div>
              <div className="text-xs text-gray-500">
                Catatan: Preview menggunakan contoh Delivery Note dan warna mengikuti brand aktif.
              </div>
            </div>
          </div>
          <DialogFooter className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
            <Button variant="outline" onClick={closePreviewPdf}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Upload Form Modal */}
      <Dialog open={showUploadForm} onOpenChange={setShowUploadForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white border border-gray-200 shadow-xl rounded-2xl">
          <DialogHeader className="px-6 py-4 border-b border-gray-200">
            <DialogTitle className="text-lg font-semibold text-gray-900">Upload Template Baru</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-4">
            <TemplateUploadForm onSuccess={handleUploadSuccess} />
          </div>
      </DialogContent>
    </Dialog>

      {/* Built-in Template Customization Dialog */}
      <Dialog open={builtInDialog.open} onOpenChange={(open) => (open ? null : closeBuiltInDialog())}>
        <DialogContent className="max-w-2xl bg-white border border-gray-200 rounded-2xl shadow-xl">
          <DialogHeader className="px-6 py-4 border-b border-gray-200">
            <DialogTitle className="text-lg font-semibold text-gray-900">
              Kustomisasi Template
            </DialogTitle>
          </DialogHeader>
          {builtInDialog.template && (
            <div className="px-6 py-4 space-y-6">
              <div className="space-y-1.5">
                <p className="text-sm font-semibold text-gray-900">{builtInDialog.template.name}</p>
                <p className="text-sm text-muted-foreground">
                  {builtInDialog.template.description || "Sesuaikan warna template sebelum diterapkan ke brand aktif."}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="built-in-primary">Primary color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="built-in-primary"
                      type="color"
                      value={builtInDialog.primary}
                      onChange={(event) =>
                        setBuiltInDialog((prev) => ({
                          ...prev,
                          primary: event.target.value,
                        }))
                      }
                      className="w-16 h-10 p-1"
                    />
                    <Input
                      type="text"
                      value={builtInDialog.primary}
                      onChange={(event) =>
                        setBuiltInDialog((prev) => ({
                          ...prev,
                          primary: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="built-in-secondary">Secondary color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="built-in-secondary"
                      type="color"
                      value={builtInDialog.secondary}
                      onChange={(event) =>
                        setBuiltInDialog((prev) => ({
                          ...prev,
                          secondary: event.target.value,
                        }))
                      }
                      className="w-16 h-10 p-1"
                    />
                    <Input
                      type="text"
                      value={builtInDialog.secondary}
                      onChange={(event) =>
                        setBuiltInDialog((prev) => ({
                          ...prev,
                          secondary: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
                <p className="text-xs uppercase font-semibold text-gray-500 mb-2">Preview Accent</p>
                <div className="flex flex-col gap-3">
                  <div
                    className="h-12 rounded-lg shadow-sm border"
                    style={{ background: builtInDialog.primary }}
                  />
                  <div
                    className="h-12 rounded-lg shadow-sm border"
                    style={{ background: builtInDialog.secondary }}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
            <Button variant="outline" onClick={closeBuiltInDialog}>
              Batal
            </Button>
            <Button
              onClick={handleApplyTemplateToBrand}
              disabled={!activeBrand || applyingTemplate}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {applyingTemplate && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Terapkan ke Brand Aktif
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, template: null })}
      >
        <DialogContent className="bg-white border border-gray-200 shadow-xl rounded-2xl max-w-md">
          <DialogHeader className="px-6 py-4 border-b border-gray-200">
            <DialogTitle className="text-lg font-semibold text-gray-900">Hapus Template</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-4">
            <p className="text-gray-700">Apakah Anda yakin ingin menghapus template "{deleteDialog.template?.name}"?</p>
            <p className="text-sm text-gray-500 mt-2">
              Tindakan ini tidak dapat dibatalkan.
            </p>
          </div>
          <DialogFooter className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
            <Button
              variant="outline"
              onClick={() => setDeleteDialog({ open: false, template: null })}
              disabled={deleting}
              className="border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              Batal
            </Button>
            <Button
              onClick={() => deleteDialog.template && handleDeleteTemplate(deleteDialog.template)}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
