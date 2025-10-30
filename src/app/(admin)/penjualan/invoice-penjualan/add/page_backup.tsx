"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";

type ProductLine = {
  id: number;
  name: string;
  description: string;
  qty: number;
  unit?: string;
  price: number;
  discount: number; // value
  discountType: "percent" | "amount"; // how to interpret discount
  tax: number; // reserved (unused per-line)
};

type TaxMode =
  | "none"
  | "non_pkp"
  | "ppn_11_inclusive"
  | "ppn_11_exclusive"
  | "ppn_12_inclusive"
  | "ppn_12_exclusive";

export default function AddSalesInvoicePage() {
  const router = useRouter();
  const [invoiceNumber, setInvoiceNumber] = useState("INV/2025/0002");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(""); // default disamakan setelah mount
  const [client, setClient] = useState("");
  const [customerId, setCustomerId] = useState<number | null>(null);
  // Hapus dropdown jenis usaha; gunakan perusahaan client dari database
  const [productLines, setProductLines] = useState<ProductLine[]>([]);
  const [notes, setNotes] = useState("Mohon Melakukan Pembayaran Ke Nomor Rekening: BCA #1391627849");
  const [terms, setTerms] = useState(
    "Pembayaran dilakukan sesuai termin yang disepakati. Barang/jasa yang telah diterima tidak dapat dikembalikan kecuali ada perjanjian tertulis."
  );

  // Tambahan komponen perhitungan
  const [extraDiscountType, setExtraDiscountType] = useState<"amount" | "percent">("amount");
  const [extraDiscountValue, setExtraDiscountValue] = useState<number>(0);
  const [shippingCost, setShippingCost] = useState<number>(0);
  const [taxMode, setTaxMode] = useState<TaxMode>("none");
  const [downPayment, setDownPayment] = useState<number>(0);
  const [resetTick, setResetTick] = useState<number>(0);
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
  const fmt = (n: number) => n.toLocaleString("id-ID", { style: "currency", currency: "IDR" });
  const canPreview = productLines.length > 0;

  const addProductLine = () => {
    setProductLines(prev => [
      ...prev,
      { id: Date.now(), name: "", description: "", qty: 1, unit: "pcs", price: 0, discount: 0, discountType: "percent", tax: 0 },
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
        // set client and lines
        setClient(data.customer?.company || "");
        if (Array.isArray(data.items) && data.items.length) {
          setProductLines(
            data.items.map((it: any, idx: number) => ({
              id: Date.now() + idx,
              name: it.name || "",
              description: it.description || "",
              qty: Number(it.qty) || 1,
              price: Number(it.price) || 0,
              discount: Number(it.discount) || 0,
              discountType: (it.discountType as any) === "amount" || (it.discountType as any) === "percent" ? it.discountType : "percent",
              tax: Number(it.tax) || 0,
            }))
          );
        }
        // Optional: set notes referencing SO
        setNotes((prev) => prev || `Referensi Sales Order: ${data.orderNumber || data.orderId || "-"}`);
      }
    } catch {}
    finally {
      localStorage.removeItem("newInvoiceFromSO");
    }
  }, []);

  const [savingInvoice, setSavingInvoice] = useState(false);
  const handleSubmit = async () => {
    if (!customerId) { toast.error("Pilih Client terlebih dahulu"); return; }
    if (productLines.length === 0) { toast.error("Tambahkan minimal 1 produk"); return; }
    setSavingInvoice(true);
    try {
      const payload = {
        invoiceNumber,
        invoiceDate,
        dueDate,
        customerId,
        items: productLines.map((l) => ({
          name: l.name,
          description: l.description,
          qty: l.qty,
          unit: l.unit || "pcs",
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
      const res = await fetch('/api/invoices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (!res.ok || json?.success === false) throw new Error(json?.message || 'Gagal menyimpan invoice');
      toast.success("Invoice berhasil disimpan");
      router.push("/penjualan/invoice-penjualan");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Terjadi kesalahan saat menyimpan");
    } finally { setSavingInvoice(false); }
  };

  const handleReset = () => {
    setProductLines([]);
    setExtraDiscountType("amount");
    setExtraDiscountValue(0);
    setShippingCost(0);
    setTaxMode("none");
    setDownPayment(0);
    setResetTick((v) => v + 1);
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6 shadow-sm">
        <h1 className="text-2xl font-semibold mb-6">Buat Invoice Penjualan</h1>

        {/* Header Form */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6">
          <div className="md:col-span-2">
            <label className="block mb-1 font-medium">No. Invoice *</label>
            <input
              type="text"
              value={invoiceNumber}
              readOnly
              className="border px-3 py-2 rounded w-full bg-gray-50 text-gray-600"
            />
            <p className="text-xs text-gray-500 mt-1">Nomor dibuat otomatis.</p>
          </div>
          <div>
            <label className="block mb-1 font-medium">Tgl. Invoice *</label>
            <input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="border px-3 py-2 rounded w-full"
            />
          </div>
          <div>
            <label className="block mb-1 font-medium">Tgl. Jatuh Tempo *</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="border px-3 py-2 rounded w-full"
            />
          </div>
          <ClientCompanyPicker client={client} setClient={setClient} setCustomerId={setCustomerId} />
        </div>

        {/* Product Table - styled like template */}
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
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-500">Belum ada produk</td>
                  </tr>
                ) : (
                  productLines.map((line, idx) => {
                    const base = line.qty * line.price;
                    const dAmt = line.discountType === "amount"
                      ? Math.max(0, Math.min(base, Number(line.discount) || 0))
                      : Math.round((base * Math.max(0, Math.min(100, Number(line.discount) || 0))) / 100);
                    const totalLine = base - dAmt;
                    return (
                      <tr key={line.id} className="border-t hover:bg-gray-50">
                        <td className="p-3">{idx + 1}</td>
                        <td className="p-3">
                          <input
                            type="text"
                            value={line.name}
                            onChange={(e) => updateProductLine(line.id, "name", e.target.value)}
                            placeholder="Nama produk"
                            className="w-full rounded border px-2 py-1 text-sm"
                          />
                          <input
                            type="text"
                            value={line.description}
                            onChange={(e) => updateProductLine(line.id, "description", e.target.value)}
                            placeholder="Deskripsi (opsional)"
                            className="mt-1 w-full rounded border px-2 py-1 text-xs text-gray-600"
                          />
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="inline-flex items-center rounded border w-full max-w-[160px]">
                              <button type="button" className="px-2 py-1" onClick={() => updateProductLine(line.id, "qty", Math.max(1, line.qty - 1))}>−</button>
                              <input
                                type="number"
                                value={line.qty}
                                onChange={(e) => updateProductLine(line.id, "qty", Math.max(1, Number(e.target.value)))}
                              className="w-12 sm:w-16 border-x px-2 py-1 text-center"
                              />
                              <button type="button" className="px-2 py-1" onClick={() => updateProductLine(line.id, "qty", line.qty + 1)}>＋</button>
                            </div>
                            <select
                              value={line.unit || 'pcs'}
                              onChange={(e) => updateProductLine(line.id, 'unit', e.target.value)}
                              className="rounded border px-2 py-1 text-sm w-[80px]"
                            >
                              <option value="pcs">pcs</option>
                              <option value="unit">unit</option>
                              <option value="set">set</option>
                              <option value="box">box</option>
                              <option value="pack">pack</option>
                              <option value="lusin">lusin</option>
                              <option value="kodi">kodi</option>
                              <option value="kg">kg</option>
                              <option value="gram">gram</option>
                              <option value="liter">liter</option>
                              <option value="ml">ml</option>
                              <option value="meter">meter</option>
                              <option value="cm">cm</option>
                              <option value="roll">roll</option>
                            </select>
                          </div>
                        </td>
                        <td className="p-3">
                          <input
                            type="number"
                            value={line.price}
                            onChange={(e) => updateProductLine(line.id, "price", Math.max(0, Number(e.target.value)))}
                            className="w-full sm:w-28 rounded border px-2 py-1 text-right"
                          />
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <select
                              value={line.discountType}
                              onChange={(e) => updateProductLine(line.id, "discountType", e.target.value as any)}
                              className="rounded border px-2 py-1 text-sm"
                            >
                              <option value="amount">Rp</option>
                              <option value="percent">%</option>
                            </select>
                            <input
                              type="number"
                              value={line.discount}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                if (line.discountType === "percent")
                                  updateProductLine(line.id, "discount", Math.max(0, Math.min(100, val)));
                                else
                                  updateProductLine(line.id, "discount", Math.max(0, val));
                              }}
                              className="w-full sm:w-28 rounded border px-2 py-1 text-right"
                            />
                          </div>
                        </td>
                        <td className="p-3 text-right">
                          {totalLine.toLocaleString("id-ID", { style: "currency", currency: "IDR" })}
                        </td>
                        <td className="p-3 text-center">
                          <button type="button" onClick={() => deleteProductLine(line.id)} className="text-red-600 hover:underline">Hapus</button>
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

        {/* Add Product - separate card (placed below list) */}
        <div className="rounded-2xl border border-gray-200 bg-white p-3 sm:p-4 mb-6">
          <h2 className="text-base font-medium mb-3">Tambah Produk</h2>
          <AddProductBar key={resetTick} onAdd={(pl) => setProductLines((prev) => [...prev, pl])} />
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500">Isi data produk lalu tekan Enter atau klik "Save Product".</p>
          </div>
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

            {/* Notes */}
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block mb-1 font-medium">Syarat & Ketentuan</label>
                <textarea
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  className="border rounded w-full p-3 min-h-[100px] text-sm text-gray-600 placeholder-gray-400"
                />
              </div>
              <div>
                <label className="block mb-1 font-medium">Keterangan</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="border rounded w-full p-3 min-h-[80px] text-sm text-gray-600 placeholder-gray-400"
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-1 lg:col-start-3">
            <div className="rounded border p-4 bg-gray-50">
              <div className="flex justify-between py-1 text-sm">
                <span>Subtotal</span>
                <span>{subtotal.toLocaleString("id-ID", { style: "currency", currency: "IDR" })}</span>
              </div>
              <div className="flex justify-between py-1 text-sm">
                <span>Total Diskon</span>
                <span>{totalLineDiscount.toLocaleString("id-ID", { style: "currency", currency: "IDR" })}</span>
              </div>
              <div className="flex justify-between py-1 text-sm">
                <span>Diskon Tambahan ({extraDiscountType === "percent" ? `${Math.max(0, Math.min(100, extraDiscountValue))}%` : "Rp"})</span>
                <span>{extraDiscountAmount.toLocaleString("id-ID", { style: "currency", currency: "IDR" })}</span>
              </div>
              <div className="flex justify-between py-1 text-sm">
                <span>Biaya Kirim</span>
                <span>{(shippingCost || 0).toLocaleString("id-ID", { style: "currency", currency: "IDR" })}</span>
              </div>
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

            <div className="mt-4 flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
              <button
                className="border px-4 py-2 rounded hover:bg-gray-100 disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={() => canPreview && setIsPreviewOpen(true)}
                disabled={!canPreview}
                title={!canPreview ? "Tambahkan minimal 1 produk untuk preview" : undefined}
              >
                Preview Invoice
              </button>
              <button type="button" onClick={handleReset} className="border px-4 py-2 rounded hover:bg-gray-100">Reset</button>
              <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed" onClick={handleSubmit} disabled={savingInvoice}>
                Simpan Invoice
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* Preview Modal */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6">
          <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="text-lg font-semibold">Invoice Preview</h3>
              <button className="h-8 w-8 inline-flex items-center justify-center rounded-full hover:bg-gray-100" onClick={() => setIsPreviewOpen(false)}>✕</button>
            </div>
            <div className="max-h-[80vh] overflow-auto p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="text-sm text-gray-500">Invoice #</div>
                  <div className="font-medium">{invoiceNumber}</div>
                  <div className="mt-3 text-sm text-gray-500">Client (PIC)</div>
                  <div className="font-medium">{client || '-'}</div>
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
                              <td className="p-3">{line.qty} {line.unit || 'pcs'}</td>
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
                      <span>{fmt(taxAmount)}</span>
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

// Picker perusahaan client terhubung database
function ClientCompanyPicker({ client, setClient, setCustomerId }: { client: string; setClient: (v: string) => void; setCustomerId?: (id: number | null) => void }) {
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

  return (
    <>
    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between gap-2">
              <label className="block mb-1 font-medium">Pilih Client (PIC) *</label>
              <button type="button" onClick={() => setOpenAdd(true)} className="h-7 rounded bg-green-600 px-2 text-white text-xs hover:bg-green-700 whitespace-nowrap">+ Tambahkan Client</button>
            </div>
            <select
              value={selectedId}
              onChange={(e) => {
                const valRaw = e.target.value ? Number(e.target.value) : '';
                setSelectedId(valRaw as any);
                const val = typeof valRaw === 'number' ? valRaw : NaN;
                const chosen = customers.find(c => c.id === val);
                setClient(chosen?.pic || '');
                setCompany(chosen?.company || '');
                setCustomerId && setCustomerId(chosen ? chosen.id : null);
              }}
              className="border px-3 py-2 rounded w-full"
            >
              <option value="">Pilih client (PIC)...</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.pic || '(Tanpa PIC)'}</option>
              ))}
            </select>
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
function AddProductBar({ onAdd }: { onAdd: (line: ProductLine) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState<number>(0);
  const [qty, setQty] = useState<number>(1);
  const [discount, setDiscount] = useState<number>(0);
  const [unit, setUnit] = useState<string>("pcs");
  const [discountType, setDiscountType] = useState<"percent" | "amount">("percent");

  const resetFields = () => {
    setName("");
    setDescription("");
    setPrice(0);
    setQty(1);
    setDiscount(0);
    setDiscountType("percent");
    setUnit("pcs");
  };

  const handleAdd = () => {
    if (!name.trim()) return;
    onAdd({ id: Date.now(), name, description, qty: Math.max(1, qty), unit, price: Math.max(0, price), discount: Math.max(0, discountType === "percent" ? Math.min(100, discount) : discount), discountType, tax: 0 });
    resetFields();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="flex flex-wrap items-end gap-1.5">
      <div className="w-full sm:w-auto">
        <label className="block mb-0.5 text-[11px] font-medium">Product Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Enter product name"
          className="rounded border px-2 h-8 text-xs w-[160px] md:w-[200px]"
        />
      </div>
      <div className="w-full sm:w-auto">
        <label className="block mb-0.5 text-[11px] font-medium">Description</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Optional description"
          className="rounded border px-2 h-8 text-xs w-[200px] md:w-[240px]"
        />
      </div>
      <div className="w-[100px]">
        <label className="block mb-0.5 text-[11px] font-medium">Price</label>
        <input
          type="number"
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
          onKeyDown={onKeyDown}
          className="rounded border px-2 h-8 text-right text-xs w-full"
        />
      </div>
      <div className="w-[110px]">
        <label className="block mb-0.5 text-[11px] font-medium">Quantity</label>
        <div className="inline-flex w-full items-center justify-between rounded border h-8">
          <button type="button" className="px-2 h-full" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
          <input
            type="number"
            value={qty}
            onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
            onKeyDown={onKeyDown}
            className="w-10 border-x px-1 h-full text-center text-xs"
          />
          <button type="button" className="px-2 h-full" onClick={() => setQty((q) => q + 1)}>＋</button>
        </div>
      </div>
      <div className="w-[90px]">
        <label className="block mb-0.5 text-[11px] font-medium">Unit</label>
        <select value={unit} onChange={(e)=>setUnit(e.target.value)} className="rounded border px-2 h-8 text-xs w-full">
          <option value="pcs">pcs</option>
          <option value="unit">unit</option>
          <option value="set">set</option>
          <option value="box">box</option>
          <option value="pack">pack</option>
          <option value="lusin">lusin</option>
          <option value="kodi">kodi</option>
          <option value="kg">kg</option>
          <option value="gram">gram</option>
          <option value="liter">liter</option>
          <option value="ml">ml</option>
          <option value="meter">meter</option>
          <option value="cm">cm</option>
          <option value="roll">roll</option>
        </select>
      </div>

      {/* Discount + Save right after qty */}
      <div className="w-full sm:w-auto flex items-end gap-1.5">
        <div>
          <label className="block mb-0.5 text-[11px] font-medium">Discount</label>
          <div className="flex items-center gap-1.5">
            <select value={discountType} onChange={(e) => setDiscountType(e.target.value as any)} className="rounded border px-2 h-8 text-xs w-[52px]">
              <option value="amount">Rp</option>
              <option value="percent">%</option>
            </select>
            <input
              type="number"
              value={discount}
              onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))}
              onKeyDown={onKeyDown}
              className="rounded border px-2 h-8 text-right text-xs w-[72px]"
            />
          </div>
        </div>
        <button type="button" onClick={handleAdd} className="rounded bg-blue-600 px-3 h-8 text-xs text-white hover:bg-blue-700">Save Product</button>
      </div>
    </div>
  );
}
