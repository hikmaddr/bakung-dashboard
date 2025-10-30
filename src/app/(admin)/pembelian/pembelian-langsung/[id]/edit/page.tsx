"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Item = { id?: number; productId?: number; name: string; qty: number; unit?: string; unitCost?: number };

export default function PembelianLangsungEditPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  const router = useRouter();
  const [purchaseNumber, setPurchaseNumber] = useState("");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [supplierName, setSupplierName] = useState("");
  const [marketplaceOrderId, setMarketplaceOrderId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [shippingCost, setShippingCost] = useState<number>(0);
  const [fee, setFee] = useState<number>(0);
  const [tax, setTax] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const subtotal = items.reduce((s, it) => s + Number(it.qty||0) * Number(it.unitCost||0), 0);
  const total = subtotal + Number(shippingCost||0) + Number(fee||0) + Number(tax||0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await fetch(`/api/purchases/direct/${id}`);
      const json = await res.json();
      const d = json.data;
      if (d) {
        setPurchaseNumber(d.purchaseNumber || "");
        setDate(new Date(d.date).toISOString().slice(0,10));
        setSupplierName(d.supplierName || "");
        setMarketplaceOrderId(d.marketplaceOrderId || "");
        setNotes(d.notes || "");
        setItems((d.items||[]).map((x:any)=>({ id:x.id, name:x.name, qty:x.qty, unit:x.unit, unitCost:x.unitCost })));
        setShippingCost(d.shippingCost || 0);
        setFee(d.fee || 0);
        setTax(d.tax || 0);
      }
      setLoading(false);
    })();
  }, [id]);

  const addRow = () => setItems((s) => [...s, { name: "", qty: 1, unit: "pcs" }]);
  const delRow = (idx: number) => setItems((s) => s.filter((_, i) => i !== idx));

  const save = async () => {
    setSaving(true);
    try {
      const fd = new FormData();
      fd.set("purchaseNumber", purchaseNumber);
      fd.set("date", new Date(date).toISOString());
      fd.set("supplierName", supplierName);
      if (marketplaceOrderId) fd.set("marketplaceOrderId", marketplaceOrderId);
      if (notes) fd.set("notes", notes);
      fd.set("shippingCost", String(Number(shippingCost||0)));
      fd.set("fee", String(Number(fee||0)));
      fd.set("tax", String(Number(tax||0)));
      fd.set("items", JSON.stringify(items.map(i => ({...i, id: undefined, qty: Number(i.qty||0), unitCost: Number(i.unitCost||0)}))));
      const files = fileRef.current?.files;
      if (files && files.length) {
        for (let i=0;i<files.length;i++) fd.append("attachments", files[i]);
      }
      const res = await fetch(`/api/purchases/direct/${id}`, { method: "PUT", body: fd });
      const json = await res.json();
      if (json.success) {
        router.push(`/pembelian/pembelian-langsung/${id}`);
      } else {
        alert(json.message || "Gagal simpan");
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-4">Memuat...</div>;

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Edit Pembelian Langsung</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm">Nomor</label>
          <input value={purchaseNumber} onChange={(e)=>setPurchaseNumber(e.target.value)} className="border p-2 rounded w-full"/>
        </div>
        <div>
          <label className="block text-sm">Tanggal</label>
          <input type="date" value={date} onChange={(e)=>setDate(e.target.value)} className="border p-2 rounded w-full"/>
        </div>
        <div>
          <label className="block text-sm">Supplier (Marketplace)</label>
          <input value={supplierName} onChange={(e)=>setSupplierName(e.target.value)} className="border p-2 rounded w-full"/>
        </div>
        <div>
          <label className="block text-sm">Nomor Order Marketplace (opsional)</label>
          <input value={marketplaceOrderId} onChange={(e)=>setMarketplaceOrderId(e.target.value)} className="border p-2 rounded w-full"/>
        </div>
        <div>
          <label className="block text-sm">Catatan</label>
          <input value={notes} onChange={(e)=>setNotes(e.target.value)} className="border p-2 rounded w-full"/>
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm">Lampiran baru (opsional, akan menimpa)</label>
          <input ref={fileRef} type="file" multiple className="border p-2 rounded w-full" />
        </div>
        <div>
          <label className="block text-sm">Ongkir</label>
          <input type="number" value={shippingCost} onChange={(e)=>setShippingCost(Number(e.target.value))} className="border p-2 rounded w-full"/>
        </div>
        <div>
          <label className="block text-sm">Biaya/Fee</label>
          <input type="number" value={fee} onChange={(e)=>setFee(Number(e.target.value))} className="border p-2 rounded w-full"/>
        </div>
        <div>
          <label className="block text-sm">Pajak</label>
          <input type="number" value={tax} onChange={(e)=>setTax(Number(e.target.value))} className="border p-2 rounded w-full"/>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Item</h2>
          <button onClick={addRow} className="px-3 py-1 rounded bg-gray-200">Tambah Baris</button>
        </div>
        <div className="border rounded overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-2 text-left">Nama</th>
                <th className="p-2 text-left">Qty</th>
                <th className="p-2 text-left">Unit</th>
                <th className="p-2 text-left">Harga Beli</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={idx} className="border-t">
                  <td className="p-2"><input value={it.name} onChange={e=>setItems(arr=>arr.map((x,i)=>i===idx?{...x,name:e.target.value}:x))} className="border p-1 rounded w-full"/></td>
                  <td className="p-2"><input type="number" value={it.qty} onChange={e=>setItems(arr=>arr.map((x,i)=>i===idx?{...x,qty:Number(e.target.value)}:x))} className="border p-1 rounded w-24"/></td>
                  <td className="p-2"><input value={it.unit||"pcs"} onChange={e=>setItems(arr=>arr.map((x,i)=>i===idx?{...x,unit:e.target.value}:x))} className="border p-1 rounded w-24"/></td>
                  <td className="p-2"><input type="number" value={it.unitCost||0} onChange={e=>setItems(arr=>arr.map((x,i)=>i===idx?{...x,unitCost:Number(e.target.value)}:x))} className="border p-1 rounded w-32"/></td>
                  <td className="p-2 text-center"><button onClick={()=>delRow(idx)} className="text-red-600">Hapus</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="border rounded p-3 w-full md:w-1/2">
        <div className="flex justify-between"><span>Subtotal</span><span>{subtotal.toLocaleString()}</span></div>
        <div className="flex justify-between"><span>Ongkir</span><span>{Number(shippingCost||0).toLocaleString()}</span></div>
        <div className="flex justify-between"><span>Biaya/Fee</span><span>{Number(fee||0).toLocaleString()}</span></div>
        <div className="flex justify-between"><span>Pajak</span><span>{Number(tax||0).toLocaleString()}</span></div>
        <div className="flex justify-between font-semibold border-t mt-2 pt-2"><span>Total</span><span>{total.toLocaleString()}</span></div>
      </div>

      <div className="flex gap-2">
        <button disabled={saving} onClick={save} className="px-4 py-2 rounded bg-blue-600 text-white">Simpan</button>
        <button onClick={()=>router.back()} className="px-4 py-2 rounded bg-gray-200">Batal</button>
      </div>
    </div>
  );
}

