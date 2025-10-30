
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

type SalesOrderStatus = "Draft" | "Confirmed" | "Sent" | "Approved" | "Declined";

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
  sellPrice: number;
  unit?: string | null;
  description?: string | null;
  qty: number;
  imageUrl?: string | null;
};

type CustomerOption = {
  id: number;
  pic: string;
  company: string;
  address: string;
  phone: string;
  email?: string | null;
};

type QuotationSummary = {
  id: number;
  quotationNumber: string;
  status: string;
  customerId: number;
  customerName: string;
  customerCompany: string;
  date: string;
  totalAmount: number;
};

type QuotationDetail = {
  id: number;
  quotationNumber: string;
  customerId: number;
  projectDesc?: string | null;
  items: {
    id: number;
    productId?: number | null;
    product: string;
    description: string;
    quantity: number;
    unit: string | null;
    price: number;
    imageUrl?: string | null;
  }[];
  customer?: {
    id: number;
    pic: string;
    company: string;
    phone: string;
    email?: string | null;
  } | null;
};

export type SalesOrderFormItem = {
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

export type SalesOrderFormInitialValues = {
  orderNumber?: string | null;
  date?: string | null;
  status?: SalesOrderStatus;
  customerId?: number | null;
  quotationId?: number | null;
  notes?: string | null;
  extraDiscount?: number | null;
  taxMode?: TaxMode | null;
  items?: (SalesOrderFormItem & { discountType?: "amount" | "percent" })[];
};

export type SalesOrderSavePayload = {
  orderNumber?: string;
  date: string;
  status: SalesOrderStatus;
  customerId: number;
  quotationId?: number | null;
  notes?: string | null;
  extraDiscount: number;
  taxMode: TaxMode;
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

type SalesOrderFormProps = {
  mode: "create" | "edit";
  initialValues?: SalesOrderFormInitialValues;
  onSubmit: (payload: SalesOrderSavePayload) => Promise<void>;
  submitLabel?: string;
  disabled?: boolean;
  onCancel?: () => void;
  cancelLabel?: string;
};

const STATUS_OPTIONS: SalesOrderStatus[] = [
  "Draft",
  "Confirmed",
  "Sent",
  "Approved",
  "Declined",
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

const createEmptyItem = (unit: string = "pcs"): SalesOrderFormItem => ({
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

const normalizePhoneNumber = (raw: string): string => {
  const digits = raw.replace(/\D+/g, "");
  if (!digits) return raw.trim();
  if (digits.startsWith("62")) return `+${digits}`;
  if (digits.startsWith("0")) return `+62${digits.slice(1)}`;
  if (raw.trim().startsWith("+")) return raw.trim();
  return `+62${digits}`;
};

const ensureItemsWithDefaults = (
  items: (SalesOrderFormItem & { discountType?: "amount" | "percent" })[] | undefined,
  unit: string = "pcs"
): SalesOrderFormItem[] => {
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

const getLineCalculation = (item: SalesOrderFormItem) => {
  const quantity = Math.max(0, Number(item.quantity) || 0);
  const price = Math.max(0, Number(item.price) || 0);
  const baseSubtotal = quantity * price;
  const rawDiscount = Math.max(0, Number(item.discount) || 0);
  const discountAmountRaw =
    item.discountType === "percent"
      ? Math.round(
          (baseSubtotal * Math.min(rawDiscount, 100)) / 100
        )
      : rawDiscount;
  const discountAmount = Math.min(baseSubtotal, discountAmountRaw);
  return { quantity, price, baseSubtotal, discountAmount };
};

type ProductDropdownProps = {
  item: SalesOrderFormItem;
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
                              `Harga: ${fmtIDR(prod.sellPrice)}`,
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

type CustomerDropdownProps = {
  value: number | null;
  customers: CustomerOption[];
  onChange: (customerId: number | null) => void;
  loading: boolean;
  placeholder?: string;
};

const CustomerDropdown: React.FC<CustomerDropdownProps> = ({
  value,
  customers,
  onChange,
  loading,
  placeholder = "Pilih customer...",
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const portalRef = useRef<HTMLDivElement | null>(null);
  const [menuStyles, setMenuStyles] = useState<React.CSSProperties>({});

  const selectedCustomer =
    value != null ? customers.find((cust) => cust.id === value) ?? null : null;

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
      const maxWidth = 440;
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
    if (open) setQuery("");
  }, [open]);

  const filteredCustomers = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return customers.slice(0, 80);
    return customers
      .filter((cust) => {
        return (
          cust.pic.toLowerCase().includes(term) ||
          cust.company.toLowerCase().includes(term) ||
          normalizePhoneNumber(cust.phone).toLowerCase().includes(term) ||
          (cust.email ?? "").toLowerCase().includes(term)
        );
      })
      .slice(0, 80);
  }, [customers, query]);

  const handleSelect = (cust: CustomerOption) => {
    onChange(cust.id);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-left text-sm text-gray-800 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-200"
      >
        <span className="truncate">
          {selectedCustomer ? (
            <>
              <span className="font-medium">{selectedCustomer.pic}</span>
              <span className="text-gray-500">{` - ${selectedCustomer.company}`}</span>
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
                  placeholder="Cari nama, perusahaan, email, atau nomor HP..."
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
                    const active = cust.id === selectedCustomer?.id;
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
                            {normalizePhoneNumber(cust.phone)}
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-gray-500">
                          {cust.company}
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
                {value != null ? (
                  <button
                    type="button"
                    onClick={() => {
                      onChange(null);
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

type QuotationDropdownProps = {
  value: number | null;
  quotations: QuotationSummary[];
  onSelect: (quotation: QuotationSummary | null) => void;
  loading: boolean;
};

const QuotationDropdown: React.FC<QuotationDropdownProps> = ({
  value,
  quotations,
  onSelect,
  loading,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const portalRef = useRef<HTMLDivElement | null>(null);
  const [menuStyles, setMenuStyles] = useState<React.CSSProperties>({});

  const selected =
    value != null ? quotations.find((q) => q.id === value) ?? null : null;

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
      const minWidth = 340;
      const maxWidth = 480;
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
    if (open) setQuery("");
  }, [open]);

  const filteredQuotations = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return quotations.slice(0, 80);
    return quotations
      .filter((q) => {
        return (
          q.quotationNumber.toLowerCase().includes(term) ||
          q.customerName.toLowerCase().includes(term) ||
          q.customerCompany.toLowerCase().includes(term)
        );
      })
      .slice(0, 80);
  }, [quotations, query]);

  const handleSelect = (quotation: QuotationSummary) => {
    onSelect(quotation);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex w-full items-center justify-between rounded-lg border border-dashed border-gray-300 bg-white px-3 py-2 text-left text-sm text-gray-800 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-200"
      >
        <span className="truncate">
          {selected ? (
            <>
              <span className="font-medium">
                {selected.quotationNumber} - {selected.customerName}
              </span>
              <span className="text-gray-500">{` (${selected.customerCompany})`}</span>
            </>
          ) : (
            <span className="text-gray-500">
              {loading
                ? "Memuat quotation..."
                : "Hubungkan dengan quotation (opsional)"}
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
                  placeholder="Cari nomor quotation atau nama customer..."
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div className="max-h-72 overflow-y-auto">
                {loading ? (
                  <div className="px-4 py-3 text-sm text-gray-500">
                    Memuat quotation...
                  </div>
                ) : filteredQuotations.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-gray-500">
                    Quotation tidak ditemukan.
                  </div>
                ) : (
                  filteredQuotations.map((quotation) => {
                    const active = quotation.id === selected?.id;
                    return (
                      <button
                        key={quotation.id}
                        type="button"
                        onClick={() => handleSelect(quotation)}
                        className={`block w-full px-4 py-3 text-left text-sm hover:bg-gray-50 ${
                          active ? "bg-blue-50" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-800">
                            {quotation.quotationNumber}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] ${
                              quotation.status === "Confirmed"
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {quotation.status}
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-gray-500">
                          {quotation.customerName} - {quotation.customerCompany}
                        </div>
                        <div className="mt-0.5 text-[11px] text-gray-400">
                          {quotation.date} - {fmtIDR(quotation.totalAmount ?? 0)}
                        </div>
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
                  onClick={() => {
                    onSelect(null);
                    setOpen(false);
                  }}
                  className="rounded px-2 py-1 font-medium text-blue-600 hover:text-blue-700"
                >
                  Lepaskan tautan
                </button>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
};

export const SalesOrderForm: React.FC<SalesOrderFormProps> = ({
  mode,
  initialValues,
  onSubmit,
  submitLabel = mode === "create" ? "Simpan" : "Perbarui",
  disabled = false,
  onCancel,
  cancelLabel = "Batal",
}) => {
  const { units: productUnits } = useProductUnits();
  const defaultUnit = useMemo(() => productUnits[0]?.symbol || "pcs", [productUnits]);
  const [orderNumber, setOrderNumber] = useState(
    initialValues?.orderNumber ?? ""
  );
  const [loadingOrderNumber, setLoadingOrderNumber] = useState(false);
  const [date, setDate] = useState(
    initialValues?.date ?? formatDateValue(new Date())
  );
  const selectedDate = useMemo(() => parseDateValue(date), [date]);
  const [status, setStatus] = useState<SalesOrderStatus>(
    initialValues?.status ?? "Draft"
  );
  const [customerId, setCustomerId] = useState<number | null>(
    initialValues?.customerId ?? null
  );
  const [quotationId, setQuotationId] = useState<number | null>(
    initialValues?.quotationId ?? null
  );
  const [extraDiscount, setExtraDiscount] = useState<number>(
    initialValues?.extraDiscount ?? 0
  );
  const [taxMode, setTaxMode] = useState<TaxMode>(
    initialValues?.taxMode ?? "none"
  );
  const [items, setItems] = useState<SalesOrderFormItem[]>(() =>
    ensureItemsWithDefaults(initialValues?.items, defaultUnit)
  );
  const [notes, setNotes] = useState<string>(initialValues?.notes ?? "");

  useEffect(() => {
    if (!initialValues) return;
    setOrderNumber(initialValues.orderNumber ?? "");
    setDate(initialValues.date ?? formatDateValue(new Date()));
    setStatus(initialValues.status ?? "Draft");
    setCustomerId(
      typeof initialValues.customerId === "number"
        ? initialValues.customerId
        : initialValues.customerId ?? null
    );
   setQuotationId(
     typeof initialValues.quotationId === "number"
       ? initialValues.quotationId
       : initialValues.quotationId ?? null
   );
   setExtraDiscount(initialValues.extraDiscount ?? 0);
   setTaxMode(initialValues.taxMode ?? "none");
   setItems(ensureItemsWithDefaults(initialValues.items, defaultUnit));
   setNotes(initialValues.notes ?? "");
  }, [initialValues, defaultUnit]);

  useEffect(() => {
    if (mode !== "create") return;
    if (initialValues?.orderNumber) return;
    if (orderNumber) return;

    let active = true;
    setLoadingOrderNumber(true);
    (async () => {
      try {
        const res = await fetch("/api/sales-orders/new-number", {
          cache: "no-store",
        });
        const json = await res.json();
        if (!active) return;
        if (res.ok && json?.success && json?.data?.orderNumber) {
          setOrderNumber(String(json.data.orderNumber));
        } else {
          toast.error(
            json?.message || "Gagal mengambil nomor sales order baru"
          );
        }
      } catch (error: unknown) {
        if (active) {
          const message =
            error instanceof Error
              ? error.message
              : "Gagal mengambil nomor sales order baru";
          toast.error(message);
        }
      } finally {
        if (active) setLoadingOrderNumber(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [mode, initialValues?.orderNumber, orderNumber]);

  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [quotations, setQuotations] = useState<QuotationSummary[]>([]);
  const [quotationsLoading, setQuotationsLoading] = useState(true);
  const [loadingQuotationDetail, setLoadingQuotationDetail] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/customers?format=std", {
          cache: "no-store",
        });
        const json = await res.json();
        const rows: unknown[] = Array.isArray(json)
          ? json
          : Array.isArray(json?.data)
          ? json.data
          : [];
        if (!alive) return;
        setCustomers(
          rows.map((row) => {
            const data = row as Record<string, unknown>;
            return {
              id: Number(data.id),
              pic: String(data.pic || ""),
              company: String(data.company || ""),
              address: String(data.address || ""),
              phone: normalizePhoneNumber(String(data.phone ?? "")),
              email: (data.email as string | null | undefined) ?? null,
            } satisfies CustomerOption;
          })
        );
      } catch {
        if (alive) setCustomers([]);
      } finally {
        if (alive) setCustomersLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/products", { cache: "no-store" });
        const json = await res.json();
        const rows: unknown[] = Array.isArray(json)
          ? json
          : Array.isArray(json?.data)
          ? json.data
          : [];
        if (!alive) return;
        setProducts(
          rows.map((row) => {
            const data = row as Record<string, unknown>;
            return {
              id: Number(data.id),
              name: String(data.name || ""),
              sku: (data.sku as string | null | undefined) ?? null,
              sellPrice: Number(data.sellPrice || 0),
              unit: (data.unit as string | null | undefined) ?? null,
              description: (data.description as string | null | undefined) ?? null,
              qty: Number(data.qty || 0),
              imageUrl: (data.imageUrl as string | null | undefined) ?? null,
            } satisfies ProductOption;
          })
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
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/quotations?format=std", {
          cache: "no-store",
        });
        const json = await res.json();
        const rows: unknown[] = Array.isArray(json)
          ? json
          : Array.isArray(json?.data)
          ? json.data
          : [];
        if (!alive) return;
        setQuotations(
          rows.map((row) => {
            const data = row as Record<string, unknown>;
            const customer = data.customer as Record<string, unknown> | undefined;
            const totalAmountRaw =
              (data.totalAmount as unknown) ?? (data.total as unknown) ?? 0;
            return {
              id: Number(data.id),
              quotationNumber: String(data.quotationNumber || ""),
              status: String(data.status || ""),
              customerId: Number(data.customerId || customer?.id || 0),
              customerName: customer?.pic
                ? String(customer.pic)
                : customer?.name
                ? String(customer.name)
                : String(customer?.name || ""),
              customerCompany:
                customer?.company != null
                  ? String(customer.company)
                  : data.customerCompany
                  ? String(data.customerCompany)
                  : "-",
              date: data.date
                ? new Date(String(data.date)).toLocaleDateString("id-ID")
                : "",
              totalAmount: Number(totalAmountRaw),
            } satisfies QuotationSummary;
          })
        );
      } catch {
        if (alive) setQuotations([]);
      } finally {
        if (alive) setQuotationsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const productMap = useMemo(() => {
    const map = new Map<number, ProductOption>();
    for (const prod of products) map.set(prod.id, prod);
    return map;
  }, [products]);

  const taxEnabled = taxMode !== "none";

  const summary = useMemo(() => {
    let subtotal = 0;
    let lineDiscount = 0;
    items.forEach((item) => {
      const { baseSubtotal, discountAmount } = getLineCalculation(item);
      subtotal += baseSubtotal;
      lineDiscount += discountAmount;
    });
    const baseAfterLine = Math.max(0, subtotal - lineDiscount);
    const extra = Math.min(
      baseAfterLine,
      Math.max(0, Number(extraDiscount) || 0)
    );
    const baseAfterExtra = Math.max(0, baseAfterLine - extra);
    let taxAmount = 0;
    if (taxEnabled) {
      const detail = {
        ppn_11_inclusive: { rate: 11, inclusive: true },
        ppn_11_exclusive: { rate: 11, inclusive: false },
        ppn_12_inclusive: { rate: 12, inclusive: true },
        ppn_12_exclusive: { rate: 12, inclusive: false },
      } as const;
      const config = detail[taxMode as keyof typeof detail];
      if (config) {
        taxAmount = config.inclusive
          ? Math.round((baseAfterExtra * config.rate) / (100 + config.rate))
          : Math.round((baseAfterExtra * config.rate) / 100);
      }
    }
    const total = taxEnabled
      ? taxMode.includes("inclusive")
        ? baseAfterExtra
        : baseAfterExtra + taxAmount
      : baseAfterExtra;
    return {
      subtotal,
      lineDiscount,
      extraDiscount: extra,
      taxAmount,
      total,
    };
  }, [items, extraDiscount, taxEnabled, taxMode]);

  const handleSelectProduct = (rowId: string, product: ProductOption) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === rowId
          ? {
              ...item,
              productId: product.id,
              product: product.name,
              unit: product.unit ?? item.unit ?? defaultUnit,
              price: product.sellPrice ?? item.price,
              description:
                item.description?.trim().length
                  ? item.description
                  : product.description ?? "",
            }
          : item
      )
    );
  };

  const handleManualProduct = (rowId: string, value: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === rowId
          ? {
              ...item,
              product: value.trim(),
              productId: null,
            }
          : item
      )
    );
  };

  const handleItemFieldChange = <K extends keyof SalesOrderFormItem>(
    rowId: string,
    field: K,
    value: SalesOrderFormItem[K]
  ) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === rowId ? { ...item, [field]: value } : item
      )
    );
  };

  const addItem = () => {
    setItems((prev) => [...prev, createEmptyItem(defaultUnit)]);
  };

  const removeItem = (rowId: string) => {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((it) => it.id !== rowId)));
  };

  const handleSelectQuotation = async (quotation: QuotationSummary | null) => {
    if (!quotation) {
      setQuotationId(null);
      return;
    }
    setLoadingQuotationDetail(true);
    try {
      const res = await fetch(`/api/quotations/${quotation.id}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || "Gagal mengambil data quotation");
      }
      const data = json.data as QuotationDetail;
      setQuotationId(data.id);
      if (data.customer?.id) {
        setCustomerId(data.customer.id);
      } else if (quotation.customerId) {
        setCustomerId(quotation.customerId);
      }
      setItems(
        data.items && data.items.length
          ? data.items.map((item) => ({
              id: createTempId(),
              productId: item.productId ?? null,
              product: item.product,
              description: item.description ?? "",
              quantity: Number(item.quantity) || 1,
              unit: item.unit ?? defaultUnit,
              price: Number(item.price) || 0,
              discount: 0,
              discountType: "amount",
              imageUrl: item.imageUrl ?? null,
            }))
        : [createEmptyItem(defaultUnit)]
      );
      if (!notes && data.projectDesc) {
        setNotes(data.projectDesc);
      }
      toast.success("Quotation berhasil dimuat ke sales order");
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Gagal memuat data dari quotation terpilih";
      toast.error(message);
    } finally {
      setLoadingQuotationDetail(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (disabled) return;

    const trimmedItems = items
      .map((item) => {
        const candidateName =
          item.product.trim() ||
          (item.productId != null
            ? productMap.get(item.productId)?.name ?? String(item.productId)
            : "");
        const rawDiscount = Math.max(0, Number(item.discount) || 0);
        const sanitizedDiscount =
          item.discountType === "percent"
            ? Math.min(rawDiscount, 100)
            : rawDiscount;
        return {
          ...item,
          product: candidateName,
          description: item.description.trim(),
          discount: sanitizedDiscount,
        };
      })
      .filter((item) => item.product.length > 0 || item.productId != null);

    if (!customerId) {
      toast.error("Customer wajib dipilih");
      return;
    }
    if (trimmedItems.length === 0) {
      toast.error("Minimal satu produk harus diisi");
      return;
    }
    if (trimmedItems.some((it) => (Number(it.quantity) || 0) <= 0)) {
      toast.error("Qty setiap produk harus lebih dari 0");
      return;
    }

    try {
      const payload: SalesOrderSavePayload = {
        orderNumber: orderNumber.trim() || undefined,
        date,
        status,
        customerId,
        quotationId: quotationId ?? undefined,
        notes: notes.trim() ? notes.trim() : null,
        extraDiscount: Math.max(0, Number(extraDiscount) || 0),
        taxMode,
        items: trimmedItems.map((item) => {
          const { quantity, price, discountAmount } = getLineCalculation(item);
          return {
            productId: item.productId ?? null,
            product: item.product,
            description: item.description,
            quantity,
            unit: item.unit || defaultUnit,
            price,
            discount: discountAmount,
            imageUrl: item.imageUrl ?? null,
          };
        }),
      };

      await onSubmit(payload);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Gagal menyimpan sales order";
      toast.error(message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-sm font-medium">
            Nomor Sales Order
          </label>
          <div className="w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-700">
            {orderNumber
              ? orderNumber
              : loadingOrderNumber
              ? "Memuat nomor..."
              : "Nomor akan dibuat otomatis saat disimpan"}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Tanggal</label>
          <DatePicker
            selected={selectedDate}
            onChange={(value) => {
              if (value) {
                setDate(formatDateValue(value));
              }
            }}
            dateFormat="dd/MM/yyyy"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            wrapperClassName="w-full"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Customer / PIC</label>
          <CustomerDropdown
            value={customerId}
            customers={customers}
            onChange={setCustomerId}
            loading={customersLoading}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as SalesOrderStatus)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-4">
        <label className="mb-2 block text-sm font-medium">
          Hubungkan dengan Quotation (opsional)
        </label>
        <QuotationDropdown
          value={quotationId}
          quotations={quotations}
          onSelect={handleSelectQuotation}
          loading={quotationsLoading}
        />
        {loadingQuotationDetail ? (
          <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Mengambil detail quotation...
          </div>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-700">Item Produk / Jasa</h3>
          <button
            type="button"
            onClick={addItem}
            className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            <PlusCircle className="h-4 w-4" />
            Tambah Item
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead className="bg-gray-100 text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left">Produk</th>
                <th className="px-4 py-3 text-left">Deskripsi</th>
                <th className="px-4 py-3 text-right w-24">Qty</th>
                <th className="px-4 py-3 text-right w-28">Satuan</th>
                <th className="px-4 py-3 text-right w-32">Harga</th>
                <th className="px-4 py-3 text-right w-32">Diskon</th>
                <th className="px-4 py-3 text-right w-32">Subtotal</th>
                <th className="px-4 py-3 text-center w-12">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const selectedProduct =
                  item.productId != null
                    ? productMap.get(item.productId)
                    : undefined;
                const { baseSubtotal, discountAmount } =
                  getLineCalculation(item);
                const lineSubtotal = Math.max(
                  0,
                  baseSubtotal - discountAmount
                );
                return (
                  <tr key={item.id} className="border-t border-gray-100">
                    <td className="px-4 py-3 align-top">
                      <div className="space-y-2">
                        <ProductDropdown
                          item={item}
                          products={products}
                          selectedProduct={selectedProduct}
                          onSelectProduct={(prod) => handleSelectProduct(item.id, prod)}
                          onManualInput={(value) => handleManualProduct(item.id, value)}
                          loading={productsLoading}
                        />
                        {item.productId && (
                          <div className="text-xs text-gray-400">
                            Stok saat ini: {productMap.get(item.productId)?.qty ?? 0}{" "}
                            {productMap.get(item.productId)?.unit ?? defaultUnit}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <textarea
                        value={item.description}
                        onChange={(e) =>
                          handleItemFieldChange(item.id, "description", e.target.value)
                        }
                        rows={3}
                        placeholder="Catatan / deskripsi tambahan"
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                      />
                    </td>
                    <td className="px-4 py-3 align-top text-right">
                      <input
                        type="number"
                        min={0}
                        value={item.quantity}
                        onChange={(e) =>
                          handleItemFieldChange(item.id, "quantity", Number(e.target.value))
                        }
                        className="w-24 rounded-lg border border-gray-200 px-3 py-2 text-right focus:outline-none focus:ring-2 focus:ring-blue-200"
                      />
                    </td>
                    <td className="px-4 py-3 align-top text-right">
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
                              handleItemFieldChange(item.id, "unit", e.target.value || defaultUnit)
                            }
                            className="w-28 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
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
                    <td className="px-4 py-3 align-top text-right">
                      <input
                        type="number"
                        min={0}
                        value={item.price}
                        onChange={(e) =>
                          handleItemFieldChange(item.id, "price", Number(e.target.value))
                        }
                        className="w-32 rounded-lg border border-gray-200 px-3 py-2 text-right focus:outline-none focus:ring-2 focus:ring-blue-200"
                      />
                    </td>
                    <td className="px-4 py-3 align-top text-right">
                      <div className="flex items-center justify-end gap-2">
                        <input
                          type="number"
                          min={0}
                          max={
                            item.discountType === "percent" ? 100 : undefined
                          }
                          value={item.discount}
                          onChange={(e) => {
                            const raw = Number(e.target.value);
                            const next =
                              item.discountType === "percent"
                                ? Math.min(Math.max(0, raw || 0), 100)
                                : Math.max(0, raw || 0);
                            handleItemFieldChange(item.id, "discount", next);
                          }}
                          className="w-28 rounded-lg border border-gray-200 px-3 py-2 text-right focus:outline-none focus:ring-2 focus:ring-blue-200"
                        />
                        <select
                          value={item.discountType}
                          onChange={(e) => {
                            const nextType =
                              e.target.value as "amount" | "percent";
                            handleItemFieldChange(
                              item.id,
                              "discountType",
                              nextType
                            );
                            handleItemFieldChange(item.id, "discount", 0);
                          }}
                          className="rounded-lg border border-gray-200 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                        >
                          <option value="amount">Rp</option>
                          <option value="percent">%</option>
                        </select>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-right">
                      <div className="font-medium text-gray-700">{fmtIDR(lineSubtotal)}</div>
                    </td>
                    <td className="px-2 py-3 align-center text-center">
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="inline-flex items-center justify-center rounded-full bg-red-50 p-2 text-red-600 hover:bg-red-100"
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
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">Pengaturan Pajak</label>
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={taxEnabled}
                onChange={(e) => setTaxMode(e.target.checked ? "ppn_11_exclusive" : "none")}
              />
              Aktifkan pajak
            </label>
          </div>
          <select
            value={taxMode}
            onChange={(e) => setTaxMode(e.target.value as TaxMode)}
            disabled={!taxEnabled}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-gray-100"
          >
            {TAX_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Diskon tambahan (Rp)
            </label>
            <input
              type="number"
              min={0}
              value={extraDiscount}
              onChange={(e) =>
                setExtraDiscount(Math.max(0, Number(e.target.value) || 0))
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Instruksi Khusus
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Tambahkan instruksi khusus untuk pesanan ini (opsional)"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Ringkasan</h3>
          <dl className="space-y-2 text-sm text-gray-600">
            <div className="flex items-center justify-between">
              <dt>Subtotal</dt>
              <dd>{fmtIDR(summary.subtotal)}</dd>
            </div>
            {summary.lineDiscount > 0 ? (
              <div className="flex items-center justify-between">
                <dt>Diskon item</dt>
                <dd>{fmtIDR(summary.lineDiscount)}</dd>
              </div>
            ) : null}
            {summary.extraDiscount > 0 ? (
              <div className="flex items-center justify-between">
                <dt>Diskon tambahan</dt>
                <dd>{fmtIDR(summary.extraDiscount)}</dd>
              </div>
            ) : null}
            {taxEnabled ? (
              <div className="flex items-center justify-between">
                <dt>Pajak</dt>
                <dd>{fmtIDR(summary.taxAmount)}</dd>
              </div>
            ) : null}
          </dl>
          <div className="mt-4 flex items-center justify-between border-t border-dashed border-gray-200 pt-4 text-base font-semibold text-gray-800">
            <span>Total</span>
            <span>{fmtIDR(summary.total)}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={disabled}
            className="inline-flex items-center rounded-full border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {cancelLabel}
          </button>
        ) : null}
        <button
          type="submit"
          className="inline-flex items-center rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          disabled={disabled}
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
};

export default SalesOrderForm;





