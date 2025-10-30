"use client";

import { type ChangeEvent, type FormEvent, use, useMemo, useState, useEffect } from "react";
import Button from "@/components/ui/button/Button";
import { ArrowLeft, Check, FileText, Upload, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { getAllTemplates, Template, type DocumentType } from "@/lib/templates";

type TemplateOption = {
  id: string;
  name: string;
  description: string;
  accent: string;
};

type NumberFormatKey = "quotation" | "salesOrder" | "invoice" | "deliveryNote";

type TemplateDefaultKey = "invoice" | "kwitansi" | "deliveryNote";

type ModuleKey =
  | "sales.quotation"
  | "sales.order"
  | "sales.invoice"
  | "sales.receipt"
  | "sales.delivery"
  | "purchase"
  | "inventory";

type BrandProfile = {
  id: string;
  name: string;
  description: string;
  address: string;
  phone: string;
  email: string;
  website?: string;
  footer: string;
  paymentInfo: string;
  termsConditions: string;
  showBrandName: boolean;
  showBrandDescription: boolean;
  formats: Record<NumberFormatKey, string>;
  templates: Record<TemplateDefaultKey, string>;
  primaryColor: string;
  secondaryColor: string;
  templateOptionId: string;
  modules: Record<ModuleKey, boolean>;
};

const templateOptions: TemplateOption[] = [
  {
    id: "modern-clean",
    name: "Modern Clean",
    description: "Tampilan minimalis dengan aksen tegas untuk brand korporat.",
    accent: "#0EA5E9",
  },
  {
    id: "heritage-classic",
    name: "Heritage Classic",
    description: "Nuansa hangat dengan tipografi klasik cocok untuk retail.",
    accent: "#8B5CF6",
  },
  {
    id: "dynamic-gradient",
    name: "Dynamic Gradient",
    description: "Gradien vibrant dan kartu informasi modular untuk kampanye digital.",
    accent: "#F97316",
  },
];

const templateCatalog: { id: string; name: string }[] = [
  { id: "modern-clean", name: "Modern Clean" },
  { id: "corporate-bold", name: "Corporate Bold" },
  { id: "minimal-soft", name: "Minimal Soft" },
  { id: "heritage-classic", name: "Heritage Classic" },
];

const numberFormatLabels: Record<NumberFormatKey, string> = {
  quotation: "Format No. Quotation",
  salesOrder: "Format No. Sales Order",
  invoice: "Format No. Invoice",
  deliveryNote: "Format No. Surat Jalan",
};

const templateDefaultLabels: Record<TemplateDefaultKey, string> = {
  invoice: "Invoice",
  kwitansi: "Kwitansi",
  deliveryNote: "Surat Jalan",
};

const TEMPLATE_FIELD_TO_DOC_TYPE: Record<TemplateDefaultKey, DocumentType> = {
  invoice: "invoice",
  kwitansi: "invoice",
  deliveryNote: "delivery-note",
};



const cn = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

const moduleGroups: Array<{
  title: string;
  description: string;
  modules: Array<{
    id: ModuleKey;
    name: string;
    description: string;
  }>;
}> = [
  {
    title: "Modul Penjualan",
    description:
      "Aktifkan modul yang digunakan tim sales. Modul nonaktif tidak muncul pada form dan laporan.",
    modules: [
      {
        id: "sales.quotation",
        name: "Quotation",
        description: "Susun dan kirim penawaran harga ke calon pelanggan.",
      },
      {
        id: "sales.order",
        name: "Order Penjualan",
        description: "Kelola pesanan yang sudah disetujui pelanggan.",
      },
      {
        id: "sales.invoice",
        name: "Invoice Penjualan",
        description: "Buat tagihan resmi beserta catatan pembayaran.",
      },
      {
        id: "sales.receipt",
        name: "Kwitansi Penjualan",
        description: "Catat penerimaan pembayaran pelanggan.",
      },
      {
        id: "sales.delivery",
        name: "Surat Jalan",
        description: "Terbitkan dokumen pengiriman barang dan monitoring.",
      },
    ],
  },
  {
    title: "Modul Operasional",
    description:
      "Pengaturan untuk tim pembelian serta manajemen produk dan stok.",
    modules: [
      {
        id: "purchase",
        name: "Modul Pembelian",
        description: "Kelola permintaan dan pesanan pembelian ke supplier.",
      },
      {
        id: "inventory",
        name: "Produk & Stok",
        description: "Pantau katalog produk, varian, stok gudang, dan mutasi.",
      },
    ],
  },
];

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

function EditBrandSettingsPage({ params }: PageProps) {
  const { id: profileId } = use(params);
  const router = useRouter();

  // State for templates
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  // TODO: Fetch profile from API instead of hardcoded data
  const [profile, setProfile] = useState<BrandProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Fetch profile from API
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoadingProfile(true);
        const response = await fetch(`/api/brand-profiles/${profileId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch brand profile');
        }
        const data = await response.json();

        // Transform API data to match component interface
        const transformedProfile: BrandProfile = {
          id: data.id.toString(),
          name: data.name,
          description: data.overview || "",
          address: data.address || "",
          phone: data.phone || "",
          email: data.email || "",
          website: data.website || "",
          footer: data.footerText || "",
          paymentInfo: data.paymentInfo || "",
          termsConditions: data.termsConditions || "",
          showBrandName: data.showBrandName ?? true,
          showBrandDescription: data.showBrandDescription ?? true,
          formats: data.numberFormats || {
            quotation: "QTN-{YYYY}{MM}-{SEQ4}",
            salesOrder: "SO-{YYYY}{MM}-{SEQ4}",
            invoice: "INV/{BRAND}/{YYYY}/{SEQ4}",
            deliveryNote: "SJ-{BRANCH}-{SEQ3}",
          },
          templates: data.templateDefaults || {
            invoice: "",
            kwitansi: "",
            deliveryNote: "",
          },
          primaryColor: data.primaryColor || "#0EA5E9",
          secondaryColor: data.secondaryColor || "#ECFEFF",
          templateOptionId: data.templateOptionId || "modern-clean",
          modules: data.modules || {
            "sales.quotation": true,
            "sales.order": true,
            "sales.invoice": true,
            "sales.receipt": true,
            "sales.delivery": true,
            purchase: true,
            inventory: true,
          },
        };

        setProfile(transformedProfile);
      } catch (error) {
        console.error('Error fetching profile:', error);
        // Fallback to default profile
        setProfile({
          id: profileId,
          name: "Default Brand",
          description: "Default brand profile",
          address: "",
          phone: "",
          email: "",
          footer: "",
          paymentInfo: "",
          termsConditions: "",
          showBrandName: true,
          showBrandDescription: true,
          formats: {
            quotation: "QTN-{YYYY}{MM}-{SEQ4}",
            salesOrder: "SO-{YYYY}{MM}-{SEQ4}",
            invoice: "INV/{BRAND}/{YYYY}/{SEQ4}",
            deliveryNote: "SJ-{BRANCH}-{SEQ3}",
          },
          templates: {
            invoice: "",
            kwitansi: "",
            deliveryNote: "",
          },
          primaryColor: "#0EA5E9",
          secondaryColor: "#ECFEFF",
          templateOptionId: "modern-clean",
          modules: {
            "sales.quotation": true,
            "sales.order": true,
            "sales.invoice": true,
            "sales.receipt": true,
            "sales.delivery": true,
            purchase: true,
            inventory: true,
          },
        });
      } finally {
        setLoadingProfile(false);
      }
    };

    fetchProfile();
  }, [profileId]);

  // Fetch templates on component mount
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

  const [brandName, setBrandName] = useState<string>("");
  const [address, setAddress] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [website, setWebsite] = useState<string>("");
  const [paymentInfo, setPaymentInfo] = useState<string>("");
  const [footerText, setFooterText] = useState<string>("");
  const [termsConditions, setTermsConditions] = useState<string>("");
  const [showBrandNameState, setShowBrandNameState] = useState<boolean>(true);
  const [showBrandDescriptionState, setShowBrandDescriptionState] = useState<boolean>(true);
  const [logoFileName, setLogoFileName] = useState<string>("logo-brand.svg");
  const [selectedTemplateOption, setSelectedTemplateOption] = useState<string>("modern-clean");
  const [numberFormats, setNumberFormats] = useState<Record<NumberFormatKey, string>>({
    quotation: "QTN-{YYYY}{MM}-{SEQ4}",
    salesOrder: "SO-{YYYY}{MM}-{SEQ4}",
    invoice: "INV/{BRAND}/{YYYY}/{SEQ4}",
    deliveryNote: "SJ-{BRANCH}-{SEQ3}",
  });
  const [templateDefaults, setTemplateDefaults] = useState<
    Record<TemplateDefaultKey, string>
  >({
    invoice: "",
    kwitansi: "",
    deliveryNote: "",
  });
  const [modulesState, setModulesState] = useState<Record<ModuleKey, boolean>>({
    "sales.quotation": true,
    "sales.order": true,
    "sales.invoice": true,
    "sales.receipt": true,
    "sales.delivery": true,
    purchase: true,
    inventory: true,
  });

  // Update state when profile is loaded
  useEffect(() => {
    if (profile) {
      setBrandName(profile.name);
      setAddress(profile.address);
      setPhone(profile.phone);
      setEmail(profile.email);
      setWebsite(profile.website ?? "");
      setFooterText(profile.footer);
      setPaymentInfo(profile.paymentInfo ?? "");
      setTermsConditions(profile.termsConditions ?? "");
      setShowBrandNameState(profile.showBrandName);
      setShowBrandDescriptionState(profile.showBrandDescription);
      setSelectedTemplateOption(profile.templateOptionId);
      setNumberFormats(profile.formats);
      setTemplateDefaults(profile.templates);
      setModulesState(profile.modules);
    }
  }, [profile]);

  const handleNumberFormatChange =
    (key: NumberFormatKey) => (event: ChangeEvent<HTMLInputElement>) => {
      setNumberFormats((prev) => ({
        ...prev,
        [key]: event.target.value,
      }));
    };

  const handleTemplateDefaultChange =
    (key: TemplateDefaultKey) => (event: ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value;
      if (value === "manage-templates") {
        router.push("/template-branding/template-manager");
        return;
      }
      setTemplateDefaults((prev) => ({
        ...prev,
        [key]: value,
      }));
    };

  const handleLogoChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.length) {
      return;
    }
    const file = event.target.files[0];
    setLogoFileName(file.name);
  };

  const handleTemplateOptionSelect = (optionId: string) => {
    setSelectedTemplateOption(optionId);
  };

  const selectedPdfTemplate = useMemo(
    () => templateOptions.find((option) => option.id === selectedTemplateOption),
    [selectedTemplateOption]
  );

  // Show loading state while profile is being fetched
  if (loadingProfile || !profile) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading brand profile...</span>
      </div>
    );
  }

  const activeModuleNames = useMemo(
    () =>
      moduleGroups.flatMap((group) =>
        group.modules
          .filter((module) => modulesState[module.id])
          .map((module) => module.name)
      ),
    [modulesState]
  );

  const toggleModule = (key: ModuleKey) => {
    setModulesState((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    // Placeholder submit handler.
    // Integrate with API once available.
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 px-4 pb-16 pt-6 md:px-8 lg:px-10"
    >
      <header className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <Button
              variant="outline"
              className="hidden items-center gap-2 md:flex"
              startIcon={<ArrowLeft className="h-4 w-4" />}
            >
              Kembali
            </Button>
            <div>
              <span className="text-xs font-semibold uppercase tracking-widest text-brand-500">
                Brand Setting (Profil)
              </span>
              <h1 className="mt-2 text-2xl font-semibold text-gray-900 md:text-3xl">
                Edit Profil Brand
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-gray-500">
                Perbarui detail brand, format nomor dokumen, serta template PDF yang
                digunakan pada seluruh dokumen.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="w-full sm:w-auto">
              Simpan sebagai Draft
            </Button>
            <Button className="w-full sm:w-auto">
              Simpan Perubahan
            </Button>
          </div>
        </div>
      </header>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 md:text-xl">
              Detail Brand
            </h2>
            <p className="text-sm text-gray-500">
              Informasi dasar ini akan muncul di header dan footer semua dokumen.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr,1fr]">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-800">Nama Brand</label>
              <input
                type="text"
                value={brandName}
                onChange={(event) => setBrandName(event.target.value)}
                className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                placeholder="Nama usaha / perusahaan"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-800">Alamat</label>
              <textarea
                rows={3}
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                placeholder="Alamat lengkap brand"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-gray-800">
                  Telepon / WA
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  placeholder="Kontak resmi"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-800">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  placeholder="Email perusahaan"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-800">
                  Website (opsional)
                </label>
                <input
                  type="url"
                  value={website}
                  onChange={(event) => setWebsite(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  placeholder="https://"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-800">Footer Text</label>
                <textarea
                  rows={3}
                  value={footerText}
                  onChange={(event) => setFooterText(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  placeholder="Keterangan tambahan di footer dokumen"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-800">Payment Information</label>
                <textarea
                  rows={3}
                  value={paymentInfo}
                  onChange={(event) => setPaymentInfo(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  placeholder="Detail rekening, metode pembayaran, atau instruksi khusus"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Tulis satu baris per informasi agar rapi di PDF.
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-800">Terms &amp; Conditions</label>
                <textarea
                  rows={3}
                  value={termsConditions}
                  onChange={(event) => setTermsConditions(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  placeholder="Ketentuan pembayaran, garansi, atau catatan tambahan"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Tiap baris akan tampil sebagai poin berbeda pada PDF.
                </p>
              </div>
              <div className="rounded-lg border border-brand-100 bg-brand-50/40 p-3">
                <p className="text-sm font-semibold text-brand-700">
                  Pengaturan tampilan PDF
                </p>
                <div className="mt-3 space-y-2 text-sm text-gray-700">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={showBrandNameState}
                      onChange={() => setShowBrandNameState((prev) => !prev)}
                      className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                    />
                    <span>Tampilkan nama brand pada PDF</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={showBrandDescriptionState}
                      onChange={() => setShowBrandDescriptionState((prev) => !prev)}
                      className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                    />
                    <span>Tampilkan deskripsi brand pada PDF</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-800">Logo Brand</label>
            <div className="mt-3 flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-center">
              <div
                className="flex h-20 w-20 items-center justify-center rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-600 shadow-sm"
                style={{ backgroundColor: profile?.secondaryColor }}
              >
                LOGO
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-900">{logoFileName}</p>
                <p className="text-xs text-gray-500">
                  Upload logo PNG/SVG. Logo ini akan tampil di seluruh dokumen.
                </p>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-xs font-medium text-gray-600 transition hover:bg-gray-100">
                <Upload className="h-4 w-4" />
                Ganti Logo
                <input
                  type="file"
                  accept=".png,.svg"
                  className="hidden"
                  onChange={handleLogoChange}
                />
              </label>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 md:text-xl">
              Format Penomoran Dokumen
            </h2>
            <p className="text-sm text-gray-500">
              Gunakan variabel seperti{" "}
              <code className="rounded bg-gray-100 px-1 py-0.5 text-xs text-gray-600">
                {"{YYYY}"}
              </code>{" "}
              atau{" "}
              <code className="rounded bg-gray-100 px-1 py-0.5 text-xs text-gray-600">
                {"{SEQ4}"}
              </code>{" "}
              untuk membuat penomoran otomatis.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {(Object.keys(numberFormats) as NumberFormatKey[]).map((key) => (
            <div
              key={key}
              className="rounded-xl border border-dashed border-gray-200 p-4 transition hover:border-brand-200 hover:bg-brand-50/40"
            >
              <label className="text-sm font-medium text-gray-900">
                {numberFormatLabels[key]}
              </label>
              <input
                type="text"
                value={numberFormats[key]}
                onChange={handleNumberFormatChange(key)}
                className="mt-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 md:text-xl">
              Switch Modul Fitur
            </h2>
            <p className="text-sm text-gray-500">
              Aktifkan modul yang relevan dengan profil brand ini. Modul yang dimatikan
              akan disembunyikan dari menu dan form terkait.
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          {moduleGroups.map((group) => (
            <div
              key={group.title}
              className="rounded-2xl border border-gray-200 bg-gray-50 p-4 shadow-sm"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">
                    {group.title}
                  </h3>
                  <p className="text-sm text-gray-500">{group.description}</p>
                </div>
              </div>

              <div className="mt-4 space-y-4">
                {group.modules.map((module) => {
                  const isActive = modulesState[module.id];
                  return (
                    <div
                      key={module.id}
                      className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white p-4 transition hover:border-brand-200"
                    >
                      <div>
                        <h4 className="text-sm font-semibold text-gray-800">
                          {module.name}
                        </h4>
                        <p className="mt-1 text-xs text-gray-500">
                          {module.description}
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isActive}
                        aria-label={`Toggle ${module.name}`}
                        onClick={() => toggleModule(module.id)}
                        className={cn(
                          "relative inline-flex h-6 w-12 items-center rounded-full transition focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2",
                          isActive ? "bg-brand-500" : "bg-gray-300"
                        )}
                      >
                        <span
                          className={cn(
                            "inline-block h-5 w-5 transform rounded-full bg-white shadow transition",
                            isActive ? "translate-x-6" : "translate-x-1"
                          )}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 md:text-xl">
              Template Default Dokumen
            </h2>
            <p className="text-sm text-gray-500">
              Tentukan template bawaan untuk setiap dokumen. Pengguna masih bisa
              menggantinya secara manual ketika membuat dokumen.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {(Object.keys(templateDefaults) as TemplateDefaultKey[]).map((key) => (
            <div key={key} className="space-y-2">
              <label className="text-sm font-medium text-gray-900">
                Template {templateDefaultLabels[key]}
              </label>
              {loadingTemplates ? (
                <div className="flex items-center justify-center py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                  <span className="ml-2 text-sm text-gray-500">Loading templates...</span>
                </div>
              ) : (
                <select
                  value={templateDefaults[key]}
                  onChange={handleTemplateDefaultChange(key)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                >
                  <option value="">Tidak ada template default</option>
                  {templates
                    .filter((template) => {
                      const docType = TEMPLATE_FIELD_TO_DOC_TYPE[key];
                      return template.type === 'universal' || template.type === docType;
                    })
                    .map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name} {template.isUploaded ? '(Custom)' : '(Built-in)'}
                      </option>
                    ))}
                  <option value="manage-templates" className="text-blue-600 font-medium">
                    Kelola Template...
                  </option>
                </select>
              )}
              {templateDefaults[key] === 'manage-templates' && (
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800 mb-2">
                    Click the button below to manage your templates:
                  </p>
                  <Button
                    onClick={() => router.push('/template-branding/template-manager')}
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Go to Template Manager
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 md:text-xl">
              PDF Template
            </h2>
            <p className="text-sm text-gray-500">
              Pilih gaya PDF utama yang akan menjadi referensi untuk invoice, surat
              jalan, dan dokumen lainnya.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {templateOptions.map((option) => {
            const isSelected = option.id === selectedTemplateOption;

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => handleTemplateOptionSelect(option.id)}
                className={cn(
                  "flex h-full flex-col rounded-2xl border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2",
                  isSelected
                    ? "border-brand-500 shadow-[0_18px_42px_-24px_rgba(14,165,233,0.6)]"
                    : "border-gray-200 hover:-translate-y-1 hover:shadow-lg"
                )}
              >
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-xl text-white"
                  style={{ backgroundColor: option.accent }}
                >
                  <FileText className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-gray-900">
                  {option.name}
                </h3>
                <p className="mt-2 flex-1 text-sm text-gray-600">
                  {option.description}
                </p>
                <div className="mt-5 flex items-center gap-2 text-sm font-medium text-brand-600">
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full border",
                      isSelected
                        ? "border-brand-500 bg-brand-500 text-white"
                        : "border-brand-200 bg-brand-50 text-brand-500"
                    )}
                  >
                    <Check className="h-4 w-4" />
                  </span>
                  {isSelected ? "Dipilih" : "Pilih Template"}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 md:text-xl">
              Preview Tampilan Dokumen
            </h2>
            <p className="text-sm text-gray-500">
              Pratinjau akan menyesuaikan nama brand, kontak, format nomor, dan
              template yang Anda pilih sebelum perubahan disimpan.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr,1fr]">
          <div className="space-y-4">
            <div
              className="rounded-xl p-4 text-white shadow"
              style={{
                backgroundColor: selectedPdfTemplate?.accent ?? profile?.primaryColor,
              }}
            >
              <div className="text-xs uppercase tracking-widest">Header Dokumen</div>
              <div className="mt-2 text-lg font-semibold">{brandName}</div>
              <div className="text-xs text-white/80">
                {email} • {phone}
              </div>
              {website && (
                <div className="text-xs text-white/80">{website}</div>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>No. Invoice</span>
                <span className="font-semibold text-gray-800">
                  {numberFormats.invoice.replace("{BRAND}", brandName.slice(0, 4).toUpperCase())}
                </span>
              </div>
              <div className="mt-4 h-24 rounded-lg bg-gray-100" />
              <div className="mt-4 grid gap-3 text-xs text-gray-500 sm:grid-cols-2">
                <div>
                  <span className="font-semibold text-gray-700">Alamat</span>
                  <p className="mt-1 text-gray-600">{address}</p>
                </div>
                <div>
                  <span className="font-semibold text-gray-700">Kontak</span>
                  <p className="mt-1 text-gray-600">
                    {phone} • {email}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <aside className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <h3 className="text-sm font-semibold text-gray-800">Ringkasan Cepat</h3>
            <ul className="mt-3 space-y-3 text-sm text-gray-600">
              <li className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-brand-500" />
                <span>
                  Template PDF aktif:{" "}
                  <strong className="text-gray-800">
                    {selectedPdfTemplate?.name ?? "Modern Clean"}
                  </strong>
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-brand-500" />
                <span>
                  Modul aktif:{" "}
                  {activeModuleNames.length > 0 ? (
                    <span className="text-gray-700">
                      {activeModuleNames.join(", ")}
                    </span>
                  ) : (
                    <span className="text-gray-400">Tidak ada modul aktif</span>
                  )}
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-brand-500" />
                <span>
                  Format invoice:{" "}
                  <code className="rounded bg-gray-200 px-1 py-0.5 text-xs text-gray-700">
                    {numberFormats.invoice}
                  </code>
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-brand-500" />
                <span>Footer dokumen: {footerText.slice(0, 72)}...</span>
              </li>
            </ul>
          </aside>
        </div>
      </section>
    </form>
  );
}

export default EditBrandSettingsPage;



