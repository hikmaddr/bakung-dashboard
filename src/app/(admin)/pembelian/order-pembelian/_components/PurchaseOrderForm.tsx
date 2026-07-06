
"use client";

import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactDOM from "react-dom";
import { ChevronDown, Loader2, PlusCircle, Trash2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { fmtIDR } from "@/lib/format";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useProductUnits } from "@/hooks/useProductUnits";

type PurchaseOrderStatus = 
  | "Draft"
  | "PendingApproval"
  | "Ordered"
  | "WaitingSupplier"
  | "SupplierApproved"
  | "DPPaid"
  | "Production"
  | "QCProcess"
  | "ReadyShipment"
  | "Shipped"
  | "Received"
  | "Delivered"
  | "Completed"
  | "Canceled";

type SupplierOption = {
  id: number;
  name: string;
  pic?: string | null;
};

type TaxMode =
  | "none"
  | "ppn_11_inclusive"
  | "ppn_11_exclusive"
  | "ppn_12_inclusive"
  | "ppn_12_exclusive";

type ProductOption = {
  id: number;
  name: string;
  sku?: string | null;
  buyPrice: number;
  unit?: string | null;
  description?: string | null;
  qty: number;
  imageUrl?: string | null;
};

export type PurchaseOrderFormItem = {
  id: string;
  productId?: number | null;
  product: string;
  description: string;
  quantity: number;
  unit: string;
  price: number;
  discount: number;
  discountType: "amount" | "percent";
  imageUrl?: string | null;
};

export type PurchaseOrderFormInitialValues = {
  orderNumber?: string | null;
  date?: string | null;
  status?: PurchaseOrderStatus;
  supplierId?: number | null;
  supplierName?: string | null;
  notes?: string | null;
  attachments?: any[];
  extraDiscount?: number | null;
  taxMode?: string | null;
  items?: (PurchaseOrderFormItem & { discountType?: "amount" | "percent" })[];
};

export type PurchaseOrderSavePayload = {
  orderNumber?: string;
  date: string;
  status: PurchaseOrderStatus;
  supplierId?: number | null;
  supplierName: string;
  notes?: string | null;
  attachments?: any[];
  extraDiscount: number;
  taxMode: string;
  items: {
    productId?: number | null;
    product: string;
    description: string;
    quantity: number;
    unit: string;
    price: number;
    discount: number;
    imageUrl?: string | null;
  }[];
};

type PurchaseOrderFormProps = {
  mode: "create" | "edit";
  initialValues?: PurchaseOrderFormInitialValues;
  onSubmit: (payload: PurchaseOrderSavePayload) => Promise<void>;
  submitLabel?: string;
  disabled?: boolean;
  onCancel?: () => void;
  cancelLabel?: string;
};

const STATUS_OPTIONS: { value: PurchaseOrderStatus; label: string }[] = [
  { value: "Draft", label: "Draft" },
  { value: "PendingApproval", label: "Menunggu Persetujuan" },
  { value: "Ordered", label: "Dipesan" },
  { value: "WaitingSupplier", label: "Menunggu Supplier" },
  { value: "SupplierApproved", label: "Disetujui Supplier" },
  { value: "DPPaid", label: "DP Dibayar" },
  { value: "Production", label: "Produksi" },
  { value: "QCProcess", label: "Proses QC" },
  { value: "ReadyShipment", label: "Siap Dikirim" },
  { value: "Shipped", label: "Dalam Pengiriman" },
  { value: "Received", label: "Diterima" },
  { value: "Delivered", label: "Sampai Tujuan" },
  { value: "Completed", label: "Selesai" },
  { value: "Canceled", label: "Dibatalkan" },
];

const TAX_OPTIONS: { value: TaxMode; label: string }[] = [
  { value: "none", label: "Tanpa Pajak" },
  { value: "ppn_11_inclusive", label: "PPN 11% (Termasuk)" },
  { value: "ppn_11_exclusive", label: "PPN 11% (Di luar)" },
  { value: "ppn_12_inclusive", label: "PPN 12% (Termasuk)" },
  { value: "ppn_12_exclusive", label: "PPN 12% (Di luar)" },
];

