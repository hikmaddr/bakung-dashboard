"use client";

import { useEffect, useMemo, useState } from "react";
import DatePicker from "@/components/DatePicker";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";


type ProductLine = {
  id: number;
  productId: number;
  name: string;
  description: string;
  qty: number;
  unit?: string;
};

type ProductOption = {
  id: number;
  name: string;
  sku?: string | null;
  unit?: string | null;
  description?: string | null;
};

type Supplier = {
  id: number;
  name: string;
  company: string;
};

export default function AddGoodsReceiptPage() {
  const router = useRouter();
  const [receiptNumber, setReceiptNumber] = useState("");
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().slice(0, 10));
  const [supplier, setSupplier] = useState("");
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [supplierCompany, setSupplierCompany] = useState<string>("");
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productsLoading, setProductsLoading] = useState<boolean>(true);
  const [productLines, setProductLines] = useState<ProductLine[]>([]);
  const [notes, setNotes] = useState("Barang telah diterima dengan baik.");
  const [savingReceipt, setSavingReceipt] = useState(false);
  const [suggestedNumber, setSuggestedNumber] = useState<string>("");

  const supplierDisplay = supplier && supplierCompany ? `${supplier} - ${supplierCompany}` : supplier || supplierCompany || '-';
  const canSave = productLines.length > 0 && supplierId;

  const productMap = useMemo(() => {
    const map = new Map<number, ProductOption>();
    for (const p of products) map.set(p.id, p);
    return map;
  }, [products]);

  const addProductLine = () => {
    setProductLines(prev => [
      ...prev,
      { id: Date.now(), productId: 0, name: "", description: "", qty: 1, unit: "pcs" },
    ]);
  };

  const updateProductLine = (id: number, field: keyof ProductLine, value: any) => {
    setProductLines(prev =>
      prev.map(line => (line.id === id ? { ...line, [field]: value } : line))
    );
  };

  const handleProductSelect = (id: number, productId: number) => {
    setProductLines(prev =>
      prev.map(line => {
        if (line.id !== id) return line;
        const normalizedId = Number.isFinite(productId) ? Number(productId) : 0;
        const next: ProductLine = { ...line, productId: normalizedId };
        if (normalizedId > 0) {
          const prod = productMap.get(normalizedId);
          if (prod) {
            next.name = prod.name;
            next.unit = prod.unit || line.unit || "pcs";
            if (!line.description?.trim() && prod.description) {
              next.description = prod.description;
            }
          }
        }
        return next;
      })
    );
  };

  const deleteProductLine = (id: number) => {
    setProductLines(prev => prev.filter(line => line.id !== id));
  };

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
          unit: p.unit ?? null,
          description: p.description ?? null,
        })));
      } catch {
        if (active) setProducts([]);
      } finally {
        if (active) setProductsLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const loadSuggestion = async () => {
      try {
        const res = await fetch(`/api/goods-receipts/next-number?date=${encodeURIComponent(receiptDate)}`, { cache: 'no-store' });
        const json = await res.json();
        setSuggestedNumber(json?.number || "");
      } catch { setSuggestedNumber(''); }
    };
    loadSuggestion();
  }, [receiptDate]);

  const handleSubmit = async () => {
    if (!supplierId) {
      toast.error("Pilih Supplier terlebih dahulu");
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
    setSavingReceipt(true);
    try {
      const payload = {
        receiptNumber,
        receiptDate,
        supplierId,
        items: productLines.map((l) => ({
          name: l.name.trim(),
          productId: l.productId,
          description: l.description,
          qty: l.qty,
          unit: l.unit || "pcs",
        })),
        notes,
      };
      const res = await fetch('/api/goods-receipts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        throw new Error(json?.message || 'Gagal menyimpan surat penerimaan');
      }
      toast.success("Surat Penerimaan Barang berhasil disimpan");
      router.push("/pembelian/surat-penerimaan-barang");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Terjadi kesalahan saat menyimpan");
    } finally {
      setSavingReceipt(false);
    }
  };

  const handleCancel = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/pembelian/surat-penerimaan-barang');
    }
  };

  return (
    <div className="sales-scope p-4 sm:p-6">

      <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6 shadow-sm">
        <h1 className="text-2xl font-semibold mb-6">Buat Surat Penerimaan Barang</h1>

        {/* Header Form */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6">
          <div className="md:col-span-2">
            <label className="block mb-1 font-medium">No. Surat Penerimaan *</label>
            <input
              type="text"
              value={suggestedNumber}
              readOnly
              className="border px-3 py-2 rounded w-full bg-gray-50 text-gray-600"
            />
            <p className="text-xs text-gray-500 mt-1">Nomor dibuat otomatis.</p>
          </div>
          <div>
            <label className="block mb-1 font-medium">Tgl. Penerimaan *</label>
            <DatePicker value={receiptDate} onChange={setReceiptDate} />
          </div>
          <div>
            <label className="block mb-1 font-medium">Supplier *</label>
            <SupplierPicker
              value={supplierId}
              onChange={(s) => {
                setSupplierId(s?.id ?? null);
                setSupplier(s?.name || '');
                setSupplierCompany(s?.company || '');
              }}
            />
          </div>
        </div>

        {/* Product Table */}
        <div className="rounded-2xl border border-gray-200 bg-white p-0 overflow-visible mb-6">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] xl:min-w-[900px] 2xl:min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="p-3 text-left w-16">S. No.</th>
                  <th className="p-3 text-left">Products</th>
                  <th className="p-3 text-left">Quantity</th>
                  <th className="p-3 text-center w-16">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {productLines.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-gray-500">Belum ada produk</td>
                  </tr>
                ) : (
                  productLines.map((line, idx) => (
                    <tr key={line.id} className="border-t hover:bg-gray-50">
                      <td className="p-3">{idx + 1}</td>
                      <td className="p-3">
                        <div className="space-y-1">
                          <select
                            value={line.productId || ""}
                            onChange={(e) => handleProductSelect(line.id, e.target.value ? Number(e.target.value) : 0)}
                            className="w-full rounded border px-2 py-1 text-sm"
                          >
                            <option value="">{productsLoading ? "Memuat produk..." : "Pilih produk"}</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}{p.sku ? ` (${p.sku})` : ""}
                              </option>
                            ))}
                          </select>
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
                            className="w-full rounded border px-2 py-1 text-xs text-gray-600"
                          />
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="inline-flex items-center rounded border w-full max-w-[160px]">
                            <button type="button" className="px-2 py-1" onClick={() => updateProductLine(line.id, "qty", Math.max(1, line.qty - 1))}>-</button>
                            <input
                              type="number"
                              value={line.qty}
                              onChange={(e) => updateProductLine(line.id, "qty", Math.max(1, Number(e.target.value)))}
                              className="w-12 sm:w-16 border-x px-2 py-1 text-center"
                            />
                            <button type="button" className="px-2 py-1" onClick={() => updateProductLine(line.id, "qty", line.qty + 1)}>+</button>
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
                      <td className="p-3 text-center">
                        <button type="button" onClick={() => deleteProductLine(line.id)} className="text-red-600 hover:underline">Hapus</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add Product */}
        <div className="rounded-2xl border border-gray-200 bg-white p-3 sm:p-4 mb-6">
          <h2 className="text-base font-medium mb-3">Tambah Produk</h2>
          <AddProductBar onAdd={(pl) => setProductLines((prev) => [...prev, pl])} />
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500">Isi data produk lalu tekan Enter atau klik "Save Product".</p>
          </div>
        </div>

        {/* Notes */}
        <div className="grid grid-cols-1 gap-4 mb-6">
          <div>
            <label className="block mb-1 font-medium">Keterangan</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="border rounded w-full p-3 min-h-[80px] text-sm text-gray-600 placeholder-gray-400"
            />
          </div>
        </div>

        {/* Summary */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 mb-6">
          <h2 className="text-lg font-medium mb-4">Ringkasan Surat Penerimaan</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-500">No. Surat Penerimaan</div>
              <div className="font-medium">{receiptNumber || suggestedNumber}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Supplier</div>
              <div className="font-medium">{supplierDisplay}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Tanggal</div>
              <div className="font-medium">{receiptDate}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Total Item</div>
              <div className="font-medium">{productLines.length} produk</div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={handleCancel} className="border px-3 py-1.5 rounded hover:bg-gray-100 text-sm">Cancel</button>
          <button className="bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-sm" onClick={handleSubmit} disabled={savingReceipt || !canSave}>
            {savingReceipt ? 'Menyimpan...' : 'Simpan Surat Penerimaan'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Supplier Picker
function SupplierPicker({ value, onChange }: { value: number | null; onChange: (supplier: Supplier | null) => void }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/suppliers', { cache: 'no-store' });
        const json = await res.json();
        const rows = Array.isArray(json) ? json : (Array.isArray(json?.data) ? json.data : []);
        setSuppliers(rows.map((s: any) => ({ id: Number(s.id), name: s.name || '', company: s.company || '' })));
      } catch {
        setSuppliers([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <select
      value={value || ""}
      onChange={(e) => {
        const id = Number(e.target.value);
        const selected = suppliers.find(s => s.id === id) || null;
        onChange(selected);
      }}
      className="border px-3 py-2 rounded w-full"
    >
      <option value="">{loading ? "Memuat supplier..." : "Pilih supplier"}</option>
      {suppliers.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name} - {s.company}
        </option>
      ))}
    </select>
  );
}

