"use client";

import { useEffect, useMemo, useState, useRef, useLayoutEffect } from "react";
import type { CSSProperties } from "react";
import ReactDOM from "react-dom";
import { ChevronDown } from "lucide-react";
import DatePicker from "@/components/DatePicker";
import { useProductUnits } from "@/hooks/useProductUnits";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";

type ProductLine = {
  id: number;
  name: string;
  description: string;
  qty: number;
  unit?: string;
  price: number;
  discount: number;
  discountType: "percent" | "amount";
  tax: number;
};

type TaxMode =
  | "none"
  | "non_pkp"
  | "ppn_11_inclusive"
  | "ppn_11_exclusive"
  | "ppn_12_inclusive"
  | "ppn_12_exclusive";

export default function EditSalesInvoicePage() {
  const router = useRouter();
  const { id } = useParams();
  const searchParams = useSearchParams();

  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customers, setCustomers] = useState<Array<{ id: number; pic: string; company?: string }>>([]);
  const [productLines, setProductLines] = useState<ProductLine[]>([]);
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const { units: productUnits } = useProductUnits();
  const defaultUnit = useMemo(() => productUnits[0]?.symbol || "pcs", [productUnits]);
  const [extraDiscountType, setExtraDiscountType] = useState<"amount" | "percent">("amount");
  const [extraDiscountValue, setExtraDiscountValue] = useState<number>(0);
  const [shippingCost, setShippingCost] = useState<number>(0);
  const [taxMode, setTaxMode] = useState<TaxMode>("none");
  const [downPayment, setDownPayment] = useState<number>(0);
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const canPreview = productLines.length > 0;

  const fmt = (n: number) => n.toLocaleString("id-ID", { style: "currency", currency: "IDR" });

  // Quotation linking
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
  const [quotations, setQuotations] = useState<QuotationSummary[]>([]);
  const [quotationsLoading, setQuotationsLoading] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState<QuotationSummary | null>(null);

  // Load initial invoice and customers
  useEffect(() => {
    (async () => {
      try {
        const [invRes, custRes] = await Promise.all([
          fetch(`/api/invoices/${id}`, { cache: "no-store" }),
          fetch(`/api/customers`, { cache: "no-store" }),
        ]);
        const invJson = await invRes.json();
        const custJson = await custRes.json();
        const custRows = Array.isArray(custJson) ? custJson : (Array.isArray(custJson?.data) ? custJson.data : []);
        setCustomers(custRows.map((c: any) => ({ id: Number(c.id), pic: c.pic || "", company: c.company })));
        if (!invRes.ok || invJson?.success === false) throw new Error(invJson?.message || "Gagal memuat invoice");
        const inv = invJson.data;
        setInvoiceNumber(inv.invoiceNumber || "");
        setInvoiceDate(inv.issueDate ? new Date(inv.issueDate).toISOString().slice(0,10) : "");
        setDueDate(inv.dueDate ? new Date(inv.dueDate).toISOString().slice(0,10) : "");
        setCustomerId(inv.customer?.id ?? null);
        setNotes(inv.notes || "");
        setTerms(inv.terms || "");
        setExtraDiscountType((inv.extraDiscountType as any) || "amount");
        setExtraDiscountValue(Number(inv.extraDiscountValue || 0));
        setShippingCost(Number(inv.shippingCost || 0));
        setTaxMode(inv.taxMode || "none");
        setDownPayment(Number(inv.downPayment || 0));
        if (inv.quotation) {
          setSelectedQuotation({
            id: Number(inv.quotation.id),
            quotationNumber: String(inv.quotation.quotationNumber || ""),
            status: String(inv.quotation.status || ""),
            customerId: Number(inv.customer?.id || inv.quotation.customerId || 0),
            customerName: String(inv.customer?.pic || inv.quotation.customer?.pic || ""),
            customerCompany: String(inv.customer?.company || inv.quotation.customer?.company || ""),
            date: inv.quotation.date ? new Date(inv.quotation.date).toISOString().slice(0,10) : "",
            totalAmount: Number(inv.quotation.totalAmount || 0),
          });
        }
        setProductLines((inv.items || []).map((it: any, idx: number) => ({
          id: Date.now() + idx,
          name: it.name || "",
          description: it.description || "",
          qty: Number(it.qty) || 1,
          unit: it.unit || defaultUnit,
          price: Number(it.price) || 0,
          discount: Number(it.discount) || 0,
          discountType: (it.discountType as any) === "amount" ? "amount" : "percent",
          tax: 0,
        })));
      } catch (e: any) {
        toast.error(e?.message || "Gagal memuat data");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, defaultUnit]);

  useEffect(() => { if (!dueDate) setDueDate(invoiceDate); }, [invoiceDate]);

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
          id: Number(r.id), quotationNumber: String(r.quotationNumber || ''), status: String(r.status || ''),
          customerId: Number(r.customerId || r.customer?.id || 0), customerName: String(r.customer?.pic || ''), customerCompany: String(r.customer?.company || ''),
          date: r.date ? new Date(r.date).toISOString().slice(0,10) : '', totalAmount: Number(r.totalAmount || 0),
        }));
        setQuotations(mapped);
      } catch { if (active) setQuotations([]); }
      finally { if (active) setQuotationsLoading(false); }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (selectedQuotation) {
      setCustomerId(selectedQuotation.customerId);
    }
  }, [selectedQuotation]);

  const subtotal = useMemo(() => productLines.reduce((s, l) => s + l.qty * l.price, 0), [productLines]);
  const totalLineDiscount = useMemo(() => productLines.reduce((sum, l) => {
    const base = l.qty * l.price; return sum + (l.discountType === 'amount' ? Math.max(0, Math.min(base, Number(l.discount)||0)) : Math.round((base * Math.max(0, Math.min(100, Number(l.discount)||0))) / 100));
  }, 0), [productLines]);
  const baseAfterLine = Math.max(0, subtotal - totalLineDiscount);
  const extraDiscountAmount = extraDiscountType === 'percent' ? Math.round((baseAfterLine * Math.max(0, Math.min(100, extraDiscountValue||0))) / 100) : Math.min(baseAfterLine, Math.max(0, extraDiscountValue||0));
  const afterExtra = Math.max(0, baseAfterLine - extraDiscountAmount);
  const basePlusShip = Math.max(0, afterExtra + (shippingCost || 0));
  const taxCalc = useMemo(() => {
    let rate = 0, inclusive = false; const m = taxMode;
    if (m === 'ppn_11_inclusive') { rate=11; inclusive=true; } else if (m==='ppn_11_exclusive'){ rate=11; } else if (m==='ppn_12_inclusive'){ rate=12; inclusive=true; } else if (m==='ppn_12_exclusive'){ rate=12; }
    if (rate===0) return { rate:0, inclusive:false, amount:0, totalBeforeDP: basePlusShip };
    if (inclusive){ const t=Math.round((basePlusShip*rate)/(100+rate)); return { rate, inclusive:true, amount:t, totalBeforeDP: basePlusShip }; }
    const t=Math.round((basePlusShip*rate)/100); return { rate, inclusive:false, amount:t, totalBeforeDP: basePlusShip + t };
  }, [taxMode, basePlusShip]);
  const total = Math.max(0, taxCalc.totalBeforeDP - (downPayment || 0));

  const addLine = () => setProductLines(prev => [...prev, { id: Date.now(), name: "", description: "", qty: 1, unit: defaultUnit, price: 0, discount: 0, discountType: 'percent', tax: 0 }]);
  const updateLine = (id: number, field: keyof ProductLine, value: any) => setProductLines(prev => prev.map(l => l.id===id?{...l,[field]:value}:l));
  const deleteLine = (id: number) => setProductLines(prev => prev.filter(l => l.id!==id));

  const handleSubmit = async () => {
    if (!customerId) return toast.error('Pilih Client terlebih dahulu');
    if (productLines.length === 0) return toast.error('Tambahkan minimal 1 produk');
    setSavingInvoice(true);
    try {
      const payload = {
        invoiceNumber,
        invoiceDate,
        dueDate,
        customerId,
        quotationId: selectedQuotation?.id ?? null,
        items: productLines.map(l => ({
          name: l.name,
          description: l.description,
          qty: l.qty,
          unit: l.unit || defaultUnit,
          price: l.price,
          discount: l.discount,
          discountType: l.discountType,
        })),
        notes,
        terms,
        extraDiscountType,
        extraDiscountValue,
        shippingCost,
        taxMode,
        downPayment,
      };
      const res = await fetch(`/api/invoices/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (!res.ok || json?.success === false) throw new Error(json?.message || 'Gagal menyimpan invoice');
      toast.success('Invoice berhasil diperbarui');
      router.push('/penjualan/invoice-penjualan');
    } catch (e:any) {
      toast.error(e?.message || 'Terjadi kesalahan saat menyimpan');
    } finally {
      setSavingInvoice(false);
    }
  };

  const handleBack = () => {
    try {
      const from = searchParams?.get('from');
      if (from === 'detail' && id) {
        router.push(`/penjualan/invoice-penjualan/${id}`);
        return;
      }
      if (from === 'list') {
        router.push('/penjualan/invoice-penjualan');
        return;
      }
    } catch {}
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/penjualan/invoice-penjualan');
    }
  };

  return (
    <div className="sales-scope p-4 sm:p-6">

      <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6 shadow-sm">
        <h1 className="text-2xl font-semibold mb-6">Buat Invoice Penjualan</h1>

        {loading ? (
          <div className="py-10 text-center text-gray-600">Memuat data…</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6">
              <div className="md:col-span-2">
                <label className="block mb-1 font-medium">No. Invoice *</label>
                <input type="text" value={invoiceNumber} onChange={(e)=>setInvoiceNumber(e.target.value)} className="border px-3 py-2 rounded w-full bg-gray-50 text-gray-600" />
              </div>
              <div>
                <label className="block mb-1 font-medium">Tgl. Invoice *</label>
                <DatePicker value={invoiceDate} onChange={setInvoiceDate} />
              </div>
              <div>
                <label className="block mb-1 font-medium">Tgl. Jatuh Tempo *</label>
                <DatePicker value={dueDate} onChange={setDueDate} />
              </div>
              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 font-medium">Pilih Client (PIC) *</label>
                  <select value={customerId ?? ''} onChange={(e)=>setCustomerId(e.target.value?Number(e.target.value):null)} className="border px-3 py-2 rounded w-full">
                    <option value="">Pilih client…</option>
                    {customers.map(c => (<option key={c.id} value={c.id}>{c.pic || '(Tanpa PIC)'}{c.company?` - ${c.company}`:''}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block mb-1 font-medium">Perusahaan</label>
                  <input type="text" readOnly value={(customers.find(c=>c.id===customerId)?.company)||''} className="border px-3 py-2 rounded w-full bg-gray-50 text-gray-600" />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block mb-1 font-medium">Ref. Quotation (opsional)</label>
                <QuotationDropdown value={selectedQuotation?.id ?? null} quotations={quotations} onSelect={setSelectedQuotation} loading={quotationsLoading} />
                {selectedQuotation ? (
                  <p className="mt-1 text-xs text-gray-500">Terhubung ke {selectedQuotation.quotationNumber}. Mengubah tautan akan memperbarui referensi invoice.</p>
                ) : (
                  <p className="mt-1 text-xs text-gray-400">Hubungkan invoice ke quotation untuk kemudahan pelacakan.</p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-0 overflow-visible mb-6">
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
                      <tr><td colSpan={7} className="py-8 text-center text-gray-500">Belum ada produk</td></tr>
                    ) : productLines.map((line, idx) => {
                      const base = line.qty * line.price;
                      const dAmt = line.discountType === 'amount' ? Math.max(0, Math.min(base, Number(line.discount)||0)) : Math.round((base * Math.max(0, Math.min(100, Number(line.discount)||0))) / 100);
                      const totalLine = base - dAmt;
                      return (
                        <tr key={line.id} className="border-t hover:bg-gray-50">
                          <td className="p-3">{idx+1}</td>
                          <td className="p-3">
                            <input type="text" value={line.name} onChange={(e)=>updateLine(line.id,'name',e.target.value)} placeholder="Nama produk" className="w-full rounded border px-2 py-1 text-sm" />
                            <input type="text" value={line.description} onChange={(e)=>updateLine(line.id,'description',e.target.value)} placeholder="Deskripsi (opsional)" className="mt-1 w-full rounded border px-2 py-1 text-xs text-gray-600" />
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <input type="number" value={line.qty} onChange={(e)=>updateLine(line.id,'qty',Math.max(1, Number(e.target.value)))} className="w-20 rounded border px-2 py-1 text-right" />
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
                                      updateLine(line.id, "unit", e.target.value || defaultUnit)
                                    }
                                    className="rounded border px-2 py-1 text-sm"
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
                          <td className="p-3"><input type="number" value={line.price} onChange={(e)=>updateLine(line.id,'price',Math.max(0, Number(e.target.value)))} className="w-28 rounded border px-2 py-1 text-right" /></td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <select value={line.discountType} onChange={(e)=>updateLine(line.id,'discountType',e.target.value as any)} className="rounded border px-2 py-1">
                                <option value="amount">Rp</option>
                                <option value="percent">%</option>
                              </select>
                              <input type="number" value={line.discount} onChange={(e)=>updateLine(line.id,'discount',Math.max(0, Number(e.target.value)))} className="w-24 rounded border px-2 py-1 text-right" />
                            </div>
                          </td>
                          <td className="p-3 text-right">{fmt(totalLine)}</td>
                          <td className="p-3 text-center"><button onClick={()=>deleteLine(line.id)} className="rounded border px-2 py-1 text-xs hover:bg-gray-100">Hapus</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="border-t p-3 flex items-center justify-between">
                <button onClick={addLine} className="rounded bg-blue-600 px-3 h-8 text-xs text-white hover:bg-blue-700">+ Tambah Produk</button>
                <div className="text-xs text-gray-500">Edit mengikuti layout halaman tambah</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-1 text-sm font-medium">Extra Discount</label>
                    <div className="flex items-center gap-2">
                      <select value={extraDiscountType} onChange={(e)=>setExtraDiscountType(e.target.value as any)} className="rounded border px-3 py-2 text-sm"><option value="amount">Rp</option><option value="percent">%</option></select>
                      <input type="number" value={extraDiscountValue} onChange={(e)=>setExtraDiscountValue(Number(e.target.value))} className="rounded border px-3 py-2 w-40 text-right" />
                    </div>
                  </div>
                  <div>
                    <label className="block mb-1 text-sm font-medium">Biaya Kirim</label>
                    <input type="number" value={shippingCost} onChange={(e)=>setShippingCost(Number(e.target.value))} className="rounded border px-3 py-2 w-full text-right" />
                  </div>
                  <div>
                    <label className="block mb-1 text-sm font-medium">Mode Pajak</label>
                    <select value={taxMode} onChange={(e)=>setTaxMode(e.target.value as TaxMode)} className="rounded border px-3 py-2 w-full">
                      <option value="none">Tanpa Pajak</option>
                      <option value="ppn_11_inclusive">PPN 11% INCLUSIVE</option>
                      <option value="ppn_11_exclusive">PPN 11% EXCLUSIVE</option>
                      <option value="ppn_12_inclusive">PPN 12% INCLUSIVE</option>
                      <option value="ppn_12_exclusive">PPN 12% EXCLUSIVE</option>
                    </select>
                  </div>
                  <div>
                    <label className="block mb-1 text-sm font-medium">Uang Muka</label>
                    <input type="number" value={downPayment} onChange={(e)=>setDownPayment(Number(e.target.value))} className="rounded border px-3 py-2 w-full text-right" />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block mb-1 font-medium">Syarat & Ketentuan</label>
                    <textarea value={terms} onChange={(e)=>setTerms(e.target.value)} className="border rounded w-full p-3 min-h-[100px] text-sm text-gray-600 placeholder-gray-400" />
                  </div>
                  <div>
                    <label className="block mb-1 font-medium">Keterangan</label>
                    <textarea value={notes} onChange={(e)=>setNotes(e.target.value)} className="border rounded w-full p-3 min-h-[80px] text-sm text-gray-600 placeholder-gray-400" />
                  </div>
                </div>
              </div>
              <div className="lg:col-span-1">
                <div className="rounded border p-4 bg-gray-50">
                  <div className="flex justify-between py-1 text-sm"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
                  <div className="flex justify-between py-1 text-sm"><span>Diskon per item</span><span>{fmt(totalLineDiscount)}</span></div>
                  <div className="flex justify-between py-1 text-sm"><span>Extra Discount</span><span>{fmt(extraDiscountAmount)}</span></div>
                  <div className="flex justify-between py-1 text-sm"><span>Biaya Kirim</span><span>{fmt(shippingCost || 0)}</span></div>
                  {taxMode !== 'none' && (<div className="flex justify-between py-1 text-sm"><span>Pajak {taxMode.replaceAll('_', ' ')}</span><span>{fmt(taxCalc.amount)}</span></div>)}
                  <div className="flex justify-between py-1 text-sm"><span>Uang Muka</span><span>{fmt(downPayment || 0)}</span></div>
                  <div className="mt-2 border-t pt-3 flex justify-between items-center font-semibold text-lg"><span>Total</span><span>{fmt(total)}</span></div>
                </div>
              </div>
            </div>

            {(downPayment <= 0) ? (
              <div className="mt-4 flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
                <button
                  className="border px-4 py-2 rounded hover:bg-gray-100"
                  onClick={handleBack}
                >
                  Kembali
                </button>
                <button
                  className="border px-4 py-2 rounded hover:bg-gray-100 disabled:opacity-60 disabled:cursor-not-allowed"
                  onClick={() => canPreview && setIsPreviewOpen(true)}
                  disabled={!canPreview}
                  title={!canPreview ? "Tambahkan minimal 1 produk untuk preview" : undefined}
                >
                  Preview
                </button>
                <button className="border px-4 py-2 rounded hover:bg-gray-100" onClick={()=>setProductLines([])}>Reset</button>
                <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed" onClick={handleSubmit} disabled={savingInvoice}>Invoice</button>
              </div>
            ) : (
              <div className="mt-4 text-right text-sm text-gray-600">Invoice pada tahap Pembayaran (DP) — pengeditan dinonaktifkan.</div>
            )}
          </>
        )}
      </div>
      {/* Preview Modal */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6">
          <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="text-lg font-semibold">Invoice Preview</h3>
              <button
                className="h-8 w-8 inline-flex items-center justify-center rounded-full hover:bg-gray-100"
                onClick={() => setIsPreviewOpen(false)}
                aria-label="Close preview"
              >
                ×
              </button>
            </div>
            <div className="max-h-[80vh] overflow-auto p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="text-sm text-gray-500">Invoice #</div>
                  <div className="font-medium">{invoiceNumber || '-'}</div>
                  <div className="mt-3 text-sm text-gray-500">Client (PIC)</div>
                  <div className="font-medium">{(customers.find(c=>c.id===customerId)?.pic) || '-'}</div>
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
                  <div className="flex justify-between py-1 text-sm"><span>Diskon per item</span><span>{fmt(totalLineDiscount)}</span></div>
                  <div className="flex justify-between py-1 text-sm"><span>Extra Discount</span><span>{fmt(extraDiscountAmount)}</span></div>
                  <div className="flex justify-between py-1 text-sm"><span>Biaya Kirim</span><span>{fmt(shippingCost || 0)}</span></div>
                  {taxMode !== 'none' && (
                    <div className="flex justify-between py-1 text-sm">
                      <span>Pajak {taxMode.replaceAll('_', ' ')}</span>
                      <span>{fmt(taxCalc.amount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-1 text-sm"><span>Uang Muka</span><span>{fmt(downPayment || 0)}</span></div>
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
  );
}

function QuotationDropdown({ value, quotations, onSelect, loading }: { value: number | null; quotations: QuotationSummary[]; onSelect: (q: QuotationSummary | null) => void; loading: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const portalRef = useRef<HTMLDivElement | null>(null);
  const [menuStyles, setMenuStyles] = useState<CSSProperties>({});
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
  useEffect(() => { if (open) setQuery(""); }, [open]);
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return quotations.slice(0, 80);
    return quotations.filter(q => q.quotationNumber.toLowerCase().includes(term) || q.customerName.toLowerCase().includes(term) || q.customerCompany.toLowerCase().includes(term)).slice(0,80);
  }, [quotations, query]);
  const handleSelect = (q: QuotationSummary) => { onSelect(q); setOpen(false); };
  return (
    <div ref={containerRef} className="relative w-full">
      <button type="button" onClick={() => setOpen(prev => !prev)} className="inline-flex w-full items-center justify-between rounded-lg border border-dashed border-gray-300 bg-white px-3 py-2 text-left text-sm text-gray-800 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-200">
        <span className="truncate">
          {selected ? (
            <>
              <span className="font-medium">{selected.quotationNumber} - {selected.customerName}</span>
              <span className="text-gray-500"> {`(${selected.customerCompany})`}</span>
            </>
          ) : (
            <span className="text-gray-500">{loading ? 'Memuat quotation...' : 'Hubungkan dengan quotation (opsional)'}</span>
          )}
        </span>
        <ChevronDown className="ml-2 h-4 w-4 opacity-70" />
      </button>
      {open && typeof document !== 'undefined' ? (
        ReactDOM.createPortal(
          <div ref={portalRef} style={menuStyles} className="max-w-[calc(100vw-3rem)] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl">
            <div className="border-b border-gray-200 p-2">
              <input autoFocus value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Cari nomor quotation atau nama customer..." className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>
            <div className="max-h-72 overflow-y-auto">
              {loading ? (
                <div className="px-4 py-3 text-sm text-gray-500">Memuat quotation...</div>
              ) : filtered.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-500">Quotation tidak ditemukan.</div>
              ) : (
                filtered.map(q => {
                  const active = q.id === selected?.id;
                  return (
                    <button key={q.id} type="button" onClick={() => handleSelect(q)} className={`block w-full px-4 py-3 text-left text-sm hover:bg-gray-50 ${active ? 'bg-blue-50' : ''}`}>
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-800">{q.quotationNumber}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] ${q.status === 'Confirmed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{q.status}</span>
                      </div>
                      <div className="mt-0.5 text-xs text-gray-500">{q.customerName} - {q.customerCompany}</div>
                      <div className="mt-0.5 text-[11px] text-gray-400">{q.date} - {fmt(Number(q.totalAmount) || 0)}</div>
                    </button>
                  );
                })
              )}
            </div>
            <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-3 py-2 text-xs">
              <button type="button" onClick={() => setOpen(false)} className="rounded px-2 py-1 text-gray-600 hover:text-gray-800">Tutup</button>
              <button type="button" onClick={() => { onSelect(null); setOpen(false); }} className="rounded px-2 py-1 font-medium text-blue-600 hover:text-blue-700">Lepaskan tautan</button>
            </div>
          </div>,
          document.body
        )
      ) : null}
    </div>
  );
}