const createTempId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const createEmptyItem = (unit: string = "pcs"): PurchaseOrderFormItem => ({
  id: createTempId(),
  productId: null,
  product: "",
  description: "",
  quantity: 1,
  unit,
  price: 0,
  discount: 0,
  discountType: "amount",
  imageUrl: null,
});

const ensureItemsWithDefaults = (
  items: (PurchaseOrderFormItem & { discountType?: "amount" | "percent" })[] | undefined,
  unit: string = "pcs"
): PurchaseOrderFormItem[] => {
  if (!items || items.length === 0) return [createEmptyItem(unit)];
  return items.map((item) => ({
    ...item,
    discountType: item.discountType ?? "amount",
    unit: item.unit || unit,
  }));
};

const formatDateValue = (value: Date) => {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseDateValue = (value: string | null): Date | null => {
  if (!value) return null;
  const [yearStr, monthStr, dayStr] = value.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const getLineCalculation = (item: PurchaseOrderFormItem) => {
  const quantity = Math.max(0, Number(item.quantity) || 0);
  const price = Math.max(0, Number(item.price) || 0);
  const baseSubtotal = quantity * price;
  const rawDiscount = Math.max(0, Number(item.discount) || 0);
  const discountAmountRaw =
    item.discountType === "percent"
      ? Math.round((baseSubtotal * Math.min(rawDiscount, 100)) / 100)
      : rawDiscount;
  const discountAmount = Math.min(baseSubtotal, discountAmountRaw);
  return { quantity, price, baseSubtotal, discountAmount };
};

type ProductDropdownProps = {
  item: PurchaseOrderFormItem;
  products: ProductOption[];
  selectedProduct?: ProductOption;
  onSelectProduct: (product: ProductOption) => void;
  onManualInput: (value: string) => void;
  loading: boolean;
};

const ProductDropdown: React.FC<ProductDropdownProps> = ({
  item,
  products,
  selectedProduct,
  onSelectProduct,
  onManualInput,
  loading,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const portalRef = useRef<HTMLDivElement | null>(null);
  const [menuStyles, setMenuStyles] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (
        containerRef.current?.contains(event.target as Node) ||
        portalRef.current?.contains(event.target as Node)
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const minWidth = 320;
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
        zIndex: 90,
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
    if (open) setQuery(selectedProduct ? selectedProduct.name : item.product);
  }, [open, item.product, selectedProduct]);

  const filteredProducts = useMemo(() => {
    const term = query.trim().toLowerCase();
    const dataset = term
      ? products.filter((prod) => {
          const base = `${prod.name} ${prod.sku ?? ""} ${
            prod.description ?? ""
          }`.toLowerCase();
          return base.includes(term);
        })
      : products;
    return dataset.slice(0, 80);
  }, [products, query]);

  const commitManual = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    onManualInput(trimmed);
    setOpen(false);
  };

  const handleSelect = (prod: ProductOption) => {
    onSelectProduct(prod);
    setQuery("");
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-200"
      >
        <span className="truncate text-left">
          {selectedProduct ? (
            <>
              <span className="font-medium">{selectedProduct.name}</span>
              {selectedProduct.sku ? (
                <span className="text-gray-400">{` (${selectedProduct.sku})`}</span>
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
              className="max-w-[calc(100vw-3rem)] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl"
            >
              <div className="border-b border-gray-200 p-2">
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitManual();
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      setOpen(false);
                    }
                  }}
                  placeholder="Cari nama, SKU, atau deskripsi produk..."
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
                    const active = prod.id === selectedProduct?.id;
                    return (
                      <button
                        key={prod.id}
                        type="button"
                        onClick={() => handleSelect(prod)}
                        className={`block w-full border-b border-gray-100 px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                          active ? "bg-blue-50" : ""
                        }`}
                      >
                        <div className="font-medium text-gray-800">
                          {prod.name}
                        </div>
                        <div className="mt-0.5 text-[11px] text-gray-500">
                          {[prod.sku ? `SKU: ${prod.sku}` : null]
                            .concat([
                              `Harga: ${fmtIDR(prod.buyPrice)}`,
                              `Stok: ${prod.qty} ${prod.unit ?? "pcs"}`,
                            ])
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
              <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-3 py-2 text-xs">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded px-2 py-1 text-gray-600 hover:text-gray-800"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={commitManual}
                  className="rounded px-2 py-1 font-medium text-blue-600 hover:text-blue-700"
                >
                  Gunakan input manual
                </button>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
};

export default function PurchaseOrderForm({
  mode,
  initialValues,
  onSubmit,
  submitLabel = "Simpan Purchase Order",
  disabled = false,
  onCancel,
  cancelLabel = "Batal",
}: PurchaseOrderFormProps) {
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [orderNumber, setOrderNumber] = useState(
    initialValues?.orderNumber || ""
  );
  const [date, setDate] = useState<Date>(
    parseDateValue(initialValues?.date || null) || new Date()
  );
  const [status, setStatus] = useState<PurchaseOrderStatus>(
    initialValues?.status || "Draft"
  );
  const [supplierId, setSupplierId] = useState<number | null>(
    initialValues?.supplierId || null
  );
  const [supplierName, setSupplierName] = useState(
    initialValues?.supplierName || ""
  );
  const [notes, setNotes] = useState(initialValues?.notes || "");
  const [attachments, setAttachments] = useState<any[]>(
    initialValues?.attachments || []
  );
  const [extraDiscount, setExtraDiscount] = useState(
    initialValues?.extraDiscount || 0
  );
  const [taxMode, setTaxMode] = useState<TaxMode>(
    (initialValues?.taxMode as TaxMode) || "none"
  );
  const [items, setItems] = useState<PurchaseOrderFormItem[]>(
    ensureItemsWithDefaults(initialValues?.items)
  );

  // Master data
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);
  const { units } = useProductUnits();

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch("/api/products?all=true");
        if (res.ok) {
          const data = await res.json();
          setProducts(data);
        }
      } catch (err) {
        console.error("Failed to fetch products:", err);
      } finally {
        setLoadingProducts(false);
      }
    };
    const fetchSuppliers = async () => {
      try {
        const res = await fetch("/api/suppliers");
        const json = await res.json();
        if (json.success) {
          setSuppliers(json.data);
        }
      } catch (err) {
        console.error("Failed to fetch suppliers:", err);
      } finally {
        setLoadingSuppliers(false);
      }
    };
    fetchProducts();
    fetchSuppliers();
  }, []);

  // Totals calculation
  const calculations = useMemo(() => {
    const lineItems = items.map((it) => getLineCalculation(it));
    const subtotal = lineItems.reduce((acc, it) => acc + it.baseSubtotal, 0);
    const lineDiscount = lineItems.reduce(
      (acc, it) => acc + it.discountAmount,
      0
    );
    const baseAfterLine = Math.max(0, subtotal - lineDiscount);
    const extraDiscountVal = Math.min(baseAfterLine, extraDiscount);
    const baseAfterExtra = Math.max(0, baseAfterLine - extraDiscountVal);

    let taxRate = 0;
    let taxInclusive = false;
    if (taxMode === "ppn_11_inclusive") {
      taxRate = 11;
      taxInclusive = true;
    } else if (taxMode === "ppn_11_exclusive") {
      taxRate = 11;
      taxInclusive = false;
    } else if (taxMode === "ppn_12_inclusive") {
      taxRate = 12;
      taxInclusive = true;
    } else if (taxMode === "ppn_12_exclusive") {
      taxRate = 12;
      taxInclusive = false;
    }

    const taxAmount =
      taxRate === 0
        ? 0
        : taxInclusive
        ? Math.round((baseAfterExtra * taxRate) / (100 + taxRate))
        : Math.round((baseAfterExtra * taxRate) / 100);

    const totalAmount = taxInclusive
      ? baseAfterExtra
      : baseAfterExtra + taxAmount;

    return {
      subtotal,
      lineDiscount,
      extraDiscount: extraDiscountVal,
      taxAmount,
      totalAmount,
    };
  }, [items, extraDiscount, taxMode]);

  const handleAddItem = () => {
    setItems((prev) => [...prev, createEmptyItem(units[0]?.name || "pcs")]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) {
      setItems([createEmptyItem(units[0]?.name || "pcs")]);
      return;
    }
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleUpdateItem = (id: string, updates: Partial<PurchaseOrderFormItem>) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...updates } : it))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!supplierName.trim()) {
      toast.error("Nama supplier harus diisi");
      return;
    }

    const validItems = items.filter((it) => it.product.trim().length > 0);
    if (validItems.length === 0) {
      toast.error("Minimal harus ada satu produk");
      return;
    }

    setSubmitting(true);
    try {
      const payload: PurchaseOrderSavePayload = {
        orderNumber: orderNumber.trim() || undefined,
        date: formatDateValue(date),
        status,
        supplierId,
        supplierName: supplierName.trim(),
        notes: notes.trim() || null,
        attachments,
        extraDiscount,
        taxMode,
        items: validItems.map((it) => ({
          productId: it.productId,
          product: it.product.trim(),
          description: it.description.trim(),
          quantity: it.quantity,
          unit: it.unit,
          price: it.price,
          discount:
            it.discountType === "percent"
              ? Math.round(
                  (it.quantity * it.price * Math.min(it.discount, 100)) / 100
                )
              : it.discount,
          imageUrl: it.imageUrl,
        })),
      };

      await onSubmit(payload);
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan Purchase Order");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="mb-5 text-lg font-semibold text-gray-800">
              Informasi Umum
            </h3>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Pilih Supplier <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={supplierId || ""}
                    onChange={(e) => {
                      const id = e.target.value ? Number(e.target.value) : null;
                      setSupplierId(id);
                      if (id) {
                        const s = suppliers.find(x => x.id === id);
                        if (s) setSupplierName(s.name);
                      }
                    }}
                    className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm transition focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                    required
                  >
                    <option value="">-- Pilih Supplier --</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                    <option value="manual">-- Input Manual --</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" />
                </div>
                {(supplierId === null || isNaN(supplierId)) && (
                  <input
                    type="text"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder="Masukkan nama supplier secara manual..."
                    className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Nomor Order (Opsional)
                </label>
                <input
                  type="text"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  placeholder="Otomatis jika kosong..."
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm transition focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Tanggal Order
                </label>
                <div className="relative">
                  <DatePicker
                    selected={date}
                    onChange={(date: Date | null) => { if (date) setDate(date); }}
                    dateFormat="dd/MM/yyyy"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm transition focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Status
                </label>
                <div className="relative">
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as PurchaseOrderStatus)}
                    className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm transition focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" />
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Catatan</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Tambahkan catatan untuk supplier atau internal..."
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm transition focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
              />
            </div>
            
            {/* Attachments Section */}
            <div className="mt-6 border-t border-gray-100 pt-6">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold text-gray-700">Lampiran Dokumen</label>
                <button
                  type="button"
                  onClick={() => setAttachments([...attachments, { name: "", url: "" }])}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  + Tambah Lampiran
                </button>
              </div>
              <div className="space-y-3">
                {attachments.map((att, idx) => (
                  <div key={idx} className="flex gap-3">
                    <input
                      type="text"
                      placeholder="Nama File (e.g. Quotation Supplier)"
                      value={att.name}
                      onChange={(e) => {
                        const newAtts = [...attachments];
                        newAtts[idx].name = e.target.value;
                        setAttachments(newAtts);
                      }}
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      placeholder="URL Dokumen"
                      value={att.url}
                      onChange={(e) => {
                        const newAtts = [...attachments];
                        newAtts[idx].url = e.target.value;
                        setAttachments(newAtts);
                      }}
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))}
                      className="text-red-400 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {attachments.length === 0 && (
                  <p className="text-xs text-gray-400 italic">Belum ada lampiran.</p>
                )}
              </div>
            </div>
          </div>


          {/* Items */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">Item Produk</h3>
              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                <PlusCircle className="h-4 w-4" />
                Tambah Baris
              </button>
            </div>

            <div className="space-y-4">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className="group relative rounded-xl border border-gray-100 bg-gray-50/50 p-4 transition-colors hover:bg-gray-50"
                >
                  <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
                    <div className="lg:col-span-5">
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                        Produk
                      </label>
                      <ProductDropdown
                        item={item}
                        products={products}
                        selectedProduct={products.find(
                          (p) => p.id === item.productId
                        )}
                        loading={loadingProducts}
                        onSelectProduct={(prod) => {
                          handleUpdateItem(item.id, {
                            productId: prod.id,
                            product: prod.name,
                            description: prod.description || "",
                            price: prod.buyPrice,
                            unit: prod.unit || "pcs",
                            imageUrl: prod.imageUrl,
                          });
                        }}
                        onManualInput={(val) => {
                          handleUpdateItem(item.id, {
                            product: val,
                            productId: null,
                          });
                        }}
                      />
                    </div>
                    <div className="lg:col-span-2">
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                        Qty
                      </label>
                      <div className="flex items-center">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) =>
                            handleUpdateItem(item.id, {
                              quantity: Number(e.target.value) || 0,
                            })
                          }
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        />
                        <span className="ml-2 text-xs text-gray-500">
                          {item.unit}
                        </span>
                      </div>
                    </div>
                    <div className="lg:col-span-2">
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                        Harga Satuan
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={item.price}
                        onChange={(e) =>
                          handleUpdateItem(item.id, {
                            price: Number(e.target.value) || 0,
                          })
                        }
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div className="lg:col-span-2">
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                        Diskon
                      </label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          value={item.discount}
                          onChange={(e) =>
                            handleUpdateItem(item.id, {
                              discount: Number(e.target.value) || 0,
                            })
                          }
                          className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        />
                        <select
                          value={item.discountType}
                          onChange={(e) =>
                            handleUpdateItem(item.id, {
                              discountType: e.target.value as "amount" | "percent",
                            })
                          }
                          className="rounded-lg border border-gray-300 bg-white px-1 py-2 text-xs focus:outline-none"
                        >
                          <option value="amount">Rp</option>
                          <option value="percent">%</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex items-end justify-end lg:col-span-1">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="Tambahkan deskripsi atau spesifikasi produk..."
                      value={item.description}
                      onChange={(e) =>
                        handleUpdateItem(item.id, { description: e.target.value })
                      }
                      className="w-full border-none bg-transparent p-0 text-xs text-gray-500 placeholder-gray-400 focus:ring-0"
                    />
                  </div>
                  <div className="mt-2 text-right text-xs font-medium text-gray-600">
                    Subtotal: {fmtIDR(getLineCalculation(item).baseSubtotal - getLineCalculation(item).discountAmount)}
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleAddItem}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-4 text-sm font-medium text-gray-500 transition-colors hover:border-blue-200 hover:bg-blue-50/30 hover:text-blue-600"
            >
              <PlusCircle className="h-5 w-5" />
              Tambah Baris Produk
            </button>
          </div>
        </div>

        {/* Sidebar Summary */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="mb-5 text-lg font-semibold text-gray-800">Ringkasan</h3>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Mode Pajak
                </label>
                <div className="relative">
                  <select
                    value={taxMode}
                    onChange={(e) => setTaxMode(e.target.value as TaxMode)}
                    className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm transition focus:border-blue-500 focus:outline-none"
                  >
                    {TAX_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Diskon Tambahan (Rp)
                </label>
                <input
                  type="number"
                  min="0"
                  value={extraDiscount}
                  onChange={(e) => setExtraDiscount(Number(e.target.value) || 0)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm transition focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="pt-4 space-y-3 border-t border-gray-100">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="font-medium">{fmtIDR(calculations.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total Diskon</span>
                  <span className="font-medium text-red-500">
                    -{fmtIDR(calculations.lineDiscount + calculations.extraDiscount)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Pajak</span>
                  <span className="font-medium">{fmtIDR(calculations.taxAmount)}</span>
                </div>
                <div className="flex justify-between pt-4 border-t border-gray-100">
                  <span className="text-base font-bold text-gray-800">Total Akhir</span>
                  <span className="text-xl font-bold text-blue-600">
                    {fmtIDR(calculations.totalAmount)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              type="submit"
              disabled={submitting || disabled}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                submitLabel
              )}
            </button>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={submitting || disabled}
                className="w-full rounded-xl border border-gray-300 bg-white py-3.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
              >
                {cancelLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