// Add Product Bar
function AddProductBar({ onAdd }: { onAdd: (line: ProductLine) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [qty, setQty] = useState<number>(1);
  const [unit, setUnit] = useState<string>("pcs");

  const resetFields = () => {
    setName("");
    setDescription("");
    setQty(1);
    setUnit("pcs");
  };

  const handleAdd = () => {
    if (!name.trim()) return;
    onAdd({ id: Date.now(), productId: 0, name: name.trim(), description, qty: Math.max(1, qty), unit });
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
      <div className="w-[110px]">
        <label className="block mb-0.5 text-[11px] font-medium">Quantity</label>
        <div className="inline-flex w-full items-center justify-between rounded border h-8">
          <button type="button" className="px-2 h-full" onClick={() => setQty((q) => Math.max(1, q - 1))}>-</button>
          <input
            type="number"
            value={qty}
            onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
            onKeyDown={onKeyDown}
            className="w-10 border-x px-1 h-full text-center text-xs"
          />
          <button type="button" className="px-2 h-full" onClick={() => setQty((q) => q + 1)}>+</button>
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
      <div className="w-full sm:w-auto">
        <button type="button" onClick={handleAdd} className="rounded bg-blue-600 px-3 h-8 text-xs text-white hover:bg-blue-700">Save Product</button>
      </div>
    </div>
  );
}
