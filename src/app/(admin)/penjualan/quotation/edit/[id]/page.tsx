"use client";

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactDOM from "react-dom";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { useRouter, useParams } from "next/navigation";
import dayjs from "dayjs";
import { PlusCircle, Trash2, ChevronDown, Paperclip, X } from "lucide-react";
import DatePicker from "@/components/DatePicker";
import toast from "react-hot-toast";
import FeatureGuard from "@/components/FeatureGuard";
import { useProductUnits } from "@/hooks/useProductUnits";

type Customer = {
  id: number;
  pic: string;
  email?: string | null;
  perusahaan: string;
  alamat: string;
  nohp: string;
};

type QuotationItem = {
  id: number;
  existingId?: number;
  productId: number;
  product: string;
  description: string;
  quantity: number;
  unit: string;
  price: number;
  image?: File | null;
  imagePreview?: string | null;
};

type ProductOption = {
  id: number;
  name: string;
  sku?: string | null;
  sellPrice: number;
  unit?: string | null;
  description?: string | null;
  qty: number;
  imageUrl?: string | null;
};

const normalizePhoneNumber = (raw: string): string => {
  const digits = raw.replace(/\D+/g, "");
  if (!digits) return raw.trim();
  if (digits.startsWith("62")) return `+${digits}`;
  if (digits.startsWith("0")) return `+62${digits.slice(1)}`;
  if (raw.trim().startsWith("+")) return raw.trim();
  return `+62${digits}`;
};

const sanitizePhoneInput = (value: string) =>
  value.replace(/\D+/g, "").slice(0, 12);

const isBlobUrl = (url?: string | null) => !!url && url.startsWith("blob:");

const EMPTY_CUSTOMER_FORM: Required<Omit<Customer, "id">> & { id: number } = {
  id: 0,
  pic: "",
  email: "",
  perusahaan: "",
  alamat: "",
  nohp: "",
};

const INITIAL_CUSTOMER_ERRORS = {
  pic: "",
  email: "",
  perusahaan: "",
  alamat: "",
  nohp: "",
};

type ProductDropdownProps = {
  item: QuotationItem;
  selectedProduct?: ProductOption;
  products: ProductOption[];
  loading: boolean;
  onSelectProduct: (product: ProductOption) => void;
  onManualInput: (value: string) => void;
  resolveProductByInput: (value: string) => ProductOption | null;
};

