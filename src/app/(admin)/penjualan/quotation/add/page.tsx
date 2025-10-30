"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
// ✅ Import useRouter dari next/navigation
import { useRouter } from "next/navigation"; 
import dayjs from "dayjs";
import { PlusCircle, Trash2, ChevronDown, Paperclip, X } from "lucide-react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import toast from "react-hot-toast";
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

const toProductLabel = (product: ProductOption) =>
  product.sku ? `${product.name} (${product.sku})` : product.name;

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

type CustomerDropdownProps = {
  customers: Customer[];
  value: number | "";
  onChange: (val: number | "") => void;
  loading: boolean;
  placeholder?: string;
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
      const left = Math.min(Math.max(rect.left + scrollX, viewportLeft), viewportRight);
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
    const raf = requestAnimationFrame(updatePosition);
    const handleScroll = () => updatePosition();
    const handleResize = () => updatePosition();
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);
    return () => {
      cancelAnimationFrame(raf);
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
            ? toProductLabel(selectedProduct)
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
                            `Harga: ${Number(prod.sellPrice || 0).toLocaleString(
                              "id-ID",
                              {
                                style: "currency",
                                currency: "IDR",
                                maximumFractionDigits: 0,
                              }
                            )}`,
                            `Stok: ${prod.qty} ${prod.unit || "pcs"}`,
                          ]
                            .filter(Boolean)
                            .join(" • ")}
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
                    {matchedProduct
                      ? `Pilih "${trimmedQuery}"`
                      : `Gunakan "${trimmedQuery}" sebagai nama item`}
                  </button>
                ) : null}
                {(item.productId || item.product) && (
                  <button
                    type="button"
                    onClick={() => {
                      onManualInput("");
                      setQuery("");
                      setOpen(false);
                    }}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Kosongkan pilihan
                  </button>
                )}
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
};

