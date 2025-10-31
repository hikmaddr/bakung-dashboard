"use client";

import { useEffect, useState } from "react";
import DatePicker from "@/components/DatePicker";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

import { fmtIDR } from "@/lib/format";

type Supplier = {
  id: number;
  name: string;
  company: string;
};

export default function AddPurchaseReceiptPage() {
  const router = useRouter();
  const [receiptNumber, setReceiptNumber] = useState("");
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().slice(0, 10));
  const [supplier, setSupplier] = useState("");
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [supplierCompany, setSupplierCompany] = useState<string>("");
  const [amount, setAmount] = useState<number>(0);
  const [notes, setNotes] = useState("Pembayaran telah diterima dengan baik.");
  const [savingReceipt, setSavingReceipt] = useState(false);
  const [suggestedNumber, setSuggestedNumber] = useState<string>("");
  const fmt = (n: number) => fmtIDR(n);

  const supplierDisplay = supplier && supplierCompany ? `${supplier} - ${supplierCompany}` : supplier || supplierCompany || '-';

  useEffect(() => {
    const loadSuggestion = async () => {
      try {
        const res = await fetch(`/api/receipts/next-number?date=${encodeURIComponent(receiptDate)}`, { cache: 'no-store' });
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
    if (amount <= 0) {
      toast.error("Masukkan jumlah pembayaran");
      return;
    }
    setSavingReceipt(true);
    try {
      const payload = {
        receiptNumber,
        receiptDate,
        supplierId,
        amount,
        notes,
      };
      const res = await fetch('/api/receipts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        throw new Error(json?.message || 'Gagal menyimpan kwitansi');
      }
      toast.success("Kwitansi berhasil disimpan");
      router.push("/pembelian/kwitansi-pembelian");
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
      router.push('/pembelian/kwitansi-pembelian');
    }
  };

  return (
    <div className="sales-scope p-4 sm:p-6">

      <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6 shadow-sm">
        <h1 className="text-2xl font-semibold mb-6">Buat Kwitansi Pembelian</h1>

        {/* Header Form */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6">
          <div className="md:col-span-2">
            <label className="block mb-1 font-medium">No. Kwitansi *</label>
            <input
              type="text"
              value={suggestedNumber}
              readOnly
              className="border px-3 py-2 rounded w-full bg-gray-50 text-gray-600"
            />
            <p className="text-xs text-gray-500 mt-1">Nomor dibuat otomatis.</p>
          </div>
          <div>
            <label className="block mb-1 font-medium">Tgl. Kwitansi *</label>
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
          <div className="md:col-span-2">
            <label className="block mb-1 font-medium">Jumlah Pembayaran *</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
              className="border px-3 py-2 rounded w-full"
              placeholder="Masukkan jumlah"
            />
          </div>
          <div className="md:col-span-2">
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
          <h2 className="text-lg font-medium mb-4">Ringkasan Kwitansi</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-500">No. Kwitansi</div>
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
              <div className="text-sm text-gray-500">Jumlah</div>
              <div className="font-medium text-lg">{fmt(amount)}</div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={handleCancel} className="border px-3 py-1.5 rounded hover:bg-gray-100 text-sm">Cancel</button>
          <button className="bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-sm" onClick={handleSubmit} disabled={savingReceipt}>
            {savingReceipt ? 'Menyimpan...' : 'Simpan Kwitansi'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Supplier Picker (similar to CustomerPicker)
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
