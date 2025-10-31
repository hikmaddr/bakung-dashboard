"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { getAllTemplates, Template } from "@/lib/templates";
import type { DocumentType } from "@/lib/templates";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Upload, Loader2, RefreshCw, Plus, Edit, Trash2, Eye, EyeOff, Star, Crown, ShoppingCart, Truck, Package } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { useModal } from "@/hooks/useModal";
import toast from "react-hot-toast";
import Checkbox from "@/components/form/input/Checkbox";

interface BrandProfile {
  id: string;
  name: string;
  logo?: string;
  primaryColor?: string;
  secondaryColor?: string;
  description?: string;
  website?: string;
  email?: string;
  address?: string;
  phone?: string;
  footerText?: string;
  paymentInfo?: string;
  termsConditions?: string;
  showBrandName?: boolean;
  showBrandDescription?: boolean;
  showBrandEmail?: boolean;
  showBrandWebsite?: boolean;
  showBrandAddress?: boolean;
  numberFormats?: {
    quotation?: string;
    salesOrder?: string;
    invoice?: string;
    deliveryNote?: string;
  };
  templateDefaults?: {
    quotation?: string;
    salesOrder?: string;
    invoice?: string;
    deliveryNote?: string;
    [key: string]: string | undefined;
  };
  isActive?: boolean;
  modules?: Record<string, boolean>;
  signatureProfileId?: string;
  signatureName?: string;
  signatureTitle?: string;
  signatureImageUrl?: string;
}

type SignatureProfileOption = {
  id: number;
  name: string;
  title?: string;
  imageUrl: string;
  createdAt?: string;
};

const MANAGE_TEMPLATES_VALUE = "manage-templates";

type ModuleKey = "sales" | "purchase" | "inventory";

type FeatureKey =
  | "sales.quotation"
  | "sales.order"
  | "sales.invoice"
  | "sales.receipt"
  | "sales.delivery"
  | "purchase.order"
  | "purchase.invoice"
  | "purchase.receipt"
  | "purchase.receiving"
  | "inventory.products"
  | "inventory.stock";

const defaultTemplateDefaults = {
  quotation: "default",
  salesOrder: "default",
  invoice: "default",
  deliveryNote: "default",
} as const;

const defaultNumberFormats: Record<string, string> = {
  quotation: "QUO-{YYYY}-{0000}",
  salesOrder: "SO-{YYYY}-{0000}",
  invoice: "INV-{YYYY}-{0000}",
  deliveryNote: "DN-{YYYY}-{0000}",
};

const defaultModules: Record<ModuleKey, boolean> = {
  sales: true,
  purchase: true,
  inventory: true,
};

const SIGNATURE_META_KEYS = ["signatureProfileId", "signatureName", "signatureTitle", "signatureImageUrl"] as const;
type SignatureMetaKey = typeof SIGNATURE_META_KEYS[number];

const FEATURES_BY_MODULE: Record<ModuleKey, Array<{ key: FeatureKey; label: string }>> = {
  sales: [
    { key: "sales.quotation", label: "Quotation" },
    { key: "sales.order", label: "Order Penjualan" },
    { key: "sales.invoice", label: "Invoice Penjualan" },
    { key: "sales.receipt", label: "Kwitansi Penjualan" },
    { key: "sales.delivery", label: "Surat Jalan" },
  ],
  purchase: [
    { key: "purchase.order", label: "Order Pembelian" },
    { key: "purchase.invoice", label: "Invoice Pembelian" },
    { key: "purchase.receipt", label: "Kwitansi Pembelian" },
    { key: "purchase.receiving", label: "Surat Penerimaan Barang" },
  ],
  inventory: [
    { key: "inventory.products", label: "Produk" },
    { key: "inventory.stock", label: "Stok & Gudang" },
  ],
};

type TemplateDefaultKey = keyof typeof defaultTemplateDefaults;

const ensureStringRecord = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>(
    (acc, [key, val]) => {
      if (val === undefined || val === null) {
        return acc;
      }
      acc[key] = typeof val === "string" ? val : String(val);
      return acc;
    },
    {}
  );
};

const normalizeTemplateDefaults = (value: unknown): Record<string, string> => {
  const record = ensureStringRecord(value);
  const merged = { ...defaultTemplateDefaults, ...record };

  return Object.entries(merged).reduce<Record<string, string>>((acc, [key, val]) => {
    const v = String(val ?? "");
    acc[key] = v === MANAGE_TEMPLATES_VALUE ? "default" : v || "default";
    return acc;
  }, { ...defaultTemplateDefaults });
};

const normalizeNumberFormats = (value: unknown): Record<string, string> => {
  const record = ensureStringRecord(value);
  return { ...defaultNumberFormats, ...record };
};

const normalizeModules = (value: unknown): Record<ModuleKey, boolean> => {
  if (!value || typeof value !== "object") {
    return { ...defaultModules };
  }

  const record = value as Record<string, unknown>;
  return {
    sales: Boolean(record.sales ?? defaultModules.sales),
    purchase: Boolean(record.purchase ?? defaultModules.purchase),
    inventory: Boolean(record.inventory ?? defaultModules.inventory),
  };
};

const buildModulesPayload = (modules: unknown): Record<string, boolean> => {
  const current: Record<string, boolean> =
    modules && typeof modules === "object" ? (modules as Record<string, boolean>) : {};
  const top = normalizeModules(current);
  const result: Record<string, boolean> = { ...current, ...top };

  // Ensure feature keys exist with sensible defaults tied to top-level module state
  (Object.keys(FEATURES_BY_MODULE) as ModuleKey[]).forEach((moduleKey) => {
    FEATURES_BY_MODULE[moduleKey].forEach(({ key }) => {
      if (result[key] === undefined) {
        result[key] = top[moduleKey];
      }
    });
  });

  return result;
};

const MODULE_OPTIONS: Array<{
  key: ModuleKey;
  label: string;
  description: string;
  Icon: LucideIcon;
}> = [
  {
    key: "sales",
    label: "Penjualan",
    description:
      "Aktifkan modul penawaran, order, invoice, kwitansi, dan surat jalan.",
    Icon: ShoppingCart,
  },
  {
    key: "purchase",
    label: "Pembelian",
    description: "Gunakan modul permintaan dan pesanan pembelian ke supplier.",
    Icon: Truck,
  },
  {
    key: "inventory",
    label: "Produk & Stok",
    description: "Kelola katalog produk, stok gudang, dan pergerakan barang.",
    Icon: Package,
  },
];

const TEMPLATE_FIELD_TO_DOC_TYPE: Record<TemplateDefaultKey, DocumentType> = {
  quotation: "quotation",
  salesOrder: "sales-order",
  invoice: "invoice",
  deliveryNote: "delivery-note",
};

