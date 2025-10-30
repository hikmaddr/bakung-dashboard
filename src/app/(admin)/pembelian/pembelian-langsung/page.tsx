"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type Purchase = {
  id: number;
  purchaseNumber: string;
  date: string;
  supplierName: string;
  status: string;
  items: { id: number; name: string; qty: number; unit: string }[];
};

export default function PembelianLangsungListPage() {
  const [data, setData] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [brandId, setBrandId] = useState<string>("");

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (brandId) params.set("brandId", brandId);
    const res = await fetch(`/api/purchases/direct${params.toString() ? `?${params.toString()}` : ""}`);
    const json = await res.json();
    setData(json.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Pembelian Langsung</h1>
        <Link href="/pembelian/pembelian-langsung/add" className="px-3 py-2 rounded bg-blue-600 text-white">Tambah</Link>
      </div>
      <div className="border rounded p-3 flex flex-wrap gap-2 items-end">
        <div>
          <label className="block text-xs text-gray-600">Cari</label>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Nomor/Supplier" className="border p-2 rounded" />
        </div>
        <div>
          <label className="block text-xs text-gray-600">Status</label>
          <select value={status} onChange={e=>setStatus(e.target.value)} className="border p-2 rounded">
            <option value="">Semua</option>
            <option value="Draft">Draft</option>
            <option value="Received">Received</option>
            <option value="Canceled">Canceled</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-600">Dari</label>
          <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} className="border p-2 rounded" />
        </div>
        <div>
          <label className="block text-xs text-gray-600">Sampai</label>
          <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} className="border p-2 rounded" />
        </div>
        <div>
          <label className="block text-xs text-gray-600">Brand ID</label>
          <input value={brandId} onChange={e=>setBrandId(e.target.value)} className="border p-2 rounded w-24" />
        </div>
        <div>
          <button onClick={load} className="px-3 py-2 rounded bg-gray-200">Terapkan</button>
        </div>
      </div>
      {loading ? (
        <div>Memuat...</div>
      ) : (
        <div className="border rounded overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-2 text-left">Nomor</th>
                <th className="p-2 text-left">Tanggal</th>
                <th className="p-2 text-left">Supplier</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-left">Item</th>
                <th className="p-2">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="p-2">{p.purchaseNumber}</td>
                  <td className="p-2">{new Date(p.date).toLocaleDateString()}</td>
                  <td className="p-2">{p.supplierName}</td>
                  <td className="p-2">{p.status}</td>
                  <td className="p-2">{p.items?.length || 0}</td>
                  <td className="p-2 text-center">
                    <Link href={`/pembelian/pembelian-langsung/${p.id}`} className="text-blue-600">Detail</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