const ProductDropdown: React.FC<ProductDropdownProps> = ({
  item,
  selectedProduct,
  products,
  loading,
  onSelectProduct,
  onManualInput,
  resolveProductByInput,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const portalRef = useRef<HTMLDivElement | null>(null);
  const [menuStyles, setMenuStyles] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !containerRef.current ||
        containerRef.current.contains(target) ||
        portalRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const minWidth = 280;
      const maxWidth = 360;
      const width = Math.min(Math.max(rect.width, minWidth), maxWidth);
      const padding = 12;
      const scrollX = window.scrollX;
      const scrollY = window.scrollY;
      const viewportLeft = scrollX + padding;
      const viewportRight = scrollX + window.innerWidth - padding - width;
      const left = Math.min(
        Math.max(rect.left + scrollX, viewportLeft),
        viewportRight
      );
      const estimatedHeight = portalRef.current?.offsetHeight ?? 320;
      const viewportTop = scrollY + padding;
      const viewportBottom = scrollY + window.innerHeight - padding;
      let top = rect.bottom + scrollY + 8;
      if (top + estimatedHeight > viewportBottom) {
        const above = rect.top + scrollY - estimatedHeight - 8;
        top =
          above >= viewportTop
            ? above
            : Math.max(viewportTop, viewportBottom - estimatedHeight);
      }
      setMenuStyles({
        position: "absolute",
        top,
        left,
        width,
        zIndex: 60,
      });
    };
    updatePosition();
    const handleScroll = () => updatePosition();
    const handleResize = () => updatePosition();
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [open]);

  useEffect(() => {
    if (open) setQuery(item.product || "");
  }, [item.product, open]);

  const filteredProducts = useMemo(() => {
    const term = query.trim().toLowerCase();
    const source = term
      ? products.filter((prod) => {
          const name = prod.name.toLowerCase();
          const sku = prod.sku?.toLowerCase() ?? "";
          const description = prod.description?.toLowerCase() ?? "";
          return (
            name.includes(term) ||
            sku.includes(term) ||
            description.includes(term)
          );
        })
      : products;
    return source.slice(0, 50);
  }, [products, query]);

  const commitQuery = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    const matched = resolveProductByInput(trimmed);
    if (matched) {
      onSelectProduct(matched);
    } else {
      onManualInput(trimmed);
    }
    setOpen(false);
    setQuery("");
  };

  const handleSelect = (product: ProductOption) => {
    onSelectProduct(product);
    setOpen(false);
    setQuery("");
  };

  const trimmedQuery = query.trim();
  const matchedProduct = trimmedQuery
    ? resolveProductByInput(trimmedQuery)
    : null;

  return (
    <div ref={containerRef} className="relative flex-1">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-200"
        title={
          selectedProduct
            ? selectedProduct.name
            : item.product || "Pilih produk..."
        }
      >
        <span className="truncate text-left">
          {selectedProduct ? (
            <>
              <span className="font-medium">{selectedProduct.name}</span>
              {selectedProduct.sku ? (
                <span className="text-gray-500">{` (${selectedProduct.sku})`}</span>
              ) : null}
            </>
          ) : item.product ? (
            <span className="font-medium">{item.product}</span>
          ) : (
            <span className="text-gray-500">
              {loading ? "Memuat produk..." : "Pilih produk..."}
            </span>
          )}
        </span>
        <ChevronDown className="ml-2 h-4 w-4 opacity-70" />
      </button>

      {open && typeof document !== "undefined"
        ? ReactDOM.createPortal(
            <div
              ref={portalRef}
              style={menuStyles}
              className="max-w-[calc(100vw-3rem)] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl"
            >
              <div className="border-b border-gray-200 p-2">
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitQuery();
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      setOpen(false);
                    }
                  }}
                  placeholder="Cari nama, SKU, deskripsi produk..."
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div className="max-h-72 overflow-y-auto">
                {loading ? (
                  <div className="px-3 py-2 text-sm text-gray-500">
                    Memuat produk...
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-gray-500">
                    Produk tidak ditemukan.
                  </div>
                ) : (
                  filteredProducts.map((prod) => {
                    const isSelected = prod.id === selectedProduct?.id;
                    return (
                      <button
                        key={prod.id}
                        type="button"
                        onClick={() => handleSelect(prod)}
                        className={`block w-full border-b border-gray-100 px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                          isSelected ? "bg-blue-50" : ""
                        }`}
                      >
                        <div className="font-medium text-gray-800">
                          {prod.name}
                        </div>
                        <div className="mt-0.5 text-[11px] text-gray-500">
                          {[
                            prod.sku ? `SKU: ${prod.sku}` : null,
                            `Harga: ${Number(
                              prod.sellPrice || 0
                            ).toLocaleString("id-ID", {
                              style: "currency",
                              currency: "IDR",
                              maximumFractionDigits: 0,
                            })}`,
                            `Stok: ${prod.qty} ${prod.unit || "pcs"}`,
                          ]
                            .filter(Boolean)
                            .join(" - ")}
                        </div>
                        {prod.description ? (
                          <div className="mt-0.5 text-[11px] text-gray-400">
                            {prod.description}
                          </div>
                        ) : null}
                      </button>
                    );
                  })
                )}
              </div>
              <div className="space-y-1 border-t border-gray-200 bg-gray-50 p-2">
                {trimmedQuery ? (
                  <button
                    type="button"
                    onClick={commitQuery}
                    className="w-full text-left text-xs font-medium text-blue-600 hover:text-blue-700"
                  >
                    {`Gunakan "${query.trim()}" sebagai item manual`}
                  </button>
                ) : null}
                {matchedProduct && (
                  <div className="rounded bg-blue-50 px-2 py-1 text-[11px] text-blue-600">
                    Tekan Enter untuk memilih {matchedProduct.name}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-3 py-2 text-xs">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded px-2 py-1 text-gray-600 hover:text-gray-800"
                >
                  Tutup
                </button>
                {item.product ? (
                  <button
                    type="button"
                    onClick={() => {
                      onManualInput("");
                      setOpen(false);
                    }}
                    className="rounded px-2 py-1 font-medium text-blue-600 hover:text-blue-700"
                  >
                    Kosongkan pilihan
                  </button>
                ) : null}
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
};
export default function EditQuotationPage() {
  const router = useRouter();
  const params = useParams();
  const quotationId = Number(params?.id);

  const [loadingData, setLoadingData] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Header fields
  const [quotationNumber, setQuotationNumber] = useState("");
  const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [validUntil, setValidUntil] = useState(
    dayjs().add(7, "day").format("YYYY-MM-DD")
  );
  const [projectDescription, setProjectDescription] = useState("");
  const [projectFile, setProjectFile] = useState<File | null>(null);
  const [projectFilePreview, setProjectFilePreview] = useState<string | null>(
    null
  );
  const { units: productUnits } = useProductUnits();
  const defaultUnit = useMemo(() => productUnits[0]?.symbol || "pcs", [productUnits]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Customers
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<number | "">("");
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [newCustomer, setNewCustomer] =
    useState<typeof EMPTY_CUSTOMER_FORM>({ ...EMPTY_CUSTOMER_FORM });
  const [customerErrors, setCustomerErrors] = useState({
    ...INITIAL_CUSTOMER_ERRORS,
  });
  const [customersLoading, setCustomersLoading] = useState(true);

  // Products & Items
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productsLoading, setProductsLoading] = useState<boolean>(true);
  const [items, setItems] = useState<QuotationItem[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [pendingProductRowId, setPendingProductRowId] = useState<
    number | null
  >(null);
  const productPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const [productDraftPhoto, setProductDraftPhoto] = useState<File | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);
  const [productDraft, setProductDraft] = useState({
    name: "",
    unit: "pcs",
    sellPrice: 0,
    buyPrice: 0,
    description: "",
  });

  const productMap = useMemo(() => {
    const map = new Map<number, ProductOption>();
    for (const product of products) map.set(product.id, product);
    return map;
  }, [products]);

  const totalAmount = useMemo(
    () =>
      items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.price), 0),
    [items]
  );

  const activeCustomer = useMemo(() => {
    if (selectedCustomer === "") return null;
    return customers.find((cust) => cust.id === Number(selectedCustomer)) ?? null;
  }, [customers, selectedCustomer]);

  const clearCustomerErrors = () => {
    setCustomerErrors({ ...INITIAL_CUSTOMER_ERRORS });
  };

  const handleCustomerFieldChange = <
    K extends Exclude<keyof typeof EMPTY_CUSTOMER_FORM, "id">
  >(
    field: K,
    value: string
  ) => {
    setNewCustomer((prev) => ({ ...prev, [field]: value }));
    setCustomerErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const handleCustomerPhoneChange = (value: string) => {
    const digitsOnly = sanitizePhoneInput(value);
    handleCustomerFieldChange("nohp", digitsOnly);
  };

  const validateNewCustomerForm = () => {
    const errors = { ...INITIAL_CUSTOMER_ERRORS };
    const pic = newCustomer.pic.trim();
    const perusahaan = newCustomer.perusahaan.trim();
    const alamat = newCustomer.alamat.trim();
    const email = newCustomer.email?.trim() || "";
    const phoneDigits = newCustomer.nohp.replace(/\D+/g, "");

    if (!pic) errors.pic = "PIC wajib diisi.";
    if (!perusahaan) errors.perusahaan = "Perusahaan wajib diisi.";
    if (!alamat) errors.alamat = "Alamat wajib diisi.";
    if (!email) {
      errors.email = "Email wajib diisi.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = "Format email tidak valid.";
    }
    if (!phoneDigits) {
      errors.nohp = "No HP wajib diisi.";
    } else if (phoneDigits.length < 10 || phoneDigits.length > 12) {
      errors.nohp = "No HP minimal 10 dan maksimal 12 digit.";
    }

    const isValid = Object.values(errors).every((msg) => !msg);
    setCustomerErrors(errors);

    return {
      isValid,
      pic,
      perusahaan,
      alamat,
      email,
      phoneDigits,
    };
  };

  const handleAddCustomer = async () => {
    const { isValid, pic, perusahaan, alamat, email, phoneDigits } =
      validateNewCustomerForm();
    if (!isValid) {
      toast.error("Periksa kembali data customer.");
      return;
    }
    const normalizedPhone = normalizePhoneNumber(phoneDigits);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pic,
          email: email || null,
          company: perusahaan,
          address: alamat,
          phone: normalizedPhone,
        }),
      });
      if (!res.ok) throw new Error("Gagal tambah customer");
      const raw = (await res.json()) as unknown;
      const payload =
        raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
      const nested =
        payload.data && typeof payload.data === "object"
          ? (payload.data as Record<string, unknown>)
          : undefined;
      const created: Customer = {
        id:
          (typeof payload.id === "number" && Number.isFinite(payload.id)
            ? payload.id
            : typeof nested?.id === "number" && Number.isFinite(nested.id)
            ? nested.id
            : Date.now()),
        pic:
          typeof payload.pic === "string" && payload.pic.trim()
            ? payload.pic.trim()
            : typeof nested?.pic === "string" && nested.pic.trim()
            ? nested.pic.trim()
            : pic,
        email:
          typeof payload.email === "string"
            ? payload.email
            : typeof nested?.email === "string"
            ? nested.email
            : email ?? null,
        perusahaan:
          typeof payload.company === "string" && payload.company.trim()
            ? payload.company.trim()
            : typeof nested?.company === "string" && nested.company.trim()
            ? nested.company.trim()
            : perusahaan,
        alamat:
          typeof payload.address === "string" && payload.address.trim()
            ? payload.address.trim()
            : typeof nested?.address === "string" && nested.address.trim()
            ? nested.address.trim()
            : alamat,
        nohp: normalizePhoneNumber(
          String(
            (typeof payload.phone === "string" && payload.phone) ||
              (typeof nested?.phone === "string" && nested.phone) ||
              normalizedPhone
          )
        ),
      };
      setCustomers((prev) => [created, ...prev.filter((c) => c.id !== created.id)]);
      setSelectedCustomer(created.id);
      setNewCustomer({ ...EMPTY_CUSTOMER_FORM });
      clearCustomerErrors();
      setIsCustomerModalOpen(false);
      toast.success("Customer berhasil ditambahkan.");
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Gagal menambah customer."
      );
    }
  };
  const handleAddItem = () => {
    const rowId = Date.now();
    setItems((prev) => [
      ...prev,
      {
        id: rowId,
        existingId: undefined,
        productId: 0,
        product: "",
        description: "",
        quantity: 1,
        unit: defaultUnit,
        price: 0,
        image: null,
        imagePreview: null,
      },
    ]);
  };

  const handleItemChange = <K extends keyof QuotationItem>(
    rowId: number,
    field: K,
    value: QuotationItem[K]
  ) => {
    setItems((prev) =>
      prev.map((item) => (item.id === rowId ? { ...item, [field]: value } : item))
    );
  };

  const handleItemImageChange = (rowId: number, file: File | null) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== rowId) return item;
        if (item.imagePreview && isBlobUrl(item.imagePreview)) {
          URL.revokeObjectURL(item.imagePreview);
        }
        return {
          ...item,
          image: file,
          imagePreview: file ? URL.createObjectURL(file) : null,
        };
      })
    );
  };

  const handleRemoveItem = (rowId: number) => {
    setItems((prev) => {
      const next = prev.filter((item) => item.id !== rowId);
      const removed = prev.find((item) => item.id === rowId);
      if (removed?.imagePreview && isBlobUrl(removed.imagePreview)) {
        URL.revokeObjectURL(removed.imagePreview);
      }
      return next;
    });
  };

  const findProductByInput = useCallback(
    (value: string) => {
      const trimmed = value.trim().toLowerCase();
      if (!trimmed) return null;
      return (
        products.find((prod) => {
          const label = `${prod.name}${prod.sku ? ` (${prod.sku})` : ""}`.toLowerCase();
          const name = prod.name.toLowerCase();
          const sku = prod.sku?.toLowerCase();
          return label === trimmed || name === trimmed || (sku && sku === trimmed);
        }) || null
      );
    },
    [products]
  );

  const applyProductOptionToRow = useCallback(
    (rowId: number, product: ProductOption) => {
      setItems((prev) =>
        prev.map((item) => {
          if (item.id !== rowId) return item;
          const next: QuotationItem = {
            ...item,
            productId: product.id,
            product: product.name,
            unit: product.unit || item.unit || defaultUnit,
            price: product.sellPrice ?? item.price,
          };
          if (!item.description?.trim() && product.description) {
            next.description = product.description;
          }
          if (product.imageUrl) {
            if (item.imagePreview && isBlobUrl(item.imagePreview)) {
              URL.revokeObjectURL(item.imagePreview);
            }
            next.image = null;
            next.imagePreview = product.imageUrl;
          }
          return next;
        })
      );
    },
    [defaultUnit]
  );

  const handleManualProductEntry = useCallback((rowId: number, rawValue: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== rowId) return item;
        const value = rawValue.trim();
        const next: QuotationItem = {
          ...item,
          product: value,
          productId: 0,
        };
        if (!value) {
          if (next.imagePreview && isBlobUrl(next.imagePreview)) {
            URL.revokeObjectURL(next.imagePreview);
          }
          next.image = null;
          next.imagePreview = null;
        }
        return next;
      })
    );
  }, []);

  const handleProductPhotoSelection = (file: File | null) => {
    setProductDraftPhoto(file);
    if (productPhotoInputRef.current) {
      productPhotoInputRef.current.value = "";
    }
  };

  const resetProductDraft = () => {
    setProductDraft({
      name: "",
      unit: "pcs",
      sellPrice: 0,
      buyPrice: 0,
      description: "",
    });
    handleProductPhotoSelection(null);
  };

  const openProductModal = (rowId: number | null) => {
    resetProductDraft();
    setPendingProductRowId(rowId);
    setIsProductModalOpen(true);
  };

  const closeProductModal = () => {
    resetProductDraft();
    setPendingProductRowId(null);
    setIsProductModalOpen(false);
  };

  const handleCreateProduct = async () => {
    const name = productDraft.name.trim();
    if (!name) {
      toast.error("Nama produk wajib diisi");
      return;
    }
    setSavingProduct(true);
    try {
      const fd = new FormData();
      fd.append("name", name);
      fd.append("unit", productDraft.unit || "pcs");
      fd.append("sellPrice", String(productDraft.sellPrice || 0));
      fd.append("buyPrice", String(productDraft.buyPrice || 0));
      fd.append("qty", "0");
      if (productDraft.description.trim())
        fd.append("description", productDraft.description.trim());
      if (productDraftPhoto) fd.append("photo", productDraftPhoto);

      const res = await fetch("/api/products", { method: "POST", body: fd });
      const savedRaw = (await res.json()) as unknown;
      if (!res.ok) {
        const errorMessage =
          savedRaw &&
          typeof savedRaw === "object" &&
          savedRaw !== null &&
          "error" in savedRaw &&
          typeof (savedRaw as Record<string, unknown>).error === "string"
            ? ((savedRaw as Record<string, unknown>).error as string)
            : "Gagal menambah produk";
        toast.error(errorMessage);
        return;
      }
      const savedRecord =
        savedRaw && typeof savedRaw === "object" && savedRaw !== null
          ? (savedRaw as Record<string, unknown>)
          : {};
      const mapped: ProductOption = {
        id: Number(savedRecord.id ?? 0),
        name: String(savedRecord.name ?? name),
        sku:
          typeof savedRecord.sku === "string" ? savedRecord.sku : null,
        sellPrice: Number(savedRecord.sellPrice ?? productDraft.sellPrice ?? 0),
        unit:
          typeof savedRecord.unit === "string" && savedRecord.unit
            ? savedRecord.unit
            : productDraft.unit || null,
        description:
          typeof savedRecord.description === "string"
            ? savedRecord.description
            : productDraft.description || null,
        qty: Number(savedRecord.qty ?? 0),
        imageUrl:
          typeof savedRecord.imageUrl === "string" ? savedRecord.imageUrl : null,
      };
      setProducts((prev) => [mapped, ...prev.filter((p) => p.id !== mapped.id)]);
      if (pendingProductRowId != null) {
        applyProductOptionToRow(pendingProductRowId, mapped);
      }
      toast.success("Produk berhasil ditambahkan");
      closeProductModal();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal menyimpan produk"
      );
    } finally {
      setSavingProduct(false);
    }
  };
  const handleProjectFile = (file: File | null) => {
    if (projectFilePreview && isBlobUrl(projectFilePreview)) {
      URL.revokeObjectURL(projectFilePreview);
    }
    if (file) {
      setProjectFile(file);
      setProjectFilePreview(URL.createObjectURL(file));
    } else {
      setProjectFile(null);
      setProjectFilePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleProjectFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    handleProjectFile(file);
  };

  const handleCancel = () => {
    router.push("/penjualan/quotation");
  };

  const fillForm = useCallback((data: unknown) => {
    if (!data || typeof data !== "object") return;
    const record = data as Record<string, unknown>;
    const rawDate = typeof record.date === "string" ? record.date : null;
    const rawValidUntil =
      typeof record.validUntil === "string" ? record.validUntil : null;
    const projectDesc =
      typeof record.projectDescription === "string"
        ? record.projectDescription
        : typeof record.projectDesc === "string"
          ? record.projectDesc
          : "";
    setQuotationNumber(
      typeof record.quotationNumber === "string" ? record.quotationNumber : ""
    );
    setDate(
      rawDate ? dayjs(rawDate).format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD")
    );
    setValidUntil(
      rawValidUntil
        ? dayjs(rawValidUntil).format("YYYY-MM-DD")
        : dayjs().add(7, "day").format("YYYY-MM-DD")
    );
    setProjectDescription(projectDesc);
    setProjectFile(null);
    setProjectFilePreview(
      typeof record.projectFileUrl === "string" ? record.projectFileUrl : null
    );

    if (record.customer && typeof record.customer === "object") {
      const customer = record.customer as Record<string, unknown>;
      const normalized: Customer = {
        id: Number(customer.id ?? 0),
        pic: typeof customer.pic === "string" ? customer.pic : "",
        email:
          typeof customer.email === "string" ? customer.email : null,
        perusahaan:
          typeof customer.company === "string" ? customer.company : "",
        alamat:
          typeof customer.address === "string" ? customer.address : "",
        nohp: normalizePhoneNumber(
          String(
            typeof customer.phone === "string" ? customer.phone : ""
          )
        ),
      };
      setSelectedCustomer(normalized.id);
      setCustomers((prev) => {
        const exists = prev.some((cust) => cust.id === normalized.id);
        if (exists) {
          return prev.map((cust) => (cust.id === normalized.id ? normalized : cust));
        }
        return [normalized, ...prev];
      });
    } else {
      setSelectedCustomer("");
    }

    const originItems = Array.isArray(record.items) ? record.items : [];
    const mappedItems: QuotationItem[] = originItems
      .map((item) =>
        item && typeof item === "object"
          ? (item as Record<string, unknown>)
          : null
      )
      .filter((v): v is Record<string, unknown> => v !== null)
      .map((item, idx) => ({
        id: Number(item.id ?? Date.now() + idx),
        existingId:
          typeof item.id === "number" && Number.isFinite(item.id)
            ? item.id
            : undefined,
        productId: Number(item.productId ?? 0),
        product:
          typeof item.product === "string" ? item.product : "",
        description:
          typeof item.description === "string" ? item.description : "",
        quantity: Number(item.quantity ?? 0),
        unit: typeof item.unit === "string" ? item.unit : "pcs",
        price: Number(item.price ?? 0),
        image: null,
        imagePreview:
          typeof item.imageUrl === "string" ? item.imageUrl : null,
      }));

    setItems(
      mappedItems.length
        ? mappedItems
        : [
            {
              id: Date.now(),
              existingId: undefined,
              productId: 0,
              product: "",
              description: "",
              quantity: 1,
              unit: "pcs",
              price: 0,
              image: null,
              imagePreview: null,
            },
          ]
    );
  }, []);

  const loadQuotation = useCallback(async () => {
    if (!quotationId || Number.isNaN(quotationId)) {
      toast.error("ID quotation tidak valid.");
      router.push("/penjualan/quotation");
      return;
    }
    setLoadingData(true);
    try {
      const res = await fetch(`/api/quotations/${quotationId}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error("Gagal mengambil data quotation");
      }
      const json = (await res.json()) as unknown;
      const payload =
        json && typeof json === "object" && json !== null
          ? (json as Record<string, unknown>)
          : {};
      if (!("data" in payload)) {
        throw new Error("Data quotation tidak ditemukan");
      }
      fillForm(payload.data);
      toast.success("Data quotation dimuat.");
    } catch (error) {
      console.error("Gagal mengambil data quotation:", error);
      toast.error(
        error instanceof Error ? error.message : "Gagal memuat data quotation."
      );
    } finally {
      setLoadingData(false);
    }
  }, [fillForm, quotationId, router]);

  const handleReset = async () => {
    await loadQuotation();
    setDropdownOpen(false);
    toast.success("Form dikembalikan ke data quotation.");
  };

  const handleSave = async (variant: "Draft" | "Confirmed") => {
    if (!quotationNumber.trim()) {
      toast.error("Nomor quotation wajib diisi.");
      return;
    }
    if (!selectedCustomer) {
      toast.error("Pilih customer terlebih dahulu.");
      return;
    }
    if (items.length === 0) {
      toast.error("Tambahkan minimal 1 item.");
      return;
    }
    if (
      items.some(
        (item) =>
          !item.product.trim() || item.quantity <= 0 || Number.isNaN(item.price)
      )
    ) {
      toast.error("Pastikan setiap item memiliki produk, qty, dan harga yang valid.");
      return;
    }

    setIsSaving(true);

    const isDraft = variant === "Draft";
    const payload = new FormData();
    payload.append("quotationNumber", quotationNumber);
    payload.append("date", date);
    payload.append("validUntil", validUntil);
    payload.append("isDraft", String(isDraft));
    payload.append("customerId", String(selectedCustomer));
    payload.append("projectDescription", projectDescription);
    payload.append("projectFilePreview", projectFilePreview ?? "");

    if (projectFile) {
      payload.append("projectFile", projectFile);
    }

    const itemsPayload = items.map((item, idx) => ({
      id: item.existingId ?? null,
      productId: item.productId || null,
      product: item.product.trim(),
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      price: item.price,
      imagePreview: item.imagePreview ?? null,
      imageKey: item.image ? `itemImage_${idx}` : null,
    }));

    payload.append("items", JSON.stringify(itemsPayload));

    items.forEach((item, idx) => {
      if (item.image) {
        payload.append(`itemImage_${idx}`, item.image, item.image.name);
      }
    });

    try {
      const res = await fetch(`/api/quotations/${quotationId}`, {
        method: "PUT",
        body: payload,
      });
      if (!res.ok) {
        const errorRaw = (await res.json().catch(() => null)) as unknown;
        const errorMessage =
          errorRaw &&
          typeof errorRaw === "object" &&
          errorRaw !== null &&
          "message" in errorRaw &&
          typeof (errorRaw as Record<string, unknown>).message === "string"
            ? ((errorRaw as Record<string, unknown>).message as string)
            : "Gagal memperbarui quotation.";
        throw new Error(errorMessage);
      }
      const resultRaw = (await res.json()) as unknown;
      const resultPayload =
        resultRaw && typeof resultRaw === "object" && resultRaw !== null
          ? (resultRaw as Record<string, unknown>)
          : {};
      const resultData =
        resultPayload.data && typeof resultPayload.data === "object"
          ? (resultPayload.data as Record<string, unknown>)
          : undefined;
      const resultId =
        typeof resultData?.id === "number" && Number.isFinite(resultData.id)
          ? resultData.id
          : quotationId;
      toast.success(
        variant === "Draft"
          ? "Quotation disimpan sebagai draft."
          : "Quotation berhasil diperbarui."
      );
      setDropdownOpen(false);
      if (variant === "Draft") {
        router.push("/penjualan/quotation");
      } else {
        router.push(`/penjualan/quotation/${resultId}`);
      }
    } catch (error) {
      console.error("Gagal menyimpan quotation:", error);
      toast.error(
        error instanceof Error ? error.message : "Gagal menyimpan quotation."
      );
    } finally {
      setIsSaving(false);
    }
  };
  useEffect(() => {
    const fetchCustomers = async () => {
      setCustomersLoading(true);
      try {
        const res = await fetch("/api/customers", { cache: "no-store" });
        const json = (await res.json()) as unknown;
        const rows: Customer[] = Array.isArray(json)
          ? json
              .map((entry) =>
                entry && typeof entry === "object"
                  ? (entry as Record<string, unknown>)
                  : null
              )
              .filter((entry): entry is Record<string, unknown> => entry !== null)
              .map((entry) => ({
                id: Number(entry.id ?? 0),
                pic: typeof entry.pic === "string" ? entry.pic : "",
                email:
                  typeof entry.email === "string" ? entry.email : null,
                perusahaan:
                  typeof entry.company === "string" ? entry.company : "",
                alamat:
                  typeof entry.address === "string" ? entry.address : "",
                nohp: normalizePhoneNumber(
                  String(
                    typeof entry.phone === "string" ? entry.phone : ""
                  )
                ),
              }))
          : [];
        setCustomers((prev) => {
          const map = new Map<number, Customer>();
          rows.forEach((cust) => map.set(cust.id, cust));
          prev.forEach((cust) => {
            if (!map.has(cust.id)) map.set(cust.id, cust);
          });
          return Array.from(map.values());
        });
      } catch (err) {
        console.error("Gagal mengambil customer:", err);
      } finally {
        setCustomersLoading(false);
      }
    };
    fetchCustomers();
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/products", { cache: "no-store" });
        const json = (await res.json()) as unknown;
        const rows: ProductOption[] = Array.isArray(json)
          ? json
              .map((entry) =>
                entry && typeof entry === "object"
                  ? (entry as Record<string, unknown>)
                  : null
              )
              .filter((entry): entry is Record<string, unknown> => entry !== null)
              .map((entry) => ({
                id: Number(entry.id ?? 0),
                name: String(entry.name ?? ""),
                sku:
                  typeof entry.sku === "string" ? entry.sku : null,
                sellPrice: Number(entry.sellPrice ?? 0),
                unit:
                  typeof entry.unit === "string" ? entry.unit : null,
                description:
                  typeof entry.description === "string"
                    ? entry.description
                    : null,
                qty: Number(entry.qty ?? 0),
                imageUrl:
                  typeof entry.imageUrl === "string" ? entry.imageUrl : null,
              }))
          : Array.isArray((json as Record<string, unknown> | undefined)?.data)
          ? ((json as Record<string, unknown>).data as unknown[])
              .map((entry) =>
                entry && typeof entry === "object"
                  ? (entry as Record<string, unknown>)
                  : null
              )
              .filter((entry): entry is Record<string, unknown> => entry !== null)
              .map((entry) => ({
                id: Number(entry.id ?? 0),
                name: String(entry.name ?? ""),
                sku:
                  typeof entry.sku === "string" ? entry.sku : null,
                sellPrice: Number(entry.sellPrice ?? 0),
                unit:
                  typeof entry.unit === "string" ? entry.unit : null,
                description:
                  typeof entry.description === "string"
                    ? entry.description
                    : null,
                qty: Number(entry.qty ?? 0),
                imageUrl:
                  typeof entry.imageUrl === "string" ? entry.imageUrl : null,
              }))
          : [];
        if (!alive) return;
        setProducts(
          rows.map((p) => ({
            id: p.id,
            name: p.name,
            sku: p.sku ?? null,
            sellPrice: p.sellPrice,
            unit: p.unit ?? null,
            description: p.description ?? null,
            qty: p.qty,
            imageUrl: p.imageUrl ?? null,
          }))
        );
      } catch {
        if (alive) setProducts([]);
      } finally {
        if (alive) setProductsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    void loadQuotation();
  }, [loadQuotation]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  if (loadingData) {
    return (
      <FeatureGuard feature="sales.quotation">
        <div className="flex min-h-screen items-center justify-center">
          <div className="flex items-center gap-3 text-gray-600">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600"></div>
            <span>Memuat data quotation...</span>
          </div>
        </div>
      </FeatureGuard>
    );
  }

  return (
    <FeatureGuard feature="sales.quotation">
    <div className="space-y-6">
      <PageBreadcrumb
        pageTitle="Ubah Quotation"
        items={[
          { label: "Penjualan", href: "/penjualan" },
          { label: "Quotation Penjualan", href: "/penjualan/quotation" },
          { label: "Ubah Quotation", href: `/penjualan/quotation/edit/${quotationId}` },
        ]}
      />

      <div className="min-h-screen rounded-2xl border border-gray-200 bg-white px-5 py-7 shadow-sm xl:px-10 xl:py-12">
        <div className="mx-auto w-full max-w-[1200px]">
          <h1 className="mb-6 text-2xl font-semibold text-gray-800">
            Quotation
          </h1>

          <div className="grid grid-cols-1 gap-6 rounded-xl border bg-gray-50/60 p-4 lg:grid-cols-2">
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Customer
                </label>
                <div className="min-h-[136px] rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-gray-700 shadow-sm">
                  {customersLoading ? (
                    <p className="text-gray-500">Memuat data customer...</p>
                  ) : activeCustomer ? (
                    <div className="space-y-1">
                      <p className="text-base font-semibold text-gray-800">
                        {activeCustomer.perusahaan}
                      </p>
                      <p className="text-gray-600">
                        PIC: {activeCustomer.pic || "-"}
                      </p>
                      {activeCustomer.alamat ? (
                        <p className="text-gray-500">{activeCustomer.alamat}</p>
                      ) : null}
                      <div className="pt-1 text-gray-500">
                        {activeCustomer.nohp ? <p>{activeCustomer.nohp}</p> : null}
                        {activeCustomer.email ? <p>{activeCustomer.email}</p> : null}
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500">Data customer tidak tersedia.</p>
                  )}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Project Description
                </label>
                <textarea
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  rows={4}
                  placeholder="Masukkan deskripsi singkat proyek..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
            </div>
          </div>

          <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Nomor Quotation
                  </label>
                  <input
                    value={quotationNumber}
                    readOnly
                    className="w-full cursor-not-allowed rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-sm shadow-sm text-gray-600"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Tanggal
                  </label>
                  <DatePicker value={date} onChange={setDate} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Valid Hingga
                  </label>
                  <DatePicker value={validUntil} onChange={setValidUntil} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Lampiran Proyek (Opsional)
                </label>
                <div className="flex flex-col justify-center rounded-lg border border-dashed border-gray-300 bg-white p-4 text-center shadow-sm">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,image/*"
                    className="hidden"
                    onChange={handleProjectFileChange}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                  >
                    <Paperclip className="h-5 w-5" />
                    {projectFilePreview ? "Ganti file lampiran" : "Pilih file untuk diunggah"}
                    <span className="text-xs text-gray-500">
                      Tarik & lepas, atau klik (Max 5MB)
                    </span>
                  </button>
                  {projectFilePreview ? (
                    <div className="mt-3 flex items-center justify-between rounded-lg border bg-gray-50 px-3 py-2 text-left text-xs text-gray-600">
                      <span className="truncate">
                        {projectFile?.name || projectFilePreview.split("/").pop()}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleProjectFile(null)}
                        className="ml-3 rounded-full p-1 text-red-500 hover:bg-red-50"
                        title="Hapus lampiran"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-800">
                Daftar Item
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    openProductModal(items.length ? items[items.length - 1].id : null)
                  }
                  className="flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-medium text-blue-600 shadow-sm transition hover:bg-blue-50"
                >
                  <PlusCircle className="h-4 w-4" />
                  Produk Baru
                </button>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-md transition hover:bg-blue-700"
                >
                  <PlusCircle className="h-4 w-4" />
                  Tambah Item
                </button>
              </div>
            </div>
            <div className="overflow-x-auto overflow-y-visible rounded-lg border shadow-sm">
              <table className="w-full overflow-visible text-sm">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    <th className="w-12 p-3 text-center">No</th>
                    <th className="w-52 p-3 text-left">Produk</th>
                    <th className="w-72 p-3 text-left">Deskripsi</th>
                    <th className="w-28 p-3 text-center">Gambar</th>
                    <th className="w-24 p-3 text-center">Qty</th>
                    <th className="w-28 p-3 text-center">Satuan</th>
                    <th className="w-32 p-3 text-right">Harga</th>
                    <th className="w-32 p-3 text-right">Subtotal</th>
                    <th className="w-12 p-3 text-center"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const selectedProduct =
                      item.productId ? productMap.get(item.productId) : undefined;
                    return (
                      <tr
                        key={item.id}
                        className="border-t align-top hover:bg-gray-50"
                      >
                        <td className="p-2 text-center">{idx + 1}</td>
                        <td className="p-2">
                          <div className="space-y-1">
                            <ProductDropdown
                              item={item}
                              selectedProduct={selectedProduct}
                              products={products}
                              loading={productsLoading}
                              onSelectProduct={(product) =>
                                applyProductOptionToRow(item.id, product)
                              }
                              onManualInput={(value) =>
                                handleManualProductEntry(item.id, value)
                              }
                              resolveProductByInput={findProductByInput}
                            />
                            <div className="text-[11px] text-gray-400">
                              {selectedProduct
                                ? `Stok: ${selectedProduct.qty ?? 0} ${
                                    selectedProduct.unit || "pcs"
                                  }`
                                : item.product
                                ? "Item manual"
                                : "Pilih produk atau isi manual"}
                            </div>
                          </div>
                        </td>
                        <td className="p-2">
                          <textarea
                            value={item.description}
                            onChange={(e) =>
                              handleItemChange(item.id, "description", e.target.value)
                            }
                            rows={2}
                            placeholder="Detail, warna, ukuran"
                            className="w-full min-w-[200px] resize-y rounded-md border border-gray-300 px-2 py-1 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                          />
                        </td>
                        <td className="p-2 text-center">
                          {item.imagePreview ? (
                            <div className="flex flex-col items-center gap-2">
                              <img
                                src={item.imagePreview}
                                alt="Preview"
                                className="h-16 w-16 rounded-md border object-cover"
                              />
                              {(item.image || isBlobUrl(item.imagePreview)) && (
                                <button
                                  type="button"
                                  onClick={() => handleItemImageChange(item.id, null)}
                                  className="text-xs text-red-600 hover:underline"
                                >
                                  Hapus
                                </button>
                              )}
                            </div>
                          ) : (
                            <label className="inline-block cursor-pointer rounded-lg bg-blue-50 px-3 py-1 text-xs text-blue-600 shadow-sm transition hover:bg-blue-100">
                              upload
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) =>
                                  handleItemImageChange(
                                    item.id,
                                    e.target.files?.[0] ?? null
                                  )
                                }
                              />
                            </label>
                          )}
                        </td>
                        <td className="p-2 text-center">
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) =>
                              handleItemChange(
                                item.id,
                                "quantity",
                                Math.max(1, Number(e.target.value) || 0)
                              )
                            }
                            className="w-full rounded-md border border-gray-300 px-2 py-1 text-center shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                          />
                        </td>
                        <td className="p-2 text-center">
                          {(() => {
                            const unitsSource = productUnits.length
                              ? productUnits
                              : [{ id: 0, name: "pcs", symbol: "pcs" }];
                            const hasCurrentUnit =
                              item.unit &&
                              !unitsSource.some(
                                (unit) =>
                                  unit.symbol.toLowerCase() === String(item.unit).toLowerCase()
                              );
                            return (
                              <select
                                value={item.unit || ""}
                                onChange={(e) =>
                                  handleItemChange(item.id, "unit", e.target.value || defaultUnit)
                                }
                                className="w-full rounded-lg border border-gray-300 px-2 py-1 text-center text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                              >
                                <option value="">{defaultUnit}</option>
                                {unitsSource.map((unit) => (
                                  <option key={unit.id} value={unit.symbol}>
                                    {unit.symbol} {unit.name !== unit.symbol ? `- ${unit.name}` : ""}
                                  </option>
                                ))}
                                {hasCurrentUnit ? (
                                  <option value={item.unit}>{item.unit}</option>
                                ) : null}
                              </select>
                            );
                          })()}
                        </td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            value={item.price}
                            onChange={(e) =>
                              handleItemChange(
                                item.id,
                                "price",
                                Math.max(0, Number(e.target.value) || 0)
                              )
                            }
                            className="w-full rounded-md border border-gray-300 px-2 py-1 text-right shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                          />
                        </td>
                        <td className="p-2 text-right font-semibold text-gray-700">
                          {(item.quantity * item.price).toLocaleString("id-ID", {
                            style: "currency",
                            currency: "IDR",
                            maximumFractionDigits: 0,
                          })}
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="rounded-full p-1 text-red-500 transition hover:bg-red-50 hover:text-red-700"
                            aria-label="Hapus item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex justify-end">
              <div className="w-full max-w-sm border-t pt-2 text-right text-xl font-semibold">
                Total:{" "}
                <span className="text-green-600">
                  {totalAmount.toLocaleString("id-ID", {
                    style: "currency",
                    currency: "IDR",
                    maximumFractionDigits: 0,
                  })}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-6" ref={dropdownRef}>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-100"
              >
                Batalkan
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="rounded-lg border border-red-200 px-5 py-2 text-sm font-medium text-red-600 shadow-sm transition hover:bg-red-50"
              >
                Hapus
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => !isSaving && setDropdownOpen((prev) => !prev)}
                  disabled={isSaving}
                  className={`flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-medium text-white shadow-md transition ${
                    isSaving
                      ? "cursor-not-allowed bg-green-400"
                      : "bg-green-600 hover:bg-green-700"
                  }`}
                >
                  {isSaving ? "Menyimpan..." : "Simpan"}
                  <ChevronDown className="h-4 w-4" />
                </button>
                {dropdownOpen && !isSaving && (
                  <div className="absolute right-0 bottom-full mb-2 w-56 overflow-hidden rounded-lg border border-gray-200 bg-white text-sm shadow-xl">
                    <button
                      type="button"
                      onClick={() => handleSave("Draft")}
                      className="block w-full px-4 py-2 text-left hover:bg-gray-100"
                    >
                      Simpan Draft
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSave("Confirmed")}
                      className="block w-full px-4 py-2 text-left hover:bg-gray-100"
                    >
                      Perbarui Quotation
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-lg font-semibold">Tambah Produk Baru</h2>
              <button
                onClick={closeProductModal}
                className="text-gray-400 hover:text-gray-600"
                disabled={savingProduct}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4 px-6 py-5 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Nama Produk *
                </label>
                <input
                  value={productDraft.name}
                  onChange={(e) =>
                    setProductDraft((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="Nama produk"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  disabled={savingProduct}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Satuan
                </label>
                <input
                  value={productDraft.unit}
                  onChange={(e) =>
                    setProductDraft((prev) => ({ ...prev, unit: e.target.value }))
                  }
                  placeholder="pcs"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  disabled={savingProduct}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Harga Jual
                </label>
                <input
                  type="number"
                  value={productDraft.sellPrice}
                  onChange={(e) =>
                    setProductDraft((prev) => ({
                      ...prev,
                      sellPrice: Number(e.target.value) || 0,
                    }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-right shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  disabled={savingProduct}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Harga Beli
                </label>
                <input
                  type="number"
                  value={productDraft.buyPrice}
                  onChange={(e) =>
                    setProductDraft((prev) => ({
                      ...prev,
                      buyPrice: Number(e.target.value) || 0,
                    }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-right shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  disabled={savingProduct}
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Deskripsi
                </label>
                <textarea
                  value={productDraft.description}
                  onChange={(e) =>
                    setProductDraft((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  rows={3}
                  placeholder="Deskripsi singkat produk"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  disabled={savingProduct}
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Foto Produk
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    ref={productPhotoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) =>
                      handleProductPhotoSelection(e.target.files?.[0] ?? null)
                    }
                    disabled={savingProduct}
                  />
                  <button
                    type="button"
                    onClick={() => productPhotoInputRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-600 shadow-sm transition hover:bg-blue-100 disabled:opacity-60"
                    disabled={savingProduct}
                  >
                    <Paperclip className="h-4 w-4" />
                    Upload Foto
                  </button>
                  {productDraftPhoto ? (
                    <>
                      <span className="text-xs text-gray-600">
                        {productDraftPhoto.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleProductPhotoSelection(null)}
                        className="text-xs font-medium text-red-600 hover:underline"
                        disabled={savingProduct}
                      >
                        Hapus
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-gray-400">Belum ada file.</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t px-6 py-4">
              <button
                type="button"
                onClick={closeProductModal}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-100 disabled:opacity-50"
                disabled={savingProduct}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleCreateProduct}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                disabled={savingProduct}
              >
                {savingProduct ? "Menyimpan..." : "Simpan Produk"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Tambah Customer</h2>
              <button
                onClick={() => setIsCustomerModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  PIC
                </label>
                <input
                  value={newCustomer.pic}
                  onChange={(e) => handleCustomerFieldChange("pic", e.target.value)}
                  className={`w-full rounded-lg px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 ${
                    customerErrors.pic
                      ? "border border-red-500 focus:border-red-500 focus:ring-red-500/60"
                      : "border border-gray-300 focus:border-blue-500 focus:ring-blue-200"
                  }`}
                  placeholder="Nama PIC"
                />
                {customerErrors.pic ? (
                  <p className="mt-1 text-xs text-red-600">{customerErrors.pic}</p>
                ) : null}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  type="email"
                  value={newCustomer.email ?? ""}
                  onChange={(e) => handleCustomerFieldChange("email", e.target.value)}
                  className={`w-full rounded-lg px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 ${
                    customerErrors.email
                      ? "border border-red-500 focus:border-red-500 focus:ring-red-500/60"
                      : "border border-gray-300 focus:border-blue-500 focus:ring-blue-200"
                  }`}
                  placeholder="nama@email.com"
                  autoComplete="email"
                />
                {customerErrors.email ? (
                  <p className="mt-1 text-xs text-red-600">{customerErrors.email}</p>
                ) : null}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Perusahaan
                </label>
                <input
                  value={newCustomer.perusahaan}
                  onChange={(e) => handleCustomerFieldChange("perusahaan", e.target.value)}
                  className={`w-full rounded-lg px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 ${
                    customerErrors.perusahaan
                      ? "border border-red-500 focus:border-red-500 focus:ring-red-500/60"
                      : "border border-gray-300 focus:border-blue-500 focus:ring-blue-200"
                  }`}
                  placeholder="Nama perusahaan"
                />
                {customerErrors.perusahaan ? (
                  <p className="mt-1 text-xs text-red-600">{customerErrors.perusahaan}</p>
                ) : null}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Alamat
                </label>
                <textarea
                  value={newCustomer.alamat}
                  onChange={(e) => handleCustomerFieldChange("alamat", e.target.value)}
                  rows={2}
                  className={`w-full rounded-lg px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 ${
                    customerErrors.alamat
                      ? "border border-red-500 focus:border-red-500 focus:ring-red-500/60"
                      : "border border-gray-300 focus:border-blue-500 focus:ring-blue-200"
                  }`}
                  placeholder="Alamat lengkap"
                />
                {customerErrors.alamat ? (
                  <p className="mt-1 text-xs text-red-600">{customerErrors.alamat}</p>
                ) : null}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  No HP
                </label>
                <input
                  value={newCustomer.nohp}
                  onChange={(e) => handleCustomerPhoneChange(e.target.value)}
                  maxLength={12}
                  inputMode="numeric"
                  placeholder="Masukkan 10-12 digit"
                  className={`w-full rounded-lg px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 ${
                    customerErrors.nohp
                      ? "border border-red-500 focus:border-red-500 focus:ring-red-500/60"
                      : "border border-gray-300 focus:border-blue-500 focus:ring-blue-200"
                  }`}
                />
                {customerErrors.nohp ? (
                  <p className="mt-1 text-xs text-red-600">{customerErrors.nohp}</p>
                ) : (
                  <p className="mt-1 text-xs text-gray-500">
                    Masukkan 10-12 digit angka tanpa spasi atau simbol.
                  </p>
                )}
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCustomerModalOpen(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-100"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleAddCustomer}
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