const BRAND_PRESETS: Array<{
  id: string;
  label: string;
  description: string;
  overrides: Partial<BrandProfile>;
}> = [
  {
    id: "creative-services",
    label: "Creative Services (Warm)",
    description: "Fokus ke dokumen penjualan dengan aksen peach lembut.",
    overrides: {
      name: "Creative Services",
      description: "Profil brand untuk layanan kreatif dan project-based invoice.",
      primaryColor: "#E85C57",
      secondaryColor: "#FFEAE5",
      footerText: "Thank you for collaborating with our studio.",
      paymentInfo: "Bank BCA - 1234567890\nA/N Creative Services\nSWIFT: CENAIDJA",
      termsConditions: "Pembayaran DP 50% sebelum project dimulai\nSisa pembayaran 7 hari setelah final invoice",
      templateDefaults: {
        quotation: "modern-clean",
        salesOrder: "modern-clean",
        invoice: "invoice-modern-warm",
        deliveryNote: "modern-clean",
      },
      modules: {
        sales: true,
        purchase: false,
        inventory: false,
      },
    },
  },
  {
    id: "procurement-souvenir",
    label: "Procurement & Souvenir (Indigo)",
    description: "Aktifkan seluruh modul dengan tema ungu profesional.",
    overrides: {
      name: "Procurement & Souvenir",
      description: "Profil brand untuk pengadaan barang dan souvenir korporat.",
      primaryColor: "#4C1D95",
      secondaryColor: "#EDE9FE",
      footerText: "Please complete payment within 14 days.",
      paymentInfo: "Bank Mandiri - 9876543210\nA/N Procurement & Co\nNPWP: 01.234.567.8-987.000",
      termsConditions: "Pembayaran jatuh tempo 14 hari\nBarang custom tidak dapat dikembalikan",
      templateDefaults: {
        quotation: "corporate-bold",
        salesOrder: "corporate-bold",
        invoice: "invoice-modern-indigo",
        deliveryNote: "corporate-bold",
      },
      modules: {
        sales: true,
        purchase: true,
        inventory: true,
      },
    },
  },
];

const createEmptyProfile = (overrides: Partial<BrandProfile> = {}): BrandProfile => ({
  id: overrides.id ?? "",
  name: overrides.name ?? "",
  logo: overrides.logo ?? "",
  primaryColor: overrides.primaryColor ?? "#000000",
  secondaryColor: overrides.secondaryColor ?? "#ffffff",
  description: overrides.description ?? "",
  website: overrides.website ?? "",
  email: overrides.email ?? "",
  address: overrides.address ?? "",
  phone: overrides.phone ?? "",
  footerText: overrides.footerText ?? "",
  paymentInfo: overrides.paymentInfo ?? "",
  termsConditions: overrides.termsConditions ?? "",
  showBrandName: overrides.showBrandName ?? true,
  showBrandDescription: overrides.showBrandDescription ?? true,
  showBrandEmail: overrides.showBrandEmail ?? true,
  showBrandWebsite: overrides.showBrandWebsite ?? true,
  showBrandAddress: overrides.showBrandAddress ?? true,
  numberFormats: { ...defaultNumberFormats, ...(overrides.numberFormats ?? {}) },
  templateDefaults: { ...defaultTemplateDefaults, ...(overrides.templateDefaults ?? {}) },
  isActive: overrides.isActive ?? false,
  modules: { ...defaultModules, ...(overrides.modules ?? {}) },
  signatureProfileId: overrides.signatureProfileId ?? "",
  signatureName: overrides.signatureName ?? "",
  signatureTitle: overrides.signatureTitle ?? "",
  signatureImageUrl: overrides.signatureImageUrl ?? "",
});

const extractSignatureMeta = (defaults: Record<string, string>) => {
  const meta: Record<SignatureMetaKey, string> = {
    signatureProfileId: defaults.signatureProfileId ?? "",
    signatureName: defaults.signatureName ?? "",
    signatureTitle: defaults.signatureTitle ?? "",
    signatureImageUrl: defaults.signatureImageUrl ?? "",
  };
  const cleaned = { ...defaults };
  SIGNATURE_META_KEYS.forEach((key) => {
    delete cleaned[key];
  });
  return { meta, cleaned };
};

const normalizeProfileFromApi = (profile: any): BrandProfile => {
  const templateDefaultsNormalized = normalizeTemplateDefaults(profile?.templateDefaults);
  const { meta, cleaned } = extractSignatureMeta(templateDefaultsNormalized);
  return {
    id: profile?.id !== undefined && profile?.id !== null ? String(profile.id) : "",
    name: profile?.name ?? "",
    logo: profile?.logo ?? profile?.logoUrl ?? "",
    primaryColor: profile?.primaryColor ?? "#000000",
    secondaryColor: profile?.secondaryColor ?? "#ffffff",
    description: profile?.description ?? profile?.overview ?? "",
    website: profile?.website ?? "",
    email: profile?.email ?? "",
    address: profile?.address ?? "",
    phone: profile?.phone ?? "",
    footerText: profile?.footerText ?? "",
    paymentInfo: profile?.paymentInfo ?? "",
    termsConditions: profile?.termsConditions ?? "",
    showBrandName: profile?.showBrandName ?? true,
    showBrandDescription: profile?.showBrandDescription ?? true,
    showBrandEmail: profile?.showBrandEmail ?? true,
    showBrandWebsite: profile?.showBrandWebsite ?? true,
    showBrandAddress: profile?.showBrandAddress ?? true,
    numberFormats: normalizeNumberFormats(profile?.numberFormats),
    templateDefaults: cleaned,
    isActive: Boolean(profile?.isActive),
    modules: normalizeModules(profile?.modules),
    signatureProfileId: meta.signatureProfileId,
    signatureName: meta.signatureName,
    signatureTitle: meta.signatureTitle,
    signatureImageUrl: meta.signatureImageUrl,
  };
};

const buildPayloadFromProfile = (profile: BrandProfile) => {
  const templateDefaultsWithSignature = normalizeTemplateDefaults({
    ...profile.templateDefaults,
    signatureProfileId: profile.signatureProfileId ?? "",
    signatureName: profile.signatureName ?? "",
    signatureTitle: profile.signatureTitle ?? "",
    signatureImageUrl: profile.signatureImageUrl ?? "",
  });

  const sanitizedProfile: BrandProfile = {
    ...profile,
    // Perlakuan seragam pada semua field saat submit: tanpa normalisasi
    name: profile.name ?? "",
    description: profile.description ?? "",
    footerText: profile.footerText ?? "",
    website: profile.website ?? "",
    email: profile.email ?? "",
    phone: profile.phone ?? "",
    address: profile.address ?? "",
    paymentInfo: profile.paymentInfo ?? "",
    termsConditions: profile.termsConditions ?? "",
  };

  return {
    ...sanitizedProfile,
    paymentInfo: sanitizedProfile.paymentInfo ?? "",
    termsConditions: sanitizedProfile.termsConditions ?? "",
    showBrandName: sanitizedProfile.showBrandName ?? true,
    showBrandDescription: sanitizedProfile.showBrandDescription ?? true,
    showBrandEmail: sanitizedProfile.showBrandEmail ?? true,
    showBrandWebsite: sanitizedProfile.showBrandWebsite ?? true,
    showBrandAddress: sanitizedProfile.showBrandAddress ?? true,
    templateDefaults: templateDefaultsWithSignature,
    numberFormats: normalizeNumberFormats(profile.numberFormats),
    modules: buildModulesPayload(profile.modules),
  };
};

const notifyBrandModulesUpdated = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("brand-modules:updated"));
  }
};

function BrandSettingsPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  const [profiles, setProfiles] = useState<BrandProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [updatingActiveId, setUpdatingActiveId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { isOpen, openModal, closeModal } = useModal();
  const [editingProfile, setEditingProfile] = useState<BrandProfile | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [profileToDelete, setProfileToDelete] = useState<BrandProfile | null>(null);
  const [signatureProfiles, setSignatureProfiles] = useState<SignatureProfileOption[]>([]);
  const [signatureLoading, setSignatureLoading] = useState(false);
  const [signatureError, setSignatureError] = useState<string | null>(null);

  const [formData, setFormData] = useState<BrandProfile>(createEmptyProfile());
  const paymentPreviewLines = (formData.paymentInfo ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const termsPreviewLines = (formData.termsConditions ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const showBrandName = formData.showBrandName ?? true;
  const showBrandDescription = formData.showBrandDescription ?? true;
  const showBrandEmail = formData.showBrandEmail ?? true;
  const showBrandWebsite = formData.showBrandWebsite ?? true;
  const showBrandAddress = formData.showBrandAddress ?? true;
  const selectedSignatureProfile = useMemo(() => {
    if (!formData.signatureProfileId) return undefined;
    return signatureProfiles.find(
      (profile) => String(profile.id) === String(formData.signatureProfileId)
    );
  }, [formData.signatureProfileId, signatureProfiles]);

  const fetchProfiles = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true;
    if (!silent) {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await fetch("/api/brand-profiles");

      if (!response.ok) {
        if (response.status === 404) {
          console.log("No brand profiles found - initializing empty state");
          setProfiles([]);
          setFormData(createEmptyProfile());
          if (!silent) {
            setLoading(false);
          }
          return;
        }

        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `HTTP ${response.status}: Failed to fetch brand profiles`
        );
      }

      const data = await response.json();

      let loadedProfiles: any[] = [];

      if (Array.isArray(data)) {
        loadedProfiles = data;
      } else if (Array.isArray(data?.profiles)) {
        loadedProfiles = data.profiles;
      } else if (Array.isArray(data?.data)) {
        loadedProfiles = data.data;
      } else if (data) {
        loadedProfiles = [data];
      }

      if (loadedProfiles.length > 0) {
        const normalizedProfiles = loadedProfiles.map(normalizeProfileFromApi);
        const activeProfile =
          normalizedProfiles.find((p) => p.isActive) ?? normalizedProfiles[0] ?? null;

        const finalProfiles = normalizedProfiles.map((profile) => ({
          ...profile,
          isActive: activeProfile ? profile.id === activeProfile.id : false,
        }));

        setProfiles(finalProfiles);

        if (activeProfile) {
          setFormData(activeProfile);
        } else {
          setFormData(createEmptyProfile());
        }
      } else {
        setProfiles([]);
        setFormData(createEmptyProfile());
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load brand data. Please try again.";
      console.error("Error fetching brand profiles:", err);
      setError(errorMessage);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  const fetchSignatureProfiles = useCallback(async () => {
    try {
      setSignatureLoading(true);
      setSignatureError(null);
      const response = await fetch("/api/signature-profiles", { cache: "no-store" });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || json?.success === false) {
        throw new Error(json?.error || "Failed to load signature profiles");
      }
      const rows: SignatureProfileOption[] = Array.isArray(json?.data) ? json.data : [];
      setSignatureProfiles(rows);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load signature profiles";
      setSignatureError(message);
    } finally {
      setSignatureLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  useEffect(() => {
    fetchSignatureProfiles();
  }, [fetchSignatureProfiles]);

  useEffect(() => {
    if (!formData.signatureProfileId) return;
    const profile = signatureProfiles.find(
      (item) => String(item.id) === String(formData.signatureProfileId)
    );
    if (!profile) return;
    if (
      profile.imageUrl !== formData.signatureImageUrl ||
      profile.name !== formData.signatureName ||
      (profile.title ?? "") !== (formData.signatureTitle ?? "")
    ) {
      setFormData((prev) => ({
        ...prev,
        signatureName: profile.name,
        signatureTitle: profile.title ?? "",
        signatureImageUrl: profile.imageUrl,
      }));
    }
  }, [signatureProfiles, formData.signatureProfileId, formData.signatureImageUrl, formData.signatureName, formData.signatureTitle]);

  // Fetch templates
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        setLoadingTemplates(true);
        const templatesData = await getAllTemplates();
        setTemplates(templatesData);
      } catch (error) {
        console.error('Error fetching templates:', error);
      } finally {
        setLoadingTemplates(false);
      }
    };

    fetchTemplates();
  }, []);

  // Whitespace normalization helpers
  const normalizeMultiline = (s: string) =>
    s
      .split(/\r?\n/)
      .map((l) => l.replace(/\s+/g, " ").trim())
      .filter((l) => l.length > 0)
      .join("\n");
  const normalizeEmail = (s: string) => s.trim();
  const normalizeUrl = (s: string) => s.trim();
  const normalizePhone = (s: string) => s.replace(/\s+/g, " ").trimStart();

  const handleInputChange = (field: keyof BrandProfile, value: string | boolean) => {
    // Terapkan perlakuan seragam: tanpa normalisasi saat mengetik untuk semua field
    setFormData((prev) => ({
      ...prev,
      [field]: value as any,
    }));
  };

  const handleSignatureSelection = (profileId: string) => {
    if (!profileId || profileId === "none") {
      setFormData((prev) => ({
        ...prev,
        signatureProfileId: "",
        signatureName: "",
        signatureTitle: "",
        signatureImageUrl: "",
      }));
      return;
    }
    const profile = signatureProfiles.find((item) => String(item.id) === profileId);
    setFormData((prev) => ({
      ...prev,
      signatureProfileId: profileId,
      signatureName: profile?.name ?? "",
      signatureTitle: profile?.title ?? "",
      signatureImageUrl: profile?.imageUrl ?? "",
    }));
  };

  const handleNestedInputChange = (parentField: keyof BrandProfile, childField: string, value: string) => {
    const normalizedChild = value;
    setFormData((prev) => ({
      ...prev,
      [parentField]: {
        ...(prev[parentField] as any),
        [childField]: normalizedChild,
      },
    }));
  };

  const handleTemplateDefaultChange = (childField: TemplateDefaultKey, value: string) => {
    if (value === MANAGE_TEMPLATES_VALUE) {
      if (typeof window !== "undefined") {
        window.open("/template-branding/template-manager", "_blank");
      }
      return;
    }

    handleNestedInputChange("templateDefaults", childField, value);
  };

  const handleModuleToggle = (moduleKey: ModuleKey, value: boolean) => {
    setFormData((prev) => {
      const currentModules = buildModulesPayload(prev.modules);
      const updated: Record<string, boolean> = {
        ...currentModules,
        [moduleKey]: value,
      };
      // Apply bulk toggle to all features under the module
      FEATURES_BY_MODULE[moduleKey].forEach(({ key }) => {
        updated[key] = value;
      });
      return {
        ...prev,
        modules: updated,
      };
    });
  };

  const handleFeatureToggle = (featureKey: FeatureKey, value: boolean) => {
    setFormData((prev) => {
      const currentModules = buildModulesPayload(prev.modules);
      const updated: Record<string, boolean> = {
        ...currentModules,
        [featureKey]: value,
      };
      // Sync top-level module state based on at least one feature enabled
      const [moduleKey] = featureKey.split(".") as [ModuleKey, string];
      const anyEnabled = FEATURES_BY_MODULE[moduleKey].some(({ key }) => updated[key]);
      updated[moduleKey] = anyEnabled;
      return {
        ...prev,
        modules: updated,
      };
    });
  };

  const handleSetActive = async (profile: BrandProfile, isActive: boolean) => {
    if (!profile.id) {
      return;
    }

    if (isActive) {
      setFormData(profile);
    }

    setUpdatingActiveId(profile.id);
    setError(null);

    try {
      const payloadProfile = buildPayloadFromProfile(profile);
      const payload = {
        ...payloadProfile,
        id: profile.id,
        isActive,
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
        throw new Error(errorData.message || "Failed to update brand profile.");
      }

      const updatedProfile = normalizeProfileFromApi(await response.json());

      setProfiles((prev) =>
        prev.map((p) => {
          if (p.id === updatedProfile.id) {
            return updatedProfile;
          }
          if (updatedProfile.isActive) {
            return { ...p, isActive: false };
          }
          return p;
        })
      );

      setFormData((prev) => {
        if (prev.id === updatedProfile.id || updatedProfile.isActive) {
          return updatedProfile;
        }
        return prev;
      });

      await fetchProfiles({ silent: true });
      notifyBrandModulesUpdated();

      toast.success(
        updatedProfile.isActive ? "Brand profile set as active." : "Brand profile updated."
      );
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to update brand profile. Please try again.";
      console.error("Error updating brand profile:", err);
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setUpdatingActiveId(null);
    }
  };

  const handleDelete = async () => {
    if (!profileToDelete?.id) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/brand-profiles?id=${encodeURIComponent(profileToDelete.id)}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to delete brand profile.");
      }

      setProfiles((prev) => prev.filter((p) => p.id !== profileToDelete.id));

      setShowDeleteModal(false);
      setProfileToDelete(null);

      await fetchProfiles({ silent: true });
      notifyBrandModulesUpdated();

      toast.success("Brand profile deleted successfully.");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to delete brand profile. Please try again.";
      console.error("Error deleting brand profile:", err);
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setDeleting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const payloadProfile = buildPayloadFromProfile(formData);
      const method = editingProfile ? "PUT" : "POST";
      const payload = {
        ...payloadProfile,
        id: editingProfile ? payloadProfile.id : undefined,
      };

      const response = await fetch("/api/brand-profiles", {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to save brand profile`);
      }

      const savedProfile = normalizeProfileFromApi(await response.json());

      setProfiles((prev) => {
        if (editingProfile) {
          return prev.map((p) => {
            if (p.id === savedProfile.id) {
              return savedProfile;
            }
            if (savedProfile.isActive) {
              return { ...p, isActive: false };
            }
            return p;
          });
        }

        const updated = savedProfile.isActive
          ? prev.map((p) => ({ ...p, isActive: false }))
          : [...prev];

        return [...updated, savedProfile];
      });

      setFormData(savedProfile);

      // Close modal
      closeModal();
      setEditingProfile(null);

      await fetchProfiles({ silent: true });
      if (savedProfile.isActive) {
        notifyBrandModulesUpdated();
      }

      // Show success message
      toast.success(editingProfile ? "Brand profile updated successfully" : "Brand profile created successfully");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to save brand settings. Please try again.";
      console.error("Error saving brand settings:", err);
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Create FormData for upload
      const formDataUpload = new FormData();
      formDataUpload.append("logo", file);

      try {
        // Upload file to server
        const uploadResponse = await fetch("/api/upload/logo", {
          method: "POST",
          body: formDataUpload,
        });

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to upload logo");
        }

        const uploadResult = await uploadResponse.json();

        // Update form data with the uploaded file URL
        setFormData((prev) => ({
          ...prev,
          logo: uploadResult.url,
        }));

        toast.success("Logo uploaded successfully");
      } catch (error) {
        console.error("Error uploading logo:", error);
        const errorMessage = error instanceof Error ? error.message : "Failed to upload logo";
        toast.error(errorMessage);
      }
    }
  };

  // Loading State
  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Loading brand settings...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error State with Retry
  if (error && profiles.length === 0) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card className="border-destructive">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <CardTitle className="text-destructive">Error Loading Brand Settings</CardTitle>
            </div>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => fetchProfiles()} variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
        <div className="space-y-8">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-50 to-purple-50 rounded-full border border-blue-200">
            <Crown className="h-5 w-5 text-blue-600" />
            <span className="text-sm font-medium text-blue-700">Brand Management</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
            Brand Settings
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Manage your brand identity, configure document templates, and customize numbering formats for a professional appearance
          </p>
        </div>

        {error && (
          <Card className="border-destructive bg-destructive/5">
            <CardContent className="pt-6">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-destructive">Error</p>
                  <p className="text-sm text-muted-foreground mt-1">{error}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Brand Profiles Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {profiles.map((profile) => (
            <Card
              key={profile.id}
              className={`relative overflow-hidden transition-all duration-300 hover:shadow-xl border-2 ${
                profile.isActive
                  ? 'border-blue-500 shadow-lg shadow-blue-100 bg-gradient-to-br from-blue-50 to-white'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {profile.isActive && (
                <div className="absolute top-4 right-4">
                  <div className="flex items-center gap-1 px-2 py-1 bg-blue-500 text-white text-xs font-medium rounded-full">
                    <Star className="h-3 w-3 fill-current" />
                    Active
                  </div>
                </div>
              )}

              <CardHeader className="pb-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white shadow-lg overflow-hidden flex-shrink-0">
                    {profile.logo ? (
                      <img src={profile.logo} alt={`${profile.name} logo`} className="w-full h-full object-contain" />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center text-white font-bold text-lg"
                        style={{ backgroundColor: profile.primaryColor }}
                      >
                        {profile.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg font-bold truncate">{profile.name}</CardTitle>
                    <CardDescription className="text-sm mt-1 line-clamp-2">
                      {profile.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Primary</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div
                        className="w-4 h-4 rounded border border-gray-300"
                        style={{ backgroundColor: profile.primaryColor }}
                      />
                      <span className="font-mono text-xs">{profile.primaryColor}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Template</p>
                    <p className="font-medium capitalize mt-1">
                      {profile.templateDefaults?.invoice || 'Default'}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {MODULE_OPTIONS.map(({ key, label }) => {
                    const enabled = profile.modules?.[key] ?? defaultModules[key];
                    return (
                      <span
                        key={key}
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          enabled ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {label}
                      </span>
                    );
                  })}
                </div>

                <div className="mt-4 rounded-lg border border-dashed border-gray-200 bg-gray-50 p-3 flex items-center gap-3">
                  {profile.signatureImageUrl ? (
                    <img
                      src={profile.signatureImageUrl}
                      alt={`${profile.signatureName ?? "Signature"} preview`}
                      className="h-12 w-auto max-w-[96px] object-contain rounded-sm bg-white p-1"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-gray-100 text-gray-400 text-xs font-semibold flex items-center justify-center">
                      SIG
                    </div>
                  )}
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Signature</p>
                    {profile.signatureProfileId ? (
                      <p className="text-sm text-gray-700">
                        {profile.signatureName || "Tanpa nama"}
                        {profile.signatureTitle ? ` (${profile.signatureTitle})` : ""}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-500">Belum terhubung</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={!!profile.isActive}
                      onCheckedChange={(checked) => {
                        if (checked === !!profile.isActive) {
                          return;
                        }
                        handleSetActive(profile, checked);
                      }}
                      disabled={updatingActiveId === profile.id}
                      className="data-[state=checked]:bg-blue-500"
                    />
                    <span className="text-sm text-muted-foreground">Active</span>
                  </div>

                <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setFormData(profile);
                        setEditingProfile(profile);
                        openModal();
                      }}
                      className="text-xs"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setProfileToDelete(profile);
                        setShowDeleteModal(true);
                      }}
                      className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Add New Profile Card */}
          <Card className="border-2 border-dashed border-gray-300 hover:border-blue-400 transition-colors cursor-pointer group">
            <CardContent className="flex flex-col items-center justify-center h-full min-h-[280px] text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 group-hover:bg-blue-50 flex items-center justify-center mb-4 transition-colors">
                <Plus className="h-8 w-8 text-gray-400 group-hover:text-blue-500" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Add New Brand</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create a new brand profile for your business
              </p>
              <Button
                onClick={() => {
                  setFormData(
                    createEmptyProfile({
                      primaryColor: "#0EA5E9",
                      secondaryColor: "#ECFEFF",
                    })
                  );
                  setEditingProfile(null);
                  openModal();
                }}
                className="w-full"
              >
                Create Brand Profile
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Document Preview */}
        <Card className="bg-gradient-to-br from-gray-50 to-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-blue-600" />
              Document Preview
            </CardTitle>
            <CardDescription>
              See how your active brand settings will appear on documents
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-8 lg:grid-cols-2">
              {/* Header Preview */}
              <div className="space-y-4">
                <h4 className="font-semibold text-lg">Header Preview</h4>
                <div
                  className="border-2 rounded-xl p-6 shadow-lg"
                  style={{ borderColor: formData.primaryColor, backgroundColor: formData.secondaryColor }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {formData.logo ? (
                        <img
                          src={formData.logo}
                          alt="Brand logo"
                          className="h-20 w-auto max-w-[120px] object-contain rounded-lg bg-white p-1 border"
                        />
                      ) : (
                        <div
                          className="w-14 h-14 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-md"
                          style={{ backgroundColor: formData.primaryColor }}
                        >
                          {formData.name?.charAt(0) || 'B'}
                        </div>
                      )}
                      <div>
                        {showBrandName && (
                          <h3
                            className="text-2xl font-bold"
                            style={{ color: formData.primaryColor }}
                          >
                            {formData.name || "Your Brand Name"}
                          </h3>
                        )}
                        {showBrandDescription && (
                          <p className="text-sm text-gray-600 mt-1">
                            {formData.description || "Brand description will appear here"}
                          </p>
                        )}
                        {!showBrandName && !showBrandDescription && (
                          <p className="text-xs text-muted-foreground italic">
                            Brand name & description akan disembunyikan di PDF.
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-sm text-gray-600">
                      <p className="font-medium">{formData.phone}</p>
                      <p>{formData.email}</p>
                      <p className="truncate max-w-48">{formData.website}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Document Sample */}
              <div className="space-y-4">
                <h4 className="font-semibold text-lg">Sample Invoice</h4>
                <div className="border rounded-xl p-6 shadow-lg bg-white">
                  <div className="space-y-4">
                    {/* Document Header with Logo */}
                    <div className="flex items-center justify-between pb-4 border-b">
                      <div className="flex items-center gap-4">
                        {formData.logo ? (
                          <img
                            src={formData.logo}
                            alt="Brand logo"
                            className="h-16 w-auto max-w-[100px] object-contain rounded-lg bg-white p-1 border"
                          />
                        ) : (
                          <div
                            className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-md"
                            style={{ backgroundColor: formData.primaryColor }}
                          >
                            {formData.name?.charAt(0) || 'B'}
                          </div>
                        )}
                        <div>
                          <span className="font-semibold text-lg">Invoice</span>
                          {showBrandName ? (
                            <p className="text-sm text-muted-foreground mt-1">
                              {formData.name || "Your Brand Name"}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground italic mt-1">
                              Nama brand disembunyikan pada PDF
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground font-mono">
                        {formData.numberFormats?.invoice?.replace('{YYYY}', '2025').replace('{0000}', '0001') || 'INV-2025-0001'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="font-medium text-gray-900">Bill To:</p>
                        <p className="text-gray-600 mt-1">Customer Name<br />Customer Address</p>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Invoice Details:</p>
                        <p className="text-gray-600 mt-1">
                          {(() => {
                            const formatDate = (d: Date) => {
                              const y = d.getFullYear();
                              const m = String(d.getMonth() + 1).padStart(2, "0");
                              const day = String(d.getDate()).padStart(2, "0");
                              // Deterministic date string (DD/MM/YYYY), independent of locale
                              return `${day}/${m}/${y}`;
                            };
                            const addDays = (d: Date, days: number) => {
                              const copy = new Date(d);
                              copy.setDate(copy.getDate() + days);
                              return copy;
                            };
                            const today = new Date();
                            const due = addDays(today, 30);
                            return (
                              <>
                                Date: {formatDate(today)}<br />
                                Due Date: {formatDate(due)}
                              </>
                            );
                          })()}
                        </p>
                      </div>
                    </div>

                    <div className="border-t pt-4 space-y-2">
                      <p className="text-sm text-gray-600 italic">
                        {formData.footerText || "Thank you for your business"}
                      </p>
                      {paymentPreviewLines.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            Payment Info
                          </p>
                          <p className="text-xs text-gray-600 whitespace-pre-line">
                            {paymentPreviewLines.slice(0, 3).join("\n")}
                            {paymentPreviewLines.length > 3 ? "\n..." : ""}
                          </p>
                        </div>
                      )}
                      {termsPreviewLines.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            Terms & Conditions
                          </p>
                          <p className="text-xs text-gray-600 whitespace-pre-line">
                            {termsPreviewLines.slice(0, 4).join("\n")}
                            {termsPreviewLines.length > 4 ? "\n..." : ""}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Modal for Add/Edit Profile */}
        <Modal isOpen={isOpen} onClose={closeModal} className="max-w-6xl max-h-[95vh] overflow-hidden">
          <div className="flex flex-col h-full max-h-[95vh]">
            {/* Modal Header - Fixed */}
            <div className="flex-shrink-0 p-4 border-b bg-gradient-to-r from-blue-50 to-purple-50">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingProfile ? "Edit Brand Profile" : "Create New Brand Profile"}
              </h2>
              <p className="text-muted-foreground mt-1">
                Configure your brand identity and document settings
              </p>
            </div>

            {/* Modal Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-6">
                {/* Preset Quick Actions */}
                <Card className="border-l-4 border-l-indigo-500">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-indigo-500 rounded-full"></div>
                      Gunakan Preset Cepat
                    </CardTitle>
                    <CardDescription>
                      Terapkan preset untuk mengisi kombinasi warna, modul, dan template utama secara instan. Anda masih bisa menyesuaikannya setelah dipilih.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    {BRAND_PRESETS.map((preset) => (
                      <div key={preset.id} className="rounded-xl border border-gray-200 p-4 flex flex-col justify-between">
                        <div className="space-y-2">
                          <h3 className="text-sm font-semibold text-gray-900">{preset.label}</h3>
                          <p className="text-xs text-muted-foreground">{preset.description}</p>
                          <div className="flex gap-2">
                            <span
                              className="h-6 w-6 rounded-full border"
                              style={{ backgroundColor: preset.overrides.primaryColor }}
                              title="Primary color"
                            />
                            <span
                              className="h-6 w-6 rounded-full border"
                              style={{ backgroundColor: preset.overrides.secondaryColor }}
                              title="Secondary color"
                            />
                          </div>
                          <div className="flex flex-wrap gap-1 pt-1">
                            {MODULE_OPTIONS.map(({ key, label }) => {
                              const enabled = preset.overrides.modules?.[key] ?? defaultModules[key];
                              return (
                                <span
                                  key={key}
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                    enabled ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                                  }`}
                                >
                                  {label}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                        <Button
                          onClick={() => {
                            setFormData((prev) => {
                              const currentModules = normalizeModules(prev.modules);
                              return {
                                ...prev,
                                primaryColor: preset.overrides.primaryColor ?? prev.primaryColor,
                                secondaryColor: preset.overrides.secondaryColor ?? prev.secondaryColor,
                                footerText: preset.overrides.footerText ?? prev.footerText,
                                paymentInfo: preset.overrides.paymentInfo ?? prev.paymentInfo,
                                termsConditions: preset.overrides.termsConditions ?? prev.termsConditions,
                                showBrandName:
                                  preset.overrides.showBrandName ?? (prev.showBrandName ?? true),
                                showBrandDescription:
                                  preset.overrides.showBrandDescription ?? (prev.showBrandDescription ?? true),
                                templateDefaults: {
                                  ...prev.templateDefaults,
                                  ...(preset.overrides.templateDefaults ?? {}),
                                },
                                modules: {
                                  ...currentModules,
                                  ...(preset.overrides.modules ?? {}),
                                },
                              };
                            });
                          }}
                          variant="outline"
                          className="mt-4"
                        >
                          Terapkan Preset
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Brand Identity Card */}
                <Card className="border-l-4 border-l-blue-500">
                  <CardHeader className="p-4">
                    <CardTitle className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      Brand Identity
                    </CardTitle>
                    <CardDescription>
                      Rapikan dan lengkapi identitas brand serta informasi kontak
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5 p-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor="modal-brand-name" className="text-sm font-semibold">Nama Brand *</Label>
                          <Input
                            id="modal-brand-name"
                            placeholder="Masukkan nama brand"
                            value={formData.name}
                            onChange={(e) => handleInputChange("name", e.target.value)}
                            className="border-2 focus:border-blue-500 py-1.5 px-3 h-9"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="modal-description" className="text-sm font-semibold">Deskripsi Brand</Label>
                          <Textarea
                            id="modal-description"
                            placeholder="Jelaskan misi, layanan, atau nilai brand"
                            value={formData.description}
                            onChange={(e) => handleInputChange("description", e.target.value)}
                            rows={3}
                            className="border-2 focus:border-blue-500 py-2 px-3"
                          />
                        </div>

                        {/* Alamat dipindahkan di bawah Deskripsi Brand */}
                        <div className="space-y-2">
                          <Label htmlFor="modal-address" className="text-sm font-semibold">Alamat</Label>
                          <Textarea
                            id="modal-address"
                            placeholder="Masukkan alamat lengkap usaha/perusahaan"
                            value={formData.address}
                            onChange={(e) => handleInputChange("address", e.target.value)}
                            rows={3}
                            className="border-2 focus:border-blue-500 py-2 px-3"
                          />
                        </div>

                        <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3 space-y-2">
                          <p className="text-sm font-semibold text-blue-900">Opsi Tampilan PDF</p>
                          <div className="space-y-2">
                            <Checkbox
                              id="modal-show-brand-name"
                              label="Tampilkan nama brand pada PDF"
                              checked={showBrandName}
                              onChange={(checked) => handleInputChange("showBrandName", checked)}
                            />
                            <Checkbox
                              id="modal-show-brand-description"
                              label="Tampilkan deskripsi brand pada PDF"
                              checked={showBrandDescription}
                              onChange={(checked) => handleInputChange("showBrandDescription", checked)}
                            />
                            <Checkbox
                              id="modal-show-brand-email"
                              label="Tampilkan email pada PDF"
                              checked={showBrandEmail}
                              onChange={(checked) => handleInputChange("showBrandEmail", checked)}
                            />
                            <Checkbox
                              id="modal-show-brand-website"
                              label="Tampilkan website pada PDF"
                              checked={showBrandWebsite}
                              onChange={(checked) => handleInputChange("showBrandWebsite", checked)}
                            />
                            <Checkbox
                              id="modal-show-brand-address"
                              label="Tampilkan alamat pada PDF"
                              checked={showBrandAddress}
                              onChange={(checked) => handleInputChange("showBrandAddress", checked)}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label htmlFor="modal-primary-color" className="text-sm font-semibold">Primary Color</Label>
                            <div className="flex gap-2">
                              <Input
                                id="modal-primary-color"
                                type="color"
                                value={formData.primaryColor}
                                onChange={(e) => handleInputChange("primaryColor", e.target.value)}
                                className="w-14 h-9 cursor-pointer border-2"
                              />
                              <Input
                                type="text"
                                value={formData.primaryColor}
                                onChange={(e) => handleInputChange("primaryColor", e.target.value)}
                                placeholder="#000000"
                                className="flex-1 border-2 focus:border-blue-500 py-1.5 px-3 h-9"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="modal-secondary-color" className="text-sm font-semibold">Secondary Color</Label>
                            <div className="flex gap-2">
                              <Input
                                id="modal-secondary-color"
                                type="color"
                                value={formData.secondaryColor}
                                onChange={(e) => handleInputChange("secondaryColor", e.target.value)}
                                className="w-14 h-9 cursor-pointer border-2"
                              />
                              <Input
                                type="text"
                                value={formData.secondaryColor}
                                onChange={(e) => handleInputChange("secondaryColor", e.target.value)}
                                placeholder="#ffffff"
                                className="flex-1 border-2 focus:border-blue-500 py-1.5 px-3 h-9"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      

                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor="modal-brand-logo" className="text-sm font-semibold">Brand Logo</Label>
                          <div className="flex items-start gap-4">
                            {formData.logo && (
                              <div className="relative h-14 w-14 border-2 rounded-lg overflow-hidden bg-muted flex-shrink-0 shadow-md">
                                <img
                                  src={formData.logo}
                                  alt="Brand logo preview"
                                  className="h-full w-full object-contain"
                                />
                              </div>
                            )}
                            <div className="flex-1">
                              <Input
                                id="modal-brand-logo"
                                type="file"
                                accept="image/*"
                                onChange={handleLogoUpload}
                                className="cursor-pointer border-2 focus:border-blue-500 py-1.5 px-3 h-9"
                              />
                              <p className="text-sm text-muted-foreground mt-2">
                                Unggah logo brand (PNG, JPG, atau SVG)
                              </p>
                            </div>
                          </div>
                        </div>


                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-gray-900">Informasi Kontak</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            <div className="space-y-2">
                              <Label htmlFor="modal-email" className="text-sm font-semibold">Email Kontak</Label>
                               <Input
                                 id="modal-email"
                                 type="email"
                                 placeholder="contact@example.com"
                                 value={formData.email}
                                 onChange={(e) => handleInputChange("email", e.target.value)}
                                 className="border-2 focus:border-blue-500 py-1.5 px-3 h-9"
                               />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="modal-phone" className="text-sm font-semibold">Telepon</Label>
                               <Input
                                 id="modal-phone"
                                 type="tel"
                                 placeholder="+62 812 3456 7890"
                                 value={formData.phone}
                                 onChange={(e) => handleInputChange("phone", e.target.value)}
                                 className="border-2 focus:border-blue-500 py-1.5 px-3 h-9"
                               />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="modal-website" className="text-sm font-semibold">Website</Label>
                               <Input
                                 id="modal-website"
                                 type="url"
                                 placeholder="https://contoh.com"
                                 value={formData.website}
                                 onChange={(e) => handleInputChange("website", e.target.value)}
                                 className="border-2 focus:border-blue-500 py-1.5 px-3 h-9"
                               />
                            </div>
                          </div>

                        </div>

                        {/* Kembalikan Footer, Payment, Terms sebagai section terpisah setelah kontak */}
                        <div className="space-y-2">
                          <Label htmlFor="modal-footer-text" className="text-sm font-semibold">Footer Text</Label>
                          <Textarea
                            id="modal-footer-text"
                            placeholder="Enter footer text for documents"
                            value={formData.footerText}
                            onChange={(e) => handleInputChange("footerText", e.target.value)}
                            rows={2}
                            className="border-2 focus:border-blue-500 py-2 px-3"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="modal-payment-info" className="text-sm font-semibold">Payment Information</Label>
                          <Textarea
                            id="modal-payment-info"
                            placeholder="Account details, bank, or payment instructions"
                            value={formData.paymentInfo || ""}
                            onChange={(e) => handleInputChange("paymentInfo", e.target.value)}
                            rows={3}
                            className="border-2 focus:border-blue-500 py-2 px-3"
                          />
                          <p className="text-xs text-muted-foreground">
                            Gunakan baris terpisah untuk setiap informasi, contoh:
                            {"\n"}Bank ABC - 1234567890{"\n"}A/N PT Contoh{"\n"}SWIFT: ABCDIDJA
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="modal-terms-conditions" className="text-sm font-semibold">Terms &amp; Conditions</Label>
                          <Textarea
                            id="modal-terms-conditions"
                            placeholder="Ketentuan pembayaran, garansi, atau catatan tambahan untuk PDF"
                            value={formData.termsConditions || ""}
                            onChange={(e) => handleInputChange("termsConditions", e.target.value)}
                            rows={3}
                            className="border-2 focus:border-blue-500 py-2 px-3"
                          />
                          <p className="text-xs text-muted-foreground">
                            Tulis satu poin per baris agar mudah dibaca pada PDF.
                          </p>
                        </div>
                      </div>
                    </div>

                    
                  </CardContent>
                </Card>

                {/* Number Formats Card */}
                <Card className="border-l-4 border-l-green-500">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      Number Formats
                    </CardTitle>
                    <CardDescription>
                      Configure numbering formats for documents. Use {`{BRAND}`}, {`{YYYY}`}, {`{MM}`}, {`{SEQ4}`} as placeholders.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="modal-quotation-format" className="text-sm font-semibold">Quotation Format</Label>
                          <Input
                            id="modal-quotation-format"
                            placeholder="QUO-{YYYY}-{0000}"
                            value={formData.numberFormats?.quotation || ""}
                            onChange={(e) => handleNestedInputChange("numberFormats", "quotation", e.target.value)}
                            className="border-2 focus:border-green-500 font-mono"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="modal-sales-order-format" className="text-sm font-semibold">Sales Order Format</Label>
                          <Input
                            id="modal-sales-order-format"
                            placeholder="SO-{YYYY}-{0000}"
                            value={formData.numberFormats?.salesOrder || ""}
                            onChange={(e) => handleNestedInputChange("numberFormats", "salesOrder", e.target.value)}
                            className="border-2 focus:border-green-500 font-mono"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="modal-invoice-format" className="text-sm font-semibold">Invoice Format</Label>
                          <Input
                            id="modal-invoice-format"
                            placeholder="INV-{YYYY}-{0000}"
                            value={formData.numberFormats?.invoice || ""}
                            onChange={(e) => handleNestedInputChange("numberFormats", "invoice", e.target.value)}
                            className="border-2 focus:border-green-500 font-mono"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="modal-delivery-note-format" className="text-sm font-semibold">Delivery Note Format</Label>
                          <Input
                            id="modal-delivery-note-format"
                            placeholder="DN-{YYYY}-{0000}"
                            value={formData.numberFormats?.deliveryNote || ""}
                            onChange={(e) => handleNestedInputChange("numberFormats", "deliveryNote", e.target.value)}
                            className="border-2 focus:border-green-500 font-mono"
                          />
                        </div>
                      </div>

                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h4 className="font-semibold text-blue-900 mb-2">Format Examples:</h4>
                        <div className="text-sm text-blue-800 space-y-1">
                          <p><strong>Current:</strong> {formData.numberFormats?.invoice?.replace('{YYYY}', '2025').replace('{0000}', '0001') || 'INV-2025-0001'}</p>
                          <p><strong>Variables:</strong> {`{BRAND}`} = 3-letter code, {`{YYYY}`} = Year, {`{MM}`} = Month, {`{SEQ4}`} = 4-digit sequence</p>
                        </div>
                      </div>
                    </div>
                </CardContent>
              </Card>

              {/* Template Defaults Card */}
              <Card className="border-l-4 border-l-purple-500 relative overflow-visible">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                      Template Selection
                    </CardTitle>
                    <CardDescription>
                      Choose default templates for each document type
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="relative overflow-visible">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
                      {([
                        { key: 'quotation', label: 'Quotation Template', icon: '📄' },
                        { key: 'salesOrder', label: 'Sales Order Template', icon: '📋' },
                        { key: 'invoice', label: 'Invoice Template', icon: '🧾' },
                        { key: 'deliveryNote', label: 'Delivery Note Template', icon: '🚚' },
                      ] as Array<{ key: TemplateDefaultKey; label: string; icon: string }>)
                      .map(({ key, label, icon }) => (
                        <div key={key} className="space-y-3">
                          <Label className="text-sm font-semibold flex items-center gap-2">
                            <span>{icon}</span>
                            {label}
                          </Label>
                          {loadingTemplates ? (
                            <div className="flex items-center justify-center py-2">
                              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                              <span className="ml-2 text-sm text-gray-500">Loading templates...</span>
                            </div>
                          ) : (
                            <>
                              <Select
                                value={formData.templateDefaults?.[key] ?? "default"}
                                onValueChange={(value) => handleTemplateDefaultChange(key, value)}
                              >
                                <SelectTrigger className="border-2 focus:border-purple-500 relative z-10">
                                  <SelectValue placeholder="Select template" />
                                </SelectTrigger>
                                <SelectContent position="item-aligned" usePortal={false} className="z-[10000]">
                                  <SelectItem value="default">No default template</SelectItem>
                                      {templates
                                        .filter((template) => {
                                          const docType = TEMPLATE_FIELD_TO_DOC_TYPE[key];
                                          return (
                                            template.type === "universal" ||
                                            template.type === docType
                                          );
                                        })
                                        .map((template) => (
                                          <SelectItem key={template.id} value={String(template.id)}>
                                            {template.name} {template.isUploaded ? '(Custom)' : '(Built-in)'}
                                          </SelectItem>
                                        ))}
                                  <SelectItem value="manage-templates" className="text-blue-600 font-medium">
                                    Manage Templates (open manager)
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                </CardContent>
              </Card>

              {/* Signature Settings Card */}
              <Card className="border-l-4 border-l-sky-500 relative overflow-visible">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-sky-500 rounded-full"></div>
                    Signature Settings
                  </CardTitle>
                  <CardDescription>
                    Hubungkan tanda tangan digital dengan profil brand untuk digunakan di dokumen.
                  </CardDescription>
                </CardHeader>
                <CardContent className="relative overflow-visible">
                  <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] relative">
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">Signature Profile</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Pilih profil signature yang akan muncul di PDF penjualan.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => fetchSignatureProfiles()}
                            disabled={signatureLoading}
                            aria-label="Refresh signature profiles"
                          >
                            <RefreshCw className={`h-4 w-4 ${signatureLoading ? "animate-spin" : ""}`} />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open("/template-branding/template-manager?tab=signatures", "_blank")}
                          >
                            Kelola Signature
                          </Button>
                        </div>
                      </div>

                      {signatureError ? (
                        <p className="text-xs text-red-600">{signatureError}</p>
                      ) : null}

                      {signatureLoading ? (
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Memuat daftar signature...
                        </div>
                      ) : signatureProfiles.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600 space-y-3">
                          <p>Belum ada signature profile yang tersedia.</p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open("/template-branding/template-manager?tab=signatures", "_blank")}
                          >
                            Buat Signature Baru
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <Select
                            value={formData.signatureProfileId ?? ""}
                            onValueChange={handleSignatureSelection}
                          >
                            <SelectTrigger className="border-2 focus:border-sky-500 relative z-10">
                              <SelectValue placeholder="Pilih signature profile" />
                            </SelectTrigger>
                          <SelectContent position="item-aligned" usePortal={false} className="z-[10000]">
                              <SelectItem value="none">Tanpa signature</SelectItem>
                              {signatureProfiles.map((profile) => (
                                <SelectItem key={profile.id} value={String(profile.id)}>
                                  {profile.name}
                                  {profile.title ? ` - ${profile.title}` : ""}
                                </SelectItem>
                              ))}
                          </SelectContent>
                          </Select>
                          {formData.signatureProfileId && !selectedSignatureProfile && (
                            <p className="text-xs text-amber-600">
                              Signature tidak ditemukan. Muat ulang daftar atau pilih signature lain.
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 flex flex-col items-center justify-center text-center gap-3">
                      {selectedSignatureProfile?.imageUrl ? (
                        <>
                          <img
                            src={selectedSignatureProfile.imageUrl}
                            alt={selectedSignatureProfile.name}
                            className="max-h-24 object-contain"
                          />
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-gray-700">{selectedSignatureProfile.name}</p>
                            {selectedSignatureProfile.title ? (
                              <p className="text-xs text-gray-500">{selectedSignatureProfile.title}</p>
                            ) : null}
                          </div>
                        </>
                      ) : formData.signatureProfileId ? (
                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-gray-700">Preview tidak tersedia</p>
                          <p className="text-xs text-gray-500">
                            Muat ulang daftar atau perbarui signature di Template Manager.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-gray-700">Belum memilih signature</p>
                          <p className="text-xs text-gray-500">
                            Hubungkan signature agar informasi penandatangan muncul otomatis di dokumen.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Feature Modules Card */}
              <Card className="border-l-4 border-l-amber-500">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                    Feature Modules
                  </CardTitle>
                  <CardDescription>
                    Tentukan modul apa saja yang aktif pada profil brand ini.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    {MODULE_OPTIONS.map(({ key, label, description, Icon }) => {
                      const isEnabled = (formData.modules?.[key] ?? defaultModules[key]) === true;
                      return (
                        <div
                          key={key}
                          className={`rounded-xl border p-4 transition-shadow ${
                            isEnabled ? "border-green-400 shadow-md shadow-green-100" : "border-red-300"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <div
                                className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                                  isEnabled ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                                }`}
                              >
                                <Icon className="h-5 w-5" />
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900">{label}</p>
                                <p className="text-sm text-muted-foreground mt-1">{description}</p>
                              </div>
                            </div>
                            <Switch
                              checked={isEnabled}
                              onCheckedChange={(checked) => handleModuleToggle(key, checked)}
                              aria-label={`Toggle module ${label}`}
                              className="mt-1"
                            />
                          </div>
                          <div className="mt-3">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                isEnabled
                                  ? "bg-green-100 text-green-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {isEnabled ? "Aktif" : "Nonaktif"}
                            </span>
                          </div>

                          {/* Granular feature toggles */}
                          <div className="mt-4 grid grid-cols-1 gap-2">
                            {FEATURES_BY_MODULE[key].map(({ key: featureKey, label: featureLabel }) => {
                              const featureEnabled = Boolean(formData.modules?.[featureKey]);
                              return (
                                <div key={featureKey} className="flex items-center justify-between">
                                  <span className="text-sm text-gray-700">{featureLabel}</span>
                                  <Switch
                                    checked={featureEnabled}
                                    onCheckedChange={(checked) => handleFeatureToggle(featureKey, checked)}
                                    aria-label={`Toggle feature ${featureLabel}`}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

{/* Active Profile Toggle */}
<Card className="border-l-4 border-l-orange-500">
  <CardContent className="pt-6">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Star className="h-5 w-5 text-orange-600 fill-orange-300" />
        <Label htmlFor="modal-is-active" className="text-lg font-semibold text-orange-900">
          Set as Active Brand Profile
        </Label>
      </div>
      <Switch
        id="modal-is-active"
        checked={formData.isActive || false}
        onCheckedChange={(checked) => handleInputChange("isActive", checked)}
        className="data-[state=checked]:bg-orange-500"
      />
    </div>
    <p className="text-sm text-orange-800 mt-2">
      Only one profile can be set as active. This profile will be used as the default for new documents.
    </p>
  </CardContent>
</Card>

              </div>
            </div>

            {/* Modal Footer - Fixed */}
            <div className="flex-shrink-0 p-6 border-t flex justify-end gap-3 bg-gray-50">
              <Button variant="outline" onClick={closeModal}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving || !formData.name.trim()}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingProfile ? "Save Changes" : "Create Profile"}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)}>
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="h-6 w-6 text-red-500" />
              <h3 className="text-lg font-semibold">Confirm Deletion</h3>
            </div>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to delete the brand profile **{profileToDelete?.name}**? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
} // Close BrandSettingsPage function

export default BrandSettingsPage;