const CustomerDropdown: React.FC<CustomerDropdownProps> = ({
  customers,
  value,
  onChange,
  loading,
  placeholder = "Pilih customer...",
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const portalRef = useRef<HTMLDivElement | null>(null);
  const [menuStyles, setMenuStyles] = useState<React.CSSProperties>({});

  const selected =
    typeof value === "number"
      ? customers.find((cust) => cust.id === value) ?? null
      : null;

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current?.contains(target) ||
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
      const minWidth = 300;
      const maxWidth = 420;
      const width = Math.min(Math.max(rect.width, minWidth), maxWidth);
      const padding = 12;
      const availableRight = window.innerWidth - padding - width;
      const left = Math.min(Math.max(rect.left, padding), availableRight);
      let top = rect.bottom + 8;
      const estimatedHeight = 360;
      if (top + estimatedHeight > window.innerHeight - padding) {
        top = Math.max(rect.top - 8 - estimatedHeight, padding);
      }
      setMenuStyles({
        position: "fixed",
        top,
        left,
        width,
        zIndex: 70,
      });
    };
    updatePosition();
    const handler = () => updatePosition();
    window.addEventListener("scroll", handler, true);
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("scroll", handler, true);
      window.removeEventListener("resize", handler);
    };
  }, [open]);

  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  const filteredCustomers = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return customers.slice(0, 50);
    return customers
      .filter((cust) => {
        return (
          cust.pic.toLowerCase().includes(term) ||
          cust.perusahaan.toLowerCase().includes(term) ||
          cust.nohp.toLowerCase().includes(term) ||
          (cust.email ?? "").toLowerCase().includes(term)
        );
      })
      .slice(0, 50);
  }, [customers, query]);

  const handleSelect = (cust: Customer) => {
    onChange(cust.id);
    setOpen(false);
  };

  const handleClear = () => {
    onChange("");
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-left text-sm text-gray-800 shadow-sm transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-200"
      >
        <span className="truncate">
          {selected ? (
            <>
              <span className="font-medium">{selected.pic}</span>
              <span className="text-gray-500">{` - ${selected.perusahaan}`}</span>
            </>
          ) : (
            <span className="text-gray-500">
              {loading ? "Memuat customer..." : placeholder}
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
              className="max-w-[calc(100vw-3rem)] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl"
            >
              <div className="border-b border-gray-200 p-2">
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Cari PIC, perusahaan, email, atau nomor HP..."
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div className="max-h-72 overflow-y-auto">
                {loading ? (
                  <div className="px-4 py-3 text-sm text-gray-500">
                    Memuat customer...
                  </div>
                ) : filteredCustomers.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-gray-500">
                    Customer tidak ditemukan.
                  </div>
                ) : (
                  filteredCustomers.map((cust) => {
                    const active = cust.id === selected?.id;
                    return (
                      <button
                        key={cust.id}
                        type="button"
                        onClick={() => handleSelect(cust)}
                        className={`block w-full px-4 py-3 text-left text-sm hover:bg-gray-50 ${
                          active ? "bg-blue-50" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-800">
                            {cust.pic}
                          </span>
                          <span className="text-xs text-gray-400">
                            {cust.nohp}
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-gray-500">
                          {cust.perusahaan}
                        </div>
                        {cust.email ? (
                          <div className="mt-0.5 text-[11px] text-gray-400">
                            {cust.email}
                          </div>
                        ) : null}
                      </button>
                    );
                  })
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
                {value !== "" ? (
                  <button
                    type="button"
                    onClick={handleClear}
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

// ====================================================================
// Komponen Utama
// ====================================================================

import FeatureGuard from "@/components/FeatureGuard";

export default function AddQuotationPage() {
  const router = useRouter();

  // Header fields
  const [quotationNumber, setQuotationNumber] = useState("");
  const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [validUntil, setValidUntil] = useState(
    dayjs().add(7, "day").format("YYYY-MM-DD")
  );
  const [projectDescription, setProjectDescription] = useState("");
  const [projectFile, setProjectFile] = useState<File | null>(null);
  const { units: productUnits } = useProductUnits();
  const defaultUnit = useMemo(() => productUnits[0]?.symbol || "pcs", [productUnits]);

  // Customers
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<number | "">("");
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState<
    Required<Omit<Customer, "id">> & { id: number }
  >(() => ({ ...EMPTY_CUSTOMER_FORM }));
  const [customerErrors, setCustomerErrors] = useState({
    ...INITIAL_CUSTOMER_ERRORS,
  });
  const [customersLoading, setCustomersLoading] = useState(true);

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
    const digitsOnly = value.replace(/\D+/g, "").slice(0, 12);
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

  // Items
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productsLoading, setProductsLoading] = useState<boolean>(true);
  const [items, setItems] = useState<QuotationItem[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [pendingProductRowId, setPendingProductRowId] = useState<number | null>(null);
  const [productDraftPhoto, setProductDraftPhoto] = useState<File | null>(null);
  const productPhotoInputRef = useRef<HTMLInputElement | null>(null);
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

  const findProductByInput = (value: string) => {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return null;
    return (
      products.find((prod) => {
        const label = toProductLabel(prod).toLowerCase();
        const name = prod.name.toLowerCase();
        const sku = prod.sku?.toLowerCase();
        return label === trimmed || name === trimmed || (sku && sku === trimmed);
      }) || null
    );
  };

  const applyProductOptionToRow = (rowId: number, product: ProductOption) => {
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
          if (isBlobUrl(next.imagePreview)) URL.revokeObjectURL(next.imagePreview!);
          next.image = null;
          next.imagePreview = product.imageUrl;
        }
        return next;
      })
    );
  };

  const handleManualProductEntry = (rowId: number, rawValue: string) => {
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
          if (isBlobUrl(next.imagePreview)) {
            URL.revokeObjectURL(next.imagePreview!);
          }
          next.image = null;
          next.imagePreview = null;
        } else if (
          item.productId &&
          item.imagePreview &&
          !isBlobUrl(item.imagePreview)
        ) {
          next.image = null;
          next.imagePreview = null;
        }
        return next;
      })
    );
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
      if (productDraft.description.trim()) fd.append("description", productDraft.description.trim());
      if (productDraftPhoto) fd.append("photo", productDraftPhoto);
      const res = await fetch("/api/products", { method: "POST", body: fd });
      const saved = await res.json();
      if (!res.ok) {
        toast.error(saved?.error || "Gagal menambah produk");
        return;
      }
      const mapped: ProductOption = {
        id: Number(saved.id),
        name: saved.name,
        sku: saved.sku ?? null,
        sellPrice: Number(saved.sellPrice || 0),
        unit: saved.unit ?? null,
        description: saved.description ?? null,
        qty: Number(saved.qty || 0),
        imageUrl: saved.imageUrl ?? null,
      };
      setProducts((prev) => [mapped, ...prev.filter((p) => p.id !== mapped.id)]);
      if (pendingProductRowId != null) {
        applyProductOptionToRow(pendingProductRowId, mapped);
      }
      toast.success("Produk berhasil ditambahkan");
      closeProductModal();
    } catch (err: any) {
      toast.error(err?.message || "Gagal menyimpan produk");
    } finally {
      setSavingProduct(false);
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/products", { cache: "no-store" });
        const json = await res.json();
        const rows: any[] = Array.isArray(json) ? json : (Array.isArray(json?.data) ? json.data : []);
        if (!alive) return;
        setProducts(
          rows.map((p: any) => ({
            id: Number(p.id),
            name: String(p.name || ""),
            sku: p.sku ?? null,
            sellPrice: Number(p.sellPrice || 0),
            unit: p.unit ?? null,
            description: p.description ?? null,
            qty: Number(p.qty || 0),
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

  // Fungsi untuk mengambil nomor quotation baru
  const fetchNewQuotationNumber = async () => {
    try {
      const res = await fetch("/api/quotations/new-number", { cache: "no-store" });
      if (!res.ok) throw new Error("Gagal ambil nomor baru");
      const data = await res.json();
      return data.quotationNumber;
    } catch (err) {
      console.error(err);
      return "QOUT-ERROR-001"; // Fallback value
    }
  };

  // Fetch initial data (quotation number & customer)
  useEffect(() => {
    const init = async () => {
        setQuotationNumber(await fetchNewQuotationNumber());
        fetchCustomers();
    };
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close dropdown when clicking outside
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

  const fetchCustomers = async () => {
    setCustomersLoading(true);
    try {
      const res = await fetch("/api/customers", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load customers");
      const data = await res.json();
      const mapped: Customer[] = data.map((c: any) => ({
        id: c.id,
        pic: c.pic,
        email: c.email ?? null,
        perusahaan: c.company,
        alamat: c.address,
        nohp: normalizePhoneNumber(String(c.phone ?? "")),
      }));
      setCustomers(mapped);
    } catch (err) {
      console.error("Gagal ambil customer:", err);
    } finally {
      setCustomersLoading(false);
    }
  };

  // ✅ Fungsi untuk mereset semua field
  const handleReset = async () => {
    setDropdownOpen(false);
    setQuotationNumber(await fetchNewQuotationNumber());
    setDate(dayjs().format("YYYY-MM-DD"));
    setValidUntil(dayjs().add(7, "day").format("YYYY-MM-DD"));
    setProjectDescription("");
    setProjectFile(null);
    setSelectedCustomer("");
    setNewCustomer({ ...EMPTY_CUSTOMER_FORM });
    clearCustomerErrors();

    items.forEach((item) => {
      if (item.imagePreview && isBlobUrl(item.imagePreview)) URL.revokeObjectURL(item.imagePreview);
    });
    setItems([]);

    toast.success("Form dikosongkan dan siap untuk input baru.");
  };

  const handleCancel = () => {
    router.push("/penjualan/quotation");
  };

  // Item helpers
  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: Date.now(),
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
    id: number,
    field: K,
    value: QuotationItem[K]
  ) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, [field]: value } : it))
    );
  };

  const handleItemImageChange = (id: number, file: File | null) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        if (it.imagePreview && isBlobUrl(it.imagePreview)) URL.revokeObjectURL(it.imagePreview);
        return {
          ...it,
          image: file,
          imagePreview: file ? URL.createObjectURL(file) : null,
        };
      })
    );
  };

  const handleRemoveItem = (id: number) => {
    setItems((prev) => {
      const target = prev.find((x) => x.id === id);
      if (isBlobUrl(target?.imagePreview)) URL.revokeObjectURL(target!.imagePreview!);
      return prev.filter((x) => x.id !== id);
    });
  };

  const calculateSubtotal = (item: QuotationItem) =>
    item.quantity * item.price;
  const grandTotal = useMemo(
    () => items.reduce((sum, it) => sum + calculateSubtotal(it), 0),
    [items]
  );

  // Project file
  const handleProjectFile = (file: File | null) => setProjectFile(file);

  // Tambah customer (dibiarkan sama)
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
      const data = await res.json();
        const created: Customer = {
          id: data.id,
          pic: data.pic?.trim() || pic,
          email: data.email ?? email ?? null,
          perusahaan: data.company?.trim() || perusahaan,
          alamat: data.address?.trim() || alamat,
          nohp: data.phone
            ? normalizePhoneNumber(String(data.phone ?? ""))
            : normalizedPhone,
        };
      setCustomers((prev) => [...prev, created]);
      setSelectedCustomer(created.id);
      setNewCustomer({ ...EMPTY_CUSTOMER_FORM });
      clearCustomerErrors();
      setIsCustomerModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Gagal menambah customer.");
    }
  };

  // Submit Quotation
const submitQuotation = async (variant: "Draft" | "Confirmed" | "SendPDF") => {
    if (!selectedCustomer) {
      toast.error("Pilih customer terlebih dahulu.");
      return;
    }
    if (items.length === 0) {
      toast.error("Tambahkan minimal 1 item.");
      return;
    }
    if (items.some((it) => !it.product.trim())) {
      toast.error("Nama produk wajib diisi pada setiap item.");
      return;
    }

    const form = new FormData();
    form.append("quotationNumber", quotationNumber);
    form.append("date", date);
    form.append("validUntil", validUntil);
    // ✅ Tidak ada perubahan di sini. Frontend sudah mengirim field yang benar.
    form.append("projectDescription", projectDescription); 
    form.append("customerId", String(selectedCustomer));
    form.append("status", variant);

    if (projectFile) {
      form.append("projectFile", projectFile);
    }

    const itemsPayload = items.map((it, idx) => {
      const existingImageUrl =
        !it.image && it.imagePreview && !isBlobUrl(it.imagePreview)
          ? it.imagePreview
          : null;
      return {
        product: it.product,
        description: it.description,
        quantity: it.quantity,
        unit: it.unit,
        price: it.price,
        imageKey: it.image ? `itemImage_${idx}` : null,
        imageUrl: existingImageUrl,
      };
    });
    form.append("items", JSON.stringify(itemsPayload));
    
    items.forEach((it, idx) => {
      if (it.image) {
        // ✅ Ini juga sudah benar. Kunci file (itemImage_0, itemImage_1, dst.)
        //    cocok dengan yang didefinisikan di `imageKey`.
        form.append(`itemImage_${idx}`, it.image, it.image.name);
      }
    });

    try {
      const res = await fetch("/api/quotations", {
        method: "POST",
        body: form,
        credentials: "include",
      });
      if (!res.ok) {
        const ctype = res.headers.get("content-type") || "";
        if (ctype.includes("application/json")) {
          const t = await res.json();
          console.error("Submit failed:", t);
          toast.error(`Gagal menyimpan: ${t.message || 'Error tidak diketahui'}`);
        } else {
          const txt = await res.text();
          const redirectedToSignin = res.redirected || res.url.includes("/signin") || /<!DOCTYPE/i.test(txt);
          if (redirectedToSignin) {
            toast.error("Sesi login tidak aktif. Silakan masuk kembali.");
            router.push(`/signin?redirect=${encodeURIComponent('/penjualan/quotation/add')}`);
          } else {
            console.error("Non-JSON error response:", txt);
            toast.error("Gagal menyimpan: respons tidak valid dari server.");
          }
        }
        return;
      }

      toast.success(`Quotation berhasil disimpan (${variant}).`);
      router.push("/penjualan/quotation");
    } catch (err) {
      console.error(err);
      toast.error("Terjadi kesalahan saat menyimpan quotation.");
    }
  };


  return (
    <FeatureGuard feature="sales.quotation">
    <div>
      {/* 🧭 Breadcrumb */}
      <PageBreadcrumb pageTitle="Buat Quotation" />

      {/* 📦 Wrapper dari Blank Template */}
      <div className="min-h-screen rounded-2xl border border-gray-200 bg-white px-5 py-7 dark:border-gray-800 dark:bg-white/[0.03] xl:px-10 xl:py-12">
        <div className="mx-auto w-full max-w-[1200px]">
          <h1 className="text-2xl font-semibold mb-6">Quotation</h1>

          <form onSubmit={(e) => e.preventDefault()} className="space-y-8">
            {/* Customer (Dibiarkan sama) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 border rounded-lg bg-gray-50/50">
              <div>
                <label className="block text-sm font-medium mb-1">Customer</label>
                <div className="flex gap-2">
                  <CustomerDropdown
                    customers={customers}
                    value={selectedCustomer}
                    onChange={(val) => setSelectedCustomer(val)}
                    loading={customersLoading}
                    placeholder="Pilih customer..."
                  />
                  <button
                    type="button"
                    onClick={() => setIsCustomerModalOpen(true)}
                    className="flex-shrink-0 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm transition shadow-md"
                  >
                    + Tambah
                  </button>
                </div>
              </div>

              {selectedCustomer ? (
                <div className="border rounded-lg p-3 bg-white text-sm shadow-md">
                  {(() => {
                    const c = customers.find(
                      (x) => x.id === Number(selectedCustomer)
                    );
                    if (!c) return null;
                    return (
                      <>
                        <div className="font-semibold text-gray-700">Data Customer</div>
                        <div className="mt-1 space-y-0.5">
                          <p>
                            <strong>PIC:</strong> {c.pic}
                          </p>
                          <p>
                            <strong>Perusahaan:</strong> {c.perusahaan}
                          </p>
                          <p>
                            <strong>Alamat:</strong> {c.alamat}
                          </p>
                          <p>
                            <strong>No HP:</strong> {c.nohp}
                          </p>
                          <p>
                            <strong>Email:</strong> {c.email ?? "-"}
                          </p>
                        </div>
                      </>
                    );
                  })()}
                </div>
              ) : (
                <div className="border border-dashed rounded-lg p-3 bg-white flex items-center justify-center text-sm text-gray-400">
                  Detail Customer akan muncul di sini.
                </div>
              )}
            </div>

            {/* Project Info (Dibiarkan sama) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Nomor Quotation
                </label>
                <input
                  type="text"
                  value={quotationNumber}
                  readOnly
                  className="w-full border rounded-lg px-3 py-2 bg-gray-100 cursor-not-allowed text-gray-700 shadow-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Tanggal
                </label>
                <DatePicker
                  selected={date ? new Date(date) : null}
                  onChange={(val) =>
                    setDate(val ? dayjs(val).format("YYYY-MM-DD") : "")
                  }
                  dateFormat="dd/MM/yyyy"
                  className="w-full border rounded-lg px-3 py-2 cursor-pointer shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Valid Hingga
                </label>
                <DatePicker
                  selected={validUntil ? new Date(validUntil) : null}
                  onChange={(val) =>
                    setValidUntil(val ? dayjs(val).format("YYYY-MM-DD") : "")
                  }
                  dateFormat="dd/MM/yyyy"
                  className="w-full border rounded-lg px-3 py-2 cursor-pointer shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Project Description & Lampiran (Dibiarkan sama) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Project Description
                </label>
                <textarea
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 resize-y shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  rows={4}
                  placeholder="Masukkan deskripsi singkat proyek..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Lampiran Proyek (Opsional)
                </label>
                <div className="h-full border rounded-lg p-3 flex flex-col justify-center shadow-sm bg-white">
                  {projectFile ? (
                    <div className="flex items-center justify-between bg-gray-50 border rounded-lg p-2">
                      <div className="flex items-center gap-2 truncate">
                        <Paperclip className="w-4 h-4 text-gray-500" />
                        <span className="text-sm truncate max-w-[80%]">
                          {projectFile.name}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleProjectFile(null)}
                        className="text-red-600 hover:text-red-800 p-1 rounded-full hover:bg-red-50 transition"
                        title="Hapus file"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-4 cursor-pointer hover:bg-gray-50 transition">
                      <div className="text-center">
                        <Paperclip className="w-5 h-5 mx-auto text-blue-500 mb-1" />
                        <p className="text-sm text-blue-600 font-medium">
                          Pilih file untuk diunggah
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Tarik & Lepas, atau Klik (Max 5MB)
                        </p>
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) =>
                          handleProjectFile(e.target.files?.[0] ?? null)
                        }
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>

            {/* Item Table (Dibiarkan sama) */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-semibold text-lg">Daftar Item</h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openProductModal(items.length ? items[items.length - 1].id : null)}
                    className="flex items-center gap-2 border border-blue-200 text-blue-600 px-3 py-2 rounded-lg hover:bg-blue-50 text-sm transition"
                  >
                    <PlusCircle className="w-4 h-4" />
                    Produk Baru
                  </button>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 text-sm transition shadow-md"
                  >
                    <PlusCircle className="w-4 h-4" />
                    Tambah Item
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto overflow-y-visible rounded-lg border shadow-sm">
                <table className="w-full overflow-visible text-sm">
                  <thead className="bg-gray-100 text-gray-700">
                    <tr>
                      <th className="p-3 w-10 text-center">No</th>
                      <th className="p-3 w-40 text-left">Produk</th>
                      <th className="p-3 w-40 text-left">Deskripsi</th>
                      <th className="p-3 w-36 text-center">Gambar</th>
                      <th className="p-3 w-20 text-center">Qty</th>
                      <th className="p-3 w-24 text-center">Satuan</th>
                      <th className="p-3 w-32 text-right">Harga</th>
                      <th className="p-3 w-36 text-right">Sub Total</th>
                      <th className="p-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="overflow-visible">
                    {items.length === 0 && (
                      <tr>
                        <td
                          colSpan={9}
                          className="text-center text-gray-400 py-4 italic"
                        >
                          Belum ada item
                        </td>
                      </tr>
                    )}
                    {items.map((item, idx) => {
                      const selectedProduct = item.productId
                        ? productMap.get(item.productId)
                        : undefined;
                      return (
                        <tr
                          key={item.id}
                          className="border-t hover:bg-gray-50 align-top overflow-visible"
                        >
                          <td className="p-2 text-center">{idx + 1}</td>
                          <td className="p-2 align-top">
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
                              <div className="flex items-center justify-between text-[11px]">
                                {selectedProduct ? (
                                  <div className="flex flex-wrap gap-x-3 text-gray-400">
                                    <span>
                                      Stok: {selectedProduct.qty ?? 0}{" "}
                                      {selectedProduct.unit || "pcs"}
                                    </span>
                                  </div>
                                ) : item.product ? (
                                  <span className="text-gray-400">Item manual</span>
                                ) : (
                                  <span className="text-gray-300">
                                    Pilih produk atau isi manual
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="p-2">
                            <textarea
                              value={item.description}
                              onChange={(e) =>
                                handleItemChange(
                                  item.id,
                                  "description",
                                  e.target.value
                                )
                              }
                              className="w-full min-w-[180px] resize-y rounded-md border px-2 py-1 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                              rows={2}
                              placeholder="Detail, warna, ukuran"
                            />
                          </td>
                          <td className="p-2 text-center align-top">
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
                                    onClick={() =>
                                      handleItemImageChange(item.id, null)
                                    }
                                    className="text-xs text-red-600 hover:underline"
                                  >
                                    Hapus
                                  </button>
                                )}
                              </div>
                            ) : (
                              <label className="inline-block cursor-pointer rounded-lg bg-blue-50 px-3 py-1 text-xs text-blue-600 shadow-sm hover:bg-blue-100">
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
                                  Number(e.target.value)
                                )
                              }
                              className="w-full rounded-md border px-2 py-1 text-center shadow-sm focus:border-blue-500 focus:ring-blue-500"
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
                                  className="w-full rounded-md border px-2 py-1 text-center text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
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
                                  Number(e.target.value)
                                )
                              }
                              className="w-full rounded-md border px-2 py-1 text-right shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            />
                          </td>
                          <td className="p-2 text-right font-medium text-gray-800">
                            {calculateSubtotal(item).toLocaleString("id-ID", {
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

              <div className="flex justify-end mt-4">
                <div className="text-right font-semibold text-xl border-t pt-2 w-full max-w-sm">
                  Total:{" "}
                  <span className="text-green-600">
                    {grandTotal.toLocaleString("id-ID", {
                      style: "currency",
                      currency: "IDR",
                      maximumFractionDigits: 0,
                    })}
                  </span>
                </div>
              </div>
            </div>

            {/* ✅ Save Dropdown & Tombol Batalkan - Sudah Dirapikan */}
            <div className="flex justify-end gap-3 relative pt-4" ref={dropdownRef}>
              {/* Tombol Batalkan */}
              <button
                type="button"
                onClick={handleCancel}
                className="px-5 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition shadow-md"
              >
                Batalkan
              </button>
              <button
                type="button"
                onClick={() => { void handleReset(); }}
                className="px-5 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition shadow-md"
              >
                Hapus
              </button>

              {/* Tombol Simpan */}
              <button
                type="button"
                onClick={() => setDropdownOpen((s) => !s)}
                className="bg-green-600 text-white px-5 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 transition shadow-lg"
              >
                Simpan
                <ChevronDown className="w-4 h-4" />
              </button>

              {dropdownOpen && (
                <div 
                  // ✅ FIX: Diubah menjadi bottom-full agar muncul di atas tombol
                  className="absolute right-0 bottom-full mb-2 w-56 bg-white border rounded-lg shadow-xl z-10 text-sm overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => {
                      submitQuotation("Draft");
                      setDropdownOpen(false);
                    }}
                    className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                  >
                    Simpan Draft
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      submitQuotation("Confirmed");
                      setDropdownOpen(false);
                    }}
                    className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                  >
                    Simpan & Konfirmasi
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      submitQuotation("SendPDF");
                      setDropdownOpen(false);
                    }}
                    className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                  >
                    Simpan & Kirim (PDF)
                  </button>
                </div>
              )}
            </div>
          </form>

          {isProductModalOpen && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl">
                <div className="flex items-center justify-between border-b px-6 py-4">
                  <h2 className="text-lg font-semibold">Tambah Produk Baru</h2>
                  <button
                    onClick={closeProductModal}
                    className="text-gray-400 hover:text-gray-600 text-xl"
                    disabled={savingProduct}
                  >
                    &times;
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-6 py-5">
                  <div>
                    <label className="block text-sm font-medium mb-1">Nama Produk *</label>
                    <input
                      value={productDraft.name}
                      onChange={(e) => setProductDraft((prev) => ({ ...prev, name: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Nama produk"
                      disabled={savingProduct}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Satuan</label>
                    <input
                      value={productDraft.unit}
                      onChange={(e) => setProductDraft((prev) => ({ ...prev, unit: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="pcs"
                      disabled={savingProduct}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">Harga Jual</label>
                      <input
                        type="number"
                        value={productDraft.sellPrice}
                        onChange={(e) => setProductDraft((prev) => ({ ...prev, sellPrice: Number(e.target.value) || 0 }))}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500 text-right"
                        min={0}
                        disabled={savingProduct}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Harga Beli</label>
                      <input
                        type="number"
                        value={productDraft.buyPrice}
                        onChange={(e) => setProductDraft((prev) => ({ ...prev, buyPrice: Number(e.target.value) || 0 }))}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500 text-right"
                        min={0}
                        disabled={savingProduct}
                      />
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1">Deskripsi</label>
                    <textarea
                      value={productDraft.description}
                      onChange={(e) => setProductDraft((prev) => ({ ...prev, description: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                      rows={3}
                      placeholder="Deskripsi singkat produk"
                      disabled={savingProduct}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1">Foto Produk</label>
                    <div className="flex flex-wrap items-center gap-3">
                      <input
                        ref={productPhotoInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleProductPhotoSelection(e.target.files?.[0] ?? null)}
                        disabled={savingProduct}
                      />
                      <button
                        type="button"
                        onClick={() => productPhotoInputRef.current?.click()}
                        className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-600 shadow-sm hover:bg-blue-100 disabled:opacity-60"
                        disabled={savingProduct}
                      >
                        <Paperclip className="h-4 w-4" />
                        Upload Foto
                      </button>
                      {productDraftPhoto ? (
                        <>
                          <span className="text-xs text-gray-600">{productDraftPhoto.name}</span>
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
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-100"
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

          {/* Modal Tambah Customer (Dibiarkan sama) */}
          {isCustomerModalOpen && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold">Tambah Customer</h2>
                  <button
                    onClick={() => setIsCustomerModalOpen(false)}
                    className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm mb-1 font-medium">
                      PIC
                    </label>
                    <input
                      type="text"
                      value={newCustomer.pic}
                      onChange={(e) => handleCustomerFieldChange("pic", e.target.value)}
                      className={`w-full rounded-lg px-3 py-2 shadow-sm focus:outline-none focus:ring-2 ${
                        customerErrors.pic
                          ? "border border-red-500 focus:ring-red-500/60 focus:border-red-500"
                          : "border border-gray-300 focus:ring-blue-200 focus:border-blue-500"
                      }`}
                      placeholder="Nama PIC"
                    />
                    {customerErrors.pic ? (
                      <p className="mt-1 text-xs text-red-600">{customerErrors.pic}</p>
                    ) : null}
                  </div>
                  <div>
                    <label className="block text-sm mb-1 font-medium">
                      Email
                    </label>
                    <input
                      type="email"
                      value={newCustomer.email ?? ""}
                      onChange={(e) => handleCustomerFieldChange("email", e.target.value)}
                      className={`w-full rounded-lg px-3 py-2 shadow-sm focus:outline-none focus:ring-2 ${
                        customerErrors.email
                          ? "border border-red-500 focus:ring-red-500/60 focus:border-red-500"
                          : "border border-gray-300 focus:ring-blue-200 focus:border-blue-500"
                      }`}
                      placeholder="nama@email.com"
                      autoComplete="email"
                    />
                    {customerErrors.email ? (
                      <p className="mt-1 text-xs text-red-600">{customerErrors.email}</p>
                    ) : null}
                  </div>
                  <div>
                    <label className="block text-sm mb-1 font-medium">
                      Perusahaan
                    </label>
                    <input
                      type="text"
                      value={newCustomer.perusahaan}
                      onChange={(e) => handleCustomerFieldChange("perusahaan", e.target.value)}
                      className={`w-full rounded-lg px-3 py-2 shadow-sm focus:outline-none focus:ring-2 ${
                        customerErrors.perusahaan
                          ? "border border-red-500 focus:ring-red-500/60 focus:border-red-500"
                          : "border border-gray-300 focus:ring-blue-200 focus:border-blue-500"
                      }`}
                      placeholder="Nama perusahaan"
                    />
                    {customerErrors.perusahaan ? (
                      <p className="mt-1 text-xs text-red-600">{customerErrors.perusahaan}</p>
                    ) : null}
                  </div>
                  <div>
                    <label className="block text-sm mb-1 font-medium">
                      Alamat
                    </label>
                    <textarea
                      value={newCustomer.alamat}
                      onChange={(e) => handleCustomerFieldChange("alamat", e.target.value)}
                      className={`w-full rounded-lg px-3 py-2 resize-y shadow-sm focus:outline-none focus:ring-2 ${
                        customerErrors.alamat
                          ? "border border-red-500 focus:ring-red-500/60 focus:border-red-500"
                          : "border border-gray-300 focus:ring-blue-200 focus:border-blue-500"
                      }`}
                      rows={2}
                      placeholder="Alamat lengkap"
                    />
                    {customerErrors.alamat ? (
                      <p className="mt-1 text-xs text-red-600">{customerErrors.alamat}</p>
                    ) : null}
                  </div>
                  <div>
                    <label className="block text-sm mb-1 font-medium">
                      No HP
                    </label>
                    <input
                      type="tel"
                      value={newCustomer.nohp}
                      onChange={(e) => handleCustomerPhoneChange(e.target.value)}
                      className={`w-full rounded-lg px-3 py-2 shadow-sm focus:outline-none focus:ring-2 ${
                        customerErrors.nohp
                          ? "border border-red-500 focus:ring-red-500/60 focus:border-red-500"
                          : "border border-gray-300 focus:ring-blue-200 focus:border-blue-500"
                      }`}
                      inputMode="numeric"
                      maxLength={12}
                      placeholder="Masukkan 10-12 digit"
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

                <div className="flex justify-end gap-2 mt-5">
                  <button
                    type="button"
                    onClick={() => setIsCustomerModalOpen(false)}
                    className="border px-4 py-2 rounded-lg hover:bg-gray-100 text-sm shadow-sm"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleAddCustomer}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm shadow-sm transition"
                  >
                    Simpan
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </FeatureGuard>
  );
}
