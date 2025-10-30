"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import DatePicker from "@/components/DatePicker";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import FeatureGuard from "@/components/FeatureGuard";
import { ChevronDown, PlusCircle, Trash2 } from "lucide-react";
import { useProductUnits } from "@/hooks/useProductUnits";

import CustomerPicker from "@/components/CustomerPicker";
import { fmtIDR } from "@/lib/format";

type ProductLine = {
  id: number;
  productId: number;
  name: string;
  description: string;
  qty: number;
  unit?: string;
  price: number;
  discount: number; // value
  discountType: "percent" | "amount"; // how to interpret discount
  tax: number; // reserved (unused per-line)
};

type ProductOption = {
  id: number;
  name: string;
  sku?: string | null;
  sellPrice: number;
  unit?: string | null;
  description?: string | null;
  qty: number;
};

// Lightweight quotation summary for linking
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

const toProductLabel = (product: ProductOption) =>
  product.sku ? `${product.name} (${product.sku})` : product.name;

type TaxMode =
  | "none"
  | "non_pkp"
  | "ppn_11_inclusive"
  | "ppn_11_exclusive"
  | "ppn_12_inclusive"
  | "ppn_12_exclusive";

export default function AddSalesInvoicePage() {
  const router = useRouter();
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(""); // default disamakan setelah mount
  const [client, setClient] = useState("");
  const [clientReadOnly, setClientReadOnly] = useState(false);
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [clientCompany, setClientCompany] = useState<string>("");
  // Hapus dropdown jenis usaha; gunakan perusahaan client dari database
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productsLoading, setProductsLoading] = useState<boolean>(true);
  const [productLines, setProductLines] = useState<ProductLine[]>([]);
  const [specialInstructions, setSpecialInstructions] = useState("");

  // Tambahan komponen perhitungan
  const [extraDiscountType, setExtraDiscountType] = useState<"amount" | "percent">("amount");
  const [extraDiscountValue, setExtraDiscountValue] = useState<number>(0);
  const [shippingCost, setShippingCost] = useState<number>(0);
  const [taxMode, setTaxMode] = useState<TaxMode>("none");
  const [downPayment, setDownPayment] = useState<number>(0);
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
  const fmt = (n: number) => fmtIDR(n);
  const canPreview = productLines.length > 0;
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [suggestedNumber, setSuggestedNumber] = useState<string>("");
  // Quotation linking state
  const [quotations, setQuotations] = useState<QuotationSummary[]>([]);
  const [quotationsLoading, setQuotationsLoading] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState<QuotationSummary | null>(null);
  // Simpan quotationId sementara saat prefill dari Sales Order,
  // agar bisa menautkan setelah daftar quotations selesai dimuat
  const [pendingQuotationId, setPendingQuotationId] = useState<number | null>(null);
  // Simpan quotationNumber sebagai fallback jika ID tidak tersedia
  const [pendingQuotationNumber, setPendingQuotationNumber] = useState<string | null>(null);
  const customerDisplay = useMemo(() => {
    const name = (client || '').trim();
    const comp = (clientCompany || '').trim();
    if (name && comp) return `${name} - ${comp}`;
    return name || comp || '-';
  }, [client, clientCompany]);
  const productMap = useMemo(() => {
    const map = new Map<number, ProductOption>();
    for (const p of products) map.set(p.id, p);
    return map;
  }, [products]);
  const { units: productUnits } = useProductUnits();
  const defaultUnit = useMemo(() => productUnits[0]?.symbol || "pcs", [productUnits]);

  const findProductByInput = useCallback(
    (value: string) => {
      const trimmed = value.trim().toLowerCase();
      if (!trimmed) return null;
      return (
        products.find((prod) => {
          const label = toProductLabel(prod).toLowerCase();
          const name = prod.name.toLowerCase();
          const sku = prod.sku?.toLowerCase();
          return (
            label === trimmed ||
            name === trimmed ||
            (sku ? sku === trimmed : false)
          );
        }) || null
      );
    },
    [products]
  );

  const applyProductOptionToLine = useCallback((lineId: number, product: ProductOption) => {
    setProductLines((prev) =>
      prev.map((line) => {
        if (line.id !== lineId) return line;
        const next: ProductLine = {
          ...line,
          productId: product.id,
          name: product.name,
          unit: product.unit || line.unit || defaultUnit,
          price: product.sellPrice ?? line.price,
        };
        if (!line.description?.trim() && product.description) {
          next.description = product.description;
        }
        return next;
      })
    );
  }, [defaultUnit]);

  const handleManualProductEntry = useCallback((lineId: number, rawValue: string) => {
    setProductLines((prev) =>
      prev.map((line) => {
        if (line.id !== lineId) return line;
        const value = rawValue.trim();
        return {
          ...line,
          productId: 0,
          name: value,
        };
      })
    );
  }, []);

  // Setelah daftar quotations dimuat, tautkan quotation dari SO jika ada
  useEffect(() => {
    if (!pendingQuotationId) return;
    if (!quotations.length) return;
    const found = quotations.find(q => q.id === pendingQuotationId);
    if (found) setSelectedQuotation(found);
  }, [pendingQuotationId, quotations]);

  // Fallback: tautkan berdasarkan quotationNumber jika ID tidak tersedia
  useEffect(() => {
    if (!pendingQuotationNumber) return;
    if (!quotations.length) return;
    const found = quotations.find(q => q.quotationNumber === pendingQuotationNumber);
    if (found) setSelectedQuotation(found);
  }, [pendingQuotationNumber, quotations]);

  const addProductLine = () => {
    setProductLines(prev => [
      ...prev,
      { id: Date.now(), productId: 0, name: "", description: "", qty: 1, unit: defaultUnit, price: 0, discount: 0, discountType: "percent", tax: 0 },
    ]);
  };

  const updateProductLine = (id: number, field: keyof ProductLine, value: any) => {
    setProductLines(prev =>
      prev.map(line => (line.id === id ? { ...line, [field]: value } : line))
    );
  };

  const deleteProductLine = (id: number) => {
    setProductLines(prev => prev.filter(line => line.id !== id));
  };

  // Sinkron default dueDate dengan invoiceDate jika kosong
  useEffect(() => {
    if (!dueDate) setDueDate(invoiceDate);
  }, [invoiceDate]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/products', { cache: 'no-store' });
        const json = await res.json();
        const rows: any[] = Array.isArray(json) ? json : (Array.isArray(json?.data) ? json.data : []);
        if (!active) return;
        setProducts(rows.map((p: any) => ({
          id: Number(p.id),
          name: String(p.name || ''),
          sku: p.sku ?? null,
          sellPrice: Number(p.sellPrice || 0),
          unit: p.unit ?? null,
          description: p.description ?? null,
          qty: Number(p.qty || 0),
        })));
      } catch {
        if (active) setProducts([]);
      } finally {
        if (active) setProductsLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  // Suggest next invoice number (server-side helper)
  useEffect(() => {
    const loadSuggestion = async () => {
      try {
        const res = await fetch(`/api/invoices/next-number?date=${encodeURIComponent(invoiceDate)}`, { cache: 'no-store' });
        const json = await res.json();
        setSuggestedNumber(json?.number || "");
      } catch { setSuggestedNumber(''); }
    };
    loadSuggestion();
  }, [invoiceDate]);

  // Fetch quotations for linking
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setQuotationsLoading(true);
        const res = await fetch('/api/quotations', { cache: 'no-store' });
        const json = await res.json();
        const rows: any[] = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
        if (!active) return;
        const mapped: QuotationSummary[] = rows.map((r: any) => ({
          id: Number(r.id),
          quotationNumber: String(r.quotationNumber || ''),
          status: String(r.status || ''),
          customerId: Number(r.customerId || r.customer?.id || 0),
          customerName: String(r.customer?.pic || ''),
          customerCompany: String(r.customer?.company || ''),
          date: r.date ? new Date(r.date).toISOString().slice(0,10) : '',
          totalAmount: Number(r.totalAmount || 0),
        }));
        setQuotations(mapped);
      } catch {
        if (active) setQuotations([]);
      } finally {
        if (active) setQuotationsLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  // Auto set customer fields when quotation selected
  useEffect(() => {
    if (selectedQuotation) {
      setCustomerId(selectedQuotation.customerId);
      setClient(selectedQuotation.customerName);
      setClientCompany(selectedQuotation.customerCompany);
    }
  }, [selectedQuotation]);

  const subtotal = useMemo(() => productLines.reduce((sum, line) => sum + line.qty * line.price, 0), [productLines]);
  const totalLineDiscount = useMemo(() => {
    return productLines.reduce((sum, line) => {
      const base = line.qty * line.price;
      if (line.discountType === "amount") {
        const amt = Math.max(0, Math.min(base, Number(line.discount) || 0));
        return sum + amt;
      } else {
        const dPct = Math.max(0, Math.min(100, Number(line.discount) || 0));
        return sum + Math.round((base * dPct) / 100);
      }
    }, 0);
  }, [productLines]);

  const baseAfterLineDiscount = useMemo(() => Math.max(0, subtotal - totalLineDiscount), [subtotal, totalLineDiscount]);

  const extraDiscountAmount = useMemo(() => {
    if (extraDiscountType === "percent") {
      const pct = Math.max(0, Math.min(100, extraDiscountValue || 0));
      return Math.round((baseAfterLineDiscount * pct) / 100);
    }
    return Math.min(baseAfterLineDiscount, Math.max(0, extraDiscountValue || 0));
  }, [extraDiscountType, extraDiscountValue, baseAfterLineDiscount]);

  const afterExtraDiscount = useMemo(() => Math.max(0, baseAfterLineDiscount - extraDiscountAmount), [baseAfterLineDiscount, extraDiscountAmount]);

  const basePlusShipping = useMemo(() => Math.max(0, afterExtraDiscount + (shippingCost || 0)), [afterExtraDiscount, shippingCost]);

  const { taxRate, taxInclusive, taxAmount, totalBeforeDP } = useMemo(() => {
    let rate = 0;
    let inclusive = false;
    if (taxMode === "ppn_11_inclusive") { rate = 11; inclusive = true; }
    else if (taxMode === "ppn_11_exclusive") { rate = 11; inclusive = false; }
    else if (taxMode === "ppn_12_inclusive") { rate = 12; inclusive = true; }
    else if (taxMode === "ppn_12_exclusive") { rate = 12; inclusive = false; }
    else { rate = 0; }

    if (rate === 0) return { taxRate: 0, taxInclusive: false, taxAmount: 0, totalBeforeDP: basePlusShipping };

    if (inclusive) {
      const t = Math.round((basePlusShipping * rate) / (100 + rate));
      return { taxRate: rate, taxInclusive: true, taxAmount: t, totalBeforeDP: basePlusShipping };
    } else {
      const t = Math.round((basePlusShipping * rate) / 100);
      return { taxRate: rate, taxInclusive: false, taxAmount: t, totalBeforeDP: basePlusShipping + t };
    }
  }, [taxMode, basePlusShipping]);

  const total = useMemo(() => Math.max(0, totalBeforeDP - (downPayment || 0)), [totalBeforeDP, downPayment]);

  // Prefill from Sales Order if available
  useEffect(() => {
    try {
      const raw = localStorage.getItem("newInvoiceFromSO");
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data?.from === "sales-order") {
        // set client (PIC) dan perusahaan, lock client picker
        setClient(data.customer?.pic || "");
        setClientCompany(data.customer?.company || "");
        setClientReadOnly(true);
        if (Number(data.customer?.id)) {
          setCustomerId(Number(data.customer.id));
        }
          if (Array.isArray(data.items) && data.items.length) {
            setProductLines(
              data.items.map((it: any, idx: number) => ({
                id: Date.now() + idx,
                productId: it.productId || 0,
                name: String(it.name || it.description || ""),
                description: it.description || "",
                qty: Number(it.qty) || 1,
                price: Number(it.price) || 0,
                discount: Number(it.discount) || 0,
                discountType: (it.discountType as any) === "amount" || (it.discountType as any) === "percent" ? it.discountType : "percent",
              tax: Number(it.tax) || 0,
            }))
          );
        }
        // Simpan quotationId / quotationNumber untuk ditautkan setelah daftar quotations dimuat
        if (data.quotationId) {
          setPendingQuotationId(Number(data.quotationId) || null);
          const foundQuotation = quotations.find(q => q.id === Number(data.quotationId));
          if (foundQuotation) setSelectedQuotation(foundQuotation);
        } else if (data.quotationNumber) {
          const qnum = String(data.quotationNumber);
          setPendingQuotationNumber(qnum);
          const foundByNumber = quotations.find(q => q.quotationNumber === qnum);
          if (foundByNumber) setSelectedQuotation(foundByNumber);
        }
        // Jangan isi otomatis Instruksi Khusus; biarkan kosong untuk invoice
      }
    } catch {}
    finally {
      localStorage.removeItem("newInvoiceFromSO");
    }
  }, []);

  const handleSubmit = async () => {
    if (!customerId) {
      toast.error("Pilih Client terlebih dahulu");
      return;
    }
    if (productLines.length === 0) {
      toast.error("Tambahkan minimal 1 produk");
      return;
    }
    const missingName = productLines.find((line) => !(line.name || "").trim());
    if (missingName) {
      toast.error("Isi nama produk pada setiap baris");
      return;
    }
    setSavingInvoice(true);
    try {
      const payload = {
        invoiceNumber,
        invoiceDate,
        dueDate,
        customerId,
        quotationId: selectedQuotation?.id ?? null,
        items: productLines.map((l) => ({
          name: l.name.trim(),
          description: l.description,
          qty: l.qty,
          unit: l.unit || defaultUnit,
          price: l.price,
          discount: l.discount,
          discountType: l.discountType,
        })),
        // Simpan satu field sebagai terms; notes dihilangkan
        notes: null,
        terms: specialInstructions,
        extraDiscountType,
        extraDiscountValue,
        shippingCost,
        taxMode,
        downPayment,
      };
      // Clamp terms length to DB column limit (default VARCHAR 191)
      if (payload.terms) payload.terms = String(payload.terms).slice(0, 191);
      const res = await fetch('/api/invoices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        throw new Error(json?.message || 'Gagal menyimpan invoice');
      }
      toast.success("Invoice berhasil disimpan");
      router.push("/penjualan/invoice-penjualan");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Terjadi kesalahan saat menyimpan");
    } finally {
      setSavingInvoice(false);
    }
  };

  const handleCancel = () => {
    try {
      const from = searchParams?.get('from');
      const soId = searchParams?.get('soId');
      if (from === 'so' && soId) {
        router.push(`/penjualan/order-penjualan/${soId}`);
        return;
      }
    } catch {}
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/penjualan/invoice-penjualan');
    }
  };

  const handleReset = () => {
    setProductLines([]);
    setExtraDiscountType("amount");
    setExtraDiscountValue(0);
    setShippingCost(0);
    setTaxMode("none");
    setDownPayment(0);
  };

  return (
    <FeatureGuard feature="sales.invoice">
    <div className="sales-scope p-4 sm:p-6">

      <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6 shadow-sm">
        <h1 className="text-2xl font-semibold mb-6">Buat Invoice Penjualan</h1>

        {/* Header Form */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6">
          <div className="md:col-span-2">
            <label className="block mb-1 font-medium">No. Invoice *</label>
            <input
              type="text"
              value={suggestedNumber}
              readOnly
              className="border px-3 py-2 rounded w-full bg-gray-50 text-gray-600"
            />
            <p className="text-xs text-gray-500 mt-1">Nomor dibuat otomatis.</p>
          </div>
          <div>
            <label className="block mb-1 font-medium">Tgl. Invoice *</label>
            <DatePicker value={invoiceDate} onChange={setInvoiceDate} />
          </div>
          <div>
            <label className="block mb-1 font-medium">Tgl. Jatuh Tempo *</label>
          <DatePicker value={dueDate} onChange={setDueDate} />
        </div>
          <ClientCompanyPicker client={client} setClient={setClient} setCustomerId={setCustomerId} setClientCompany={setClientCompany} readOnly={clientReadOnly} presetCompany={clientCompany} />
          <div className="md:col-span-2">
            <label className="block mb-1 font-medium">Ref. Quotation (opsional)</label>
            <QuotationDropdown value={selectedQuotation?.id ?? null} quotations={quotations} onSelect={setSelectedQuotation} loading={quotationsLoading} />
            {selectedQuotation ? (
              <p className="mt-1 text-xs text-gray-500">Terhubung ke {selectedQuotation.quotationNumber}. Ini hanya referensi; item tidak otomatis berubah.</p>
            ) : (
              <p className="mt-1 text-xs text-gray-400">Menghubungkan invoice ke quotation akan memudahkan pelacakan.</p>
            )}
          </div>
        </div>

        {/* Product Table - styled like template */}
        <div className="rounded-2xl border border-gray-200 bg-white p-0 overflow-visible mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
            <div>
              <h2 className="text-base font-semibold text-gray-800">Daftar Produk</h2>
              <p className="text-xs text-gray-500">Cari produk dari katalog atau isi manual untuk kebutuhan khusus.</p>
            </div>
            <button
              type="button"
              onClick={addProductLine}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
            >
              <PlusCircle className="h-4 w-4" />
              Tambah Item
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] xl:min-w-[900px] 2xl:min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="p-3 text-left w-16">S. No.</th>
                  <th className="p-3 text-left">Products</th>
                  <th className="p-3 text-left">Quantity</th>
                  <th className="p-3 text-left">Unit Cost</th>
                  <th className="p-3 text-left">Discount</th>
                  <th className="p-3 text-right">Total</th>
                  <th className="p-3 text-center w-16">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {productLines.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-500">Belum ada produk</td>
                  </tr>
                ) : (
                  productLines.map((line, idx) => {
                    const selectedProduct = line.productId ? productMap.get(line.productId) : undefined;
                    const lineName = (line.name || "").trim();
                    const base = line.qty * line.price;
                    const dAmt = line.discountType === "amount"
                     ? Math.max(0, Math.min(base, Number(line.discount) || 0))
                      : Math.round((base * Math.max(0, Math.min(100, Number(line.discount) || 0))) / 100);
                    const totalLine = base - dAmt;
                    return (
                      <tr key={line.id} className="border-t align-top hover:bg-gray-50">
                        <td className="p-3 align-top">{idx + 1}</td>
                        <td className="p-3 align-top">
                          <div className="space-y-1.5">
                            <ProductDropdown
                              line={line}
                              selectedProduct={selectedProduct}
                              products={products}
                              loading={productsLoading}
                              onSelectProduct={applyProductOptionToLine}
                              onManualInput={handleManualProductEntry}
                              resolveProductByInput={findProductByInput}
                            />
                            <textarea
                              value={line.description}
                              onChange={(e) => updateProductLine(line.id, "description", e.target.value)}
                              placeholder="Detail produk, varian, catatan"
                              rows={2}
                              className="w-full min-w-[200px] resize-y rounded-md border px-2 py-1 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            />
                            <div className="flex flex-wrap items-center gap-x-3 text-[11px] text-gray-400">
                              {selectedProduct ? (
                                <>
                                  <span>
                                  Stok: {selectedProduct.qty ?? 0} {selectedProduct.unit || defaultUnit}
                                  </span>
                                  <span>
                                    Harga standar:{" "}
                                    {Number(selectedProduct.sellPrice || 0).toLocaleString("id-ID", {
                                      style: "currency",
                                      currency: "IDR",
                                      maximumFractionDigits: 0,
                                    })}
                                  </span>
                                </>
                              ) : lineName ? (
                                <span>Item manual</span>
                              ) : (
                                <span>Pilih produk atau ketik manual</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-3 align-top">
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={1}
                              value={line.qty}
                              onChange={(e) => updateProductLine(line.id, "qty", Math.max(1, Number(e.target.value) || 1))}
                              className="w-full min-w-[72px] rounded-md border px-2 py-1 text-center shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            />
                            {(() => {
                              const unitsSource = productUnits.length
                                ? productUnits
                                : [{ id: 0, name: "pcs", symbol: "pcs" }];
                              const hasCurrentUnit =
                                (line.unit || "").length > 0 &&
                                !unitsSource.some(
                                  (unit) =>
                                    unit.symbol.toLowerCase() === String(line.unit).toLowerCase()
                                );
                              return (
                                <select
                                  value={line.unit || ""}
                                  onChange={(e) =>
                                    updateProductLine(
                                      line.id,
                                      "unit",
                                      e.target.value || defaultUnit
                                    )
                                  }
                                  className="min-w-[72px] rounded-md border px-2 py-1 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                >
                                  <option value="">{defaultUnit}</option>
                                  {unitsSource.map((unit) => (
                                    <option key={unit.id} value={unit.symbol}>
                                      {unit.symbol}{" "}
                                      {unit.name !== unit.symbol ? `- ${unit.name}` : ""}
                                    </option>
                                  ))}
                                  {hasCurrentUnit ? (
                                    <option value={line.unit}>{line.unit}</option>
                                  ) : null}
                                </select>
                              );
                            })()}
                          </div>
                        </td>
                        <td className="p-3 align-top">
                          <input
                            type="number"
                            value={line.price}
                            onChange={(e) => updateProductLine(line.id, "price", Math.max(0, Number(e.target.value) || 0))}
                            className="w-full rounded-md border px-2 py-1 text-right shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          />
                        </td>
                        <td className="p-3 align-top">
                          <div className="flex items-center gap-2">
                            <select
                              value={line.discountType}
                              onChange={(e) => updateProductLine(line.id, "discountType", e.target.value as any)}
                              className="rounded-md border px-2 py-1 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            >
                              <option value="amount">Rp</option>
                              <option value="percent">%</option>
                            </select>
                            <input
                              type="number"
                              value={line.discount}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                if (line.discountType === "percent") {
                                  updateProductLine(line.id, "discount", Math.max(0, Math.min(100, val || 0)));
                                } else {
                                  updateProductLine(line.id, "discount", Math.max(0, val || 0));
                                }
                              }}
                              className="w-full rounded-md border px-2 py-1 text-right shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            />
                          </div>
                        </td>
                        <td className="p-3 align-top text-right font-medium text-gray-800">
                          {totalLine.toLocaleString("id-ID", { style: "currency", currency: "IDR" })}
                        </td>
                        <td className="p-3 align-top text-center">
                          <button
                            type="button"
                            onClick={() => deleteProductLine(line.id)}
                            className="rounded-full p-1 text-red-500 transition hover:bg-red-50 hover:text-red-700"
                            aria-label="Hapus produk"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Input bar moved to separate card below */}
        </div>
        {/* Ringkasan & Komponen Perhitungan */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="space-y-3 lg:col-span-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block mb-1 text-sm font-medium">Diskon Tambahan</label>
                <div className="flex gap-2">
                  <select
                    value={extraDiscountType}
                    onChange={(e) => setExtraDiscountType(e.target.value as any)}
                    className="border rounded px-2 py-2 text-sm"
                  >
                    <option value="amount">Rp</option>
                    <option value="percent">%</option>
                  </select>
                  <input
                    type="number"
                    value={extraDiscountValue}
                    onChange={(e) => setExtraDiscountValue(Number(e.target.value))}
                    className="border rounded px-3 py-2 w-full text-right"
                  />
                </div>
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium">Biaya Kirim</label>
                <input
                  type="number"
                  value={shippingCost}
                  onChange={(e) => setShippingCost(Number(e.target.value))}
                  className="border rounded px-3 py-2 w-full text-right"
                />
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium">Pajak</label>
                <select
                  value={taxMode}
                  onChange={(e) => setTaxMode(e.target.value as TaxMode)}
                  className="border rounded px-2 py-2 w-full text-sm"
                >
                  <option value="none">none</option>
                  <option value="non_pkp">non Pkp</option>
                  <option value="ppn_11_inclusive">PPN 11% INCLUSIVE</option>
                  <option value="ppn_11_exclusive">PPN 11% EXCLUSIVE</option>
                  <option value="ppn_12_inclusive">PPN 12% INCLUSIVE</option>
                  <option value="ppn_12_exclusive">PPN 12% EXCLUSIVE</option>
                </select>
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium">Uang Muka</label>
                <input
                  type="number"
                  value={downPayment}
                  onChange={(e) => setDownPayment(Number(e.target.value))}
                  className="border rounded px-3 py-2 w-full text-right"
                />
              </div>
            </div>

            {/* Instruksi Khusus */}
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block mb-1 font-medium">Instruksi Khusus</label>
                <textarea
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  className="border rounded w-full p-3 h-32 resize-none text-sm text-gray-600 placeholder-gray-400"
                  rows={5}
                  maxLength={191}
                />
                <div className="mt-1 text-xs text-gray-500">{specialInstructions.length}/191 karakter</div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-1 lg:col-start-3">
            <div className="rounded border p-4 bg-gray-50">
              <div className="flex justify-between py-1 text-sm">
                <span>Subtotal</span>
                <span>{subtotal.toLocaleString("id-ID", { style: "currency", currency: "IDR" })}</span>
              </div>
              {totalLineDiscount > 0 && (
                <div className="flex justify-between py-1 text-sm">
                  <span>Total Diskon</span>
                  <span>{totalLineDiscount.toLocaleString("id-ID", { style: "currency", currency: "IDR" })}</span>
                </div>
              )}
              {extraDiscountAmount > 0 && (
                <div className="flex justify-between py-1 text-sm">
                  <span>Diskon Tambahan ({extraDiscountType === "percent" ? `${Math.max(0, Math.min(100, extraDiscountValue))}%` : "Rp"})</span>
                  <span>{extraDiscountAmount.toLocaleString("id-ID", { style: "currency", currency: "IDR" })}</span>
                </div>
              )}
              {Number(shippingCost) > 0 && (
                <div className="flex justify-between py-1 text-sm">
                  <span>Biaya Kirim</span>
                  <span>{(shippingCost || 0).toLocaleString("id-ID", { style: "currency", currency: "IDR" })}</span>
                </div>
              )}
              {taxMode !== "none" && (
                <div className="flex justify-between py-1 text-sm">
                  <span>
                    Pajak {taxMode.replaceAll("_", " ")}
                    {taxRate ? ` (${taxRate}% ${taxInclusive ? "INCL" : "EXCL"})` : ""}
                  </span>
                  <span>{taxAmount.toLocaleString("id-ID", { style: "currency", currency: "IDR" })}</span>
                </div>
              )}
              <div className="flex justify-between py-1 text-sm">
                <span>Uang Muka</span>
                <span>{(downPayment || 0).toLocaleString("id-ID", { style: "currency", currency: "IDR" })}</span>
              </div>
              <div className="mt-2 border-t pt-3 flex justify-between items-center font-semibold text-lg">
                <span>Total</span>
                <span>{total.toLocaleString("id-ID", { style: "currency", currency: "IDR" })}</span>
              </div>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row justify-end gap-2 sm:gap-2">
              <button type="button" onClick={handleCancel} className="border px-3 py-1.5 rounded hover:bg-gray-100 text-sm">Kembali</button>
              <button
                className="border px-3 py-1.5 rounded hover:bg-gray-100 disabled:opacity-60 disabled:cursor-not-allowed text-sm"
                onClick={() => canPreview && setIsPreviewOpen(true)}
                disabled={!canPreview}
                title={!canPreview ? "Tambahkan minimal 1 produk untuk preview" : undefined}
              >
                Preview
              </button>
              <button type="button" onClick={handleReset} className="border px-3 py-1.5 rounded hover:bg-gray-100 text-sm">Reset</button>
              <button className="bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-sm" onClick={handleSubmit} disabled={savingInvoice}>
                Invoice
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* Preview Modal */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6" onClick={(e) => { if (e.target === e.currentTarget) setIsPreviewOpen(false); }}>
          <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="text-lg font-semibold">Invoice Preview</h3>
              <button className="h-8 w-8 inline-flex items-center justify-center rounded-full hover:bg-gray-100" onClick={() => setIsPreviewOpen(false)} aria-label="Close preview">Ã—</button>
            </div>
            <div className="max-h-[80vh] overflow-auto p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="text-sm text-gray-500">Invoice #</div>
                  <div className="font-medium">{invoiceNumber}</div>
                  <div className="mt-3 text-sm text-gray-500">Client</div>
                  <div className="font-medium">{customerDisplay}</div>
                </div>
                <div className="md:text-right">
                  <div className="text-sm text-gray-500">Issued On</div>
                  <div className="font-medium">{invoiceDate || '-'}</div>
                  <div className="mt-3 text-sm text-gray-500">Due On</div>
                  <div className="font-medium">{dueDate || '-'}</div>
                </div>
              </div>

              {/* Items table */}
              <div className="rounded-lg border bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] text-sm">
                    <thead className="bg-gray-50">
                      <tr className="text-gray-700">
                        <th className="p-3 text-left w-16">S.No.</th>
                        <th className="p-3 text-left">Products</th>
                        <th className="p-3 text-left">Quantity</th>
                        <th className="p-3 text-left">Unit Cost</th>
                        <th className="p-3 text-left">Discount</th>
                        <th className="p-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productLines.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-gray-500">Belum ada produk</td>
                        </tr>
                      ) : (
                        productLines.map((line, idx) => {
                          const base = line.qty * line.price;
                          const dAmt = line.discountType === 'amount'
                            ? Math.max(0, Math.min(base, Number(line.discount) || 0))
                            : Math.round((base * Math.max(0, Math.min(100, Number(line.discount) || 0))) / 100);
                          const totalLine = base - dAmt;
                          return (
                            <tr key={line.id} className="border-t">
                              <td className="p-3">{idx + 1}</td>
                              <td className="p-3">
                                <div className="font-medium">{line.name || '-'}</div>
                              {line.description ? (
                                  <div className="text-xs text-gray-500">{line.description}</div>
                                ) : null}
                              </td>
                              <td className="p-3">{line.qty} {line.unit || defaultUnit}</td>
                              <td className="p-3">{fmt(line.price)}</td>
                              <td className="p-3">{line.discountType === 'percent' ? `${line.discount || 0}%` : fmt(Number(line.discount) || 0)}</td>
                              <td className="p-3 text-right">{fmt(totalLine)}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Order summary */}
              <div className="mt-5 flex justify-end">
                <div className="w-full max-w-sm">
                  <div className="flex justify-between py-1 text-sm"><span>Sub Total</span><span>{fmt(subtotal)}</span></div>
                  {totalLineDiscount > 0 && (
                    <div className="flex justify-between py-1 text-sm"><span>Diskon per item</span><span>{fmt(totalLineDiscount)}</span></div>
                  )}
                  {extraDiscountAmount > 0 && (
                    <div className="flex justify-between py-1 text-sm"><span>Extra Discount</span><span>{fmt(extraDiscountAmount)}</span></div>
                  )}
                  {Number(shippingCost) > 0 && (
                    <div className="flex justify-between py-1 text-sm"><span>Biaya Kirim</span><span>{fmt(shippingCost || 0)}</span></div>
                  )}
                  {taxMode !== 'none' && (
                    <div className="flex justify-between py-1 text-sm">
                      <span>Pajak {taxMode.replaceAll('_', ' ')}</span>
                      <span>{fmt(taxAmount)}</span>
                    </div>
                  )}
                  {Number(downPayment) > 0 && (
                    <div className="flex justify-between py-1 text-sm"><span>Uang Muka</span><span>{fmt(downPayment || 0)}</span></div>
                  )}
                  <div className="mt-2 border-t pt-3 flex justify-between items-center font-semibold text-lg">
                    <span>Total</span>
                    <span>{fmt(total)}</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
    </FeatureGuard>
  );
}

function QuotationDropdown({
  value,
  quotations,
  onSelect,
  loading,
}: { value: number | null; quotations: QuotationSummary[]; onSelect: (q: QuotationSummary | null) => void; loading: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const portalRef = useRef<HTMLDivElement | null>(null);
  const [menuStyles, setMenuStyles] = useState<React.CSSProperties>({});
  const selected = value != null ? quotations.find((q) => q.id === value) ?? null : null;
  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (containerRef.current?.contains(event.target as Node) || portalRef.current?.contains(event.target as Node)) return;
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
      setMenuStyles({ position: "fixed", top, left, width, zIndex: 90 });
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
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return quotations.slice(0, 80);
    return quotations
      .filter(
        (q) =>
          q.quotationNumber.toLowerCase().includes(term) ||
          q.customerName.toLowerCase().includes(term) ||
          q.customerCompany.toLowerCase().includes(term)
      )
      .slice(0, 80);
  }, [quotations, query]);
  const handleSelect = (q: QuotationSummary) => {
    onSelect(q);
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
              <span className="font-medium">{selected.quotationNumber} - {selected.customerName}</span>
              <span className="text-gray-500"> {`(${selected.customerCompany})`}</span>
            </>
          ) : (
            <span className="text-gray-500">{loading ? "Memuat quotation..." : "Hubungkan dengan quotation (opsional)"}</span>
          )}
        </span>
        <ChevronDown className="ml-2 h-4 w-4 opacity-70" />
      </button>
      {open && typeof document !== "undefined" ? (
        ReactDOM.createPortal(
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
                <div className="px-4 py-3 text-sm text-gray-500">Memuat quotation...</div>
              ) : filtered.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-500">Quotation tidak ditemukan.</div>
              ) : (
                filtered.map((q) => {
                  const active = q.id === selected?.id;
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => handleSelect(q)}
                      className={`block w-full px-4 py-3 text-left text-sm hover:bg-gray-50 ${active ? "bg-blue-50" : ""}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-800">{q.quotationNumber}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] ${q.status === "Confirmed" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}
                        >
                          {q.status}
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-gray-500">{q.customerName} - {q.customerCompany}</div>
                      <div className="mt-0.5 text-[11px] text-gray-400">{q.date} - {fmtIDR(q.totalAmount || 0)}</div>
                    </button>
                  );
                })
              )}
            </div>
            <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-3 py-2 text-xs">
              <button type="button" onClick={() => setOpen(false)} className="rounded px-2 py-1 text-gray-600 hover:text-gray-800">Tutup</button>
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
      ) : null}
    </div>
  );
}

// Picker perusahaan client terhubung database
function ClientCompanyPicker({ client, setClient, setCustomerId, setClientCompany, readOnly, presetCompany }: { client: string; setClient: (v: string) => void; setCustomerId?: (id: number | null) => void; setClientCompany?: (v: string) => void; readOnly?: boolean; presetCompany?: string }) {
  const [customers, setCustomers] = useState<Array<{ id: number; company: string; pic: string }>>([]);
  const [selectedId, setSelectedId] = useState<number | ''>('');
  const [company, setCompany] = useState<string>("");
  const [openAdd, setOpenAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ pic: "", company: "", address: "", phone: "", email: "" });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/customers', { cache: 'no-store' });
        const json = await res.json();
        const rows = Array.isArray(json) ? json : (Array.isArray(json?.data) ? json.data : []);
        const mapped: Array<{ id: number; company: string; pic: string }> = rows.map((c: any) => ({ id: Number(c.id), company: c.company || c.name || 'Unknown', pic: c.pic || '' }));
        setCustomers(mapped);
        const found = mapped.find(c => c.pic.toLowerCase() === (client || '').toLowerCase());
        if (found) {
          setSelectedId(found.id);
          setCompany(found.company);
          setCustomerId && setCustomerId(found.id);
          setClientCompany && setClientCompany(found.company || '');
        }
      } catch {}
    })();
  }, []);

  const refreshCustomers = async (preselectId?: number) => {
    try {
      const res = await fetch('/api/customers', { cache: 'no-store' });
      const json = await res.json();
        const rows = Array.isArray(json) ? json : (Array.isArray(json?.data) ? json.data : []);
        const mapped: Array<{ id: number; company: string; pic: string }> = rows.map((c: any) => ({ id: Number(c.id), company: c.company || c.name || 'Unknown', pic: c.pic || '' }));
        setCustomers(mapped);
        if (preselectId) {
          const chosen = mapped.find(c => c.id === preselectId);
          if (chosen) {
            setSelectedId(chosen.id);
            setClient(chosen.pic || '');
            setCompany(chosen.company || '');
            setCustomerId && setCustomerId(chosen.id);
            setClientCompany && setClientCompany(chosen.company || '');
          }
        }
    } catch {}
  };

  const saveNewCustomer = async () => {
    if (!form.pic || !form.company || !form.address || !form.phone) return;
    setSaving(true);
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Gagal menyimpan');
      const created = await res.json();
      setOpenAdd(false);
      setForm({ pic: '', company: '', address: '', phone: '', email: '' });
      await refreshCustomers(created.id);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (readOnly) {
    // Jika perusahaan dipreset dari SO, gunakan itu untuk ditampilkan
    const displayCompany = presetCompany ?? company;
    return (
      <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block mb-1 font-medium">Client (PIC)</label>
          <input readOnly value={client} className="border px-3 py-2 rounded w-full bg-gray-50 text-gray-600" />
        </div>
        <div>
          <label className="block mb-1 font-medium">Perusahaan</label>
          <input readOnly value={displayCompany} className="border px-3 py-2 rounded w-full bg-gray-50 text-gray-600" />
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between gap-2">
              <label className="block mb-1 font-medium">Pilih Client (PIC) *</label>
            </div>
            <CustomerPicker
              value={typeof selectedId === 'number' ? selectedId : null}
              onChange={(c) => {
                const id = c?.id ?? null;
                setSelectedId(id ?? '');
                setClient(c?.pic || '');
                setCompany(c?.company || '');
                setCustomerId && setCustomerId(id);
                setClientCompany && setClientCompany(c?.company || '');
              }}
              onAddNew={() => setOpenAdd(true)}
            />
            <p className="text-xs text-gray-500 mt-1">Terhubung ke database /api/customers</p>
          </div>
          <div>
            <label className="block mb-1 font-medium">Perusahaan</label>
            <input
              type="text"
              value={company}
              readOnly
              placeholder="Perusahaan akan otomatis tampil"
              className="border px-3 py-2 rounded w-full bg-gray-50 text-gray-600"
            />
          </div>
      </div>

      {openAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-lg bg-white p-5 shadow-lg">
            <div className="mb-3">
              <h3 className="text-lg font-semibold">Tambah Client</h3>
              <p className="text-xs text-gray-500">Lengkapi data sesuai kebutuhan database.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block mb-1 text-sm">Nama Client (PIC) *</label>
                <input className="w-full rounded border px-3 py-2" value={form.pic} onChange={(e)=>setForm({...form,pic:e.target.value})} />
              </div>
              <div>
                <label className="block mb-1 text-sm">Perusahaan *</label>
                <input className="w-full rounded border px-3 py-2" value={form.company} onChange={(e)=>setForm({...form,company:e.target.value})} />
              </div>
              <div className="md:col-span-2">
                <label className="block mb-1 text-sm">Alamat *</label>
                <input className="w-full rounded border px-3 py-2" value={form.address} onChange={(e)=>setForm({...form,address:e.target.value})} />
              </div>
              <div>
                <label className="block mb-1 text-sm">Telepon *</label>
                <input className="w-full rounded border px-3 py-2" value={form.phone} onChange={(e)=>setForm({...form,phone:e.target.value})} />
              </div>
              <div>
                <label className="block mb-1 text-sm">Email</label>
                <input className="w-full rounded border px-3 py-2" type="email" value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})} />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="rounded border px-4 py-2 hover:bg-gray-100" onClick={()=>setOpenAdd(false)} disabled={saving}>Batal</button>
              <button className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60" onClick={saveNewCustomer} disabled={saving || !form.pic || !form.company || !form.address || !form.phone}>
                {saving? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Komponen input bar untuk tambah produk ala template
type ProductDropdownProps = {
  line: ProductLine;
  selectedProduct?: ProductOption;
  products: ProductOption[];
  loading: boolean;
  onSelectProduct: (lineId: number, product: ProductOption) => void;
  onManualInput: (lineId: number, value: string) => void;
  resolveProductByInput: (value: string) => ProductOption | null;
};

function ProductDropdown({
  line,
  selectedProduct,
  products,
  loading,
  onSelectProduct,
  onManualInput,
  resolveProductByInput,
}: ProductDropdownProps) {
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
        top = above >= viewportTop ? above : Math.max(viewportTop, viewportBottom - estimatedHeight);
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
    if (open) setQuery(line.name || "");
  }, [line.name, open]);

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
      onSelectProduct(line.id, matched);
    } else {
      onManualInput(line.id, trimmed);
    }
    setOpen(false);
    setQuery("");
  };

  const handleSelect = (product: ProductOption) => {
    onSelectProduct(line.id, product);
    setOpen(false);
    setQuery("");
  };

  const trimmedQuery = query.trim();
  const matchedProduct = trimmedQuery
    ? resolveProductByInput(trimmedQuery)
    : null;
  const manualLabel = (line.name || "").trim();

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-200"
        title={
          selectedProduct
            ? toProductLabel(selectedProduct)
            : manualLabel || "Pilih produk..."
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
          ) : manualLabel ? (
            <span className="font-medium">{manualLabel}</span>
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
                            `Harga: ${Number(prod.sellPrice || 0).toLocaleString("id-ID", {
                              style: "currency",
                              currency: "IDR",
                              maximumFractionDigits: 0,
                            })}`,
                            `Stok: ${prod.qty} ${prod.unit || defaultUnit}`,
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
              <div className="space-y-1 border-t border-gray-200 bg-gray-50 p-2 text-xs">
                {trimmedQuery ? (
                  <button
                    type="button"
                    onClick={commitQuery}
                    className="w-full text-left font-medium text-blue-600 hover:text-blue-700"
                  >
                    {matchedProduct
                      ? `Pilih "${trimmedQuery}"`
                      : `Gunakan "${trimmedQuery}" sebagai nama item`}
                  </button>
                ) : null}
                {(line.productId || manualLabel) && (
                  <button
                    type="button"
                    onClick={() => {
                      onManualInput(line.id, "");
                      setQuery("");
                      setOpen(false);
                    }}
                    className="text-left text-gray-500 hover:text-gray-700"
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
}
