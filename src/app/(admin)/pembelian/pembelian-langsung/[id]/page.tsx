"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Purchase = {
  id: number;
  purchaseNumber: string;
  date: string;
  supplierName: string;
  notes?: string;
  status: string;
  marketplaceOrderId?: string;
  proofUrl?: string|null;
  subtotal?: number;
  shippingCost?: number;
  fee?: number;
  tax?: number;
  total?: number;
  attachments?: { url: string; name?: string }[];
  items: { id: number; name: string; qty: number; unit: string; unitCost?: number; productId?: number|null }[];
};

export default function PembelianLangsungDetailPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  const router = useRouter();
  const [data, setData] = useState<Purchase|null>(null);
  const [loading, setLoading] = useState(true);
  const [receiving, setReceiving] = useState(false);
  const [payments, setPayments] = useState<any[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await fetch(`/api/purchases/direct/${id}`);
    const json = await res.json();
    setData(json.data || null);
    setLoading(false);
  };
  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      setLoadingPayments(true);
      try {
        const res = await fetch(`/api/payments?refType=PURCHASE&refId=${id}`, { cache: "no-store" });
        const json = await res.json();
        if (active) {
          if (res.ok && json?.success !== false) setPayments(Array.isArray(json?.data) ? json.data : []);
          else setPayments([]);
        }
      } catch {
        if (active) setPayments([]);
      } finally {
        if (active) setLoadingPayments(false);
      }
    };
    run();
    return () => { active = false; };
  }, [id]);

  const markReceived = async () => {
    if (!confirm("Tandai diterima? Stok akan bertambah.")) return;
    setReceiving(true);
    const res = await fetch(`/api/purchases/direct/${id}/receive`, { method: "POST" });
    const json = await res.json();
    setReceiving(false);
    if (json.success) {
      await load();
      alert("Berhasil ditandai diterima.");
    } else {
      alert(json.message || "Gagal");
    }
  };

  if (loading || !data) return <div className="p-4">Memuat...</div>;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{data.purchaseNumber}</h1>
        <div className="flex gap-2">
          <Link href="/pembelian/pembelian-langsung" className="px-3 py-2 rounded bg-gray-200">Kembali</Link>
          <Link href={`/pembelian/pembelian-langsung/${id}/edit`} className="px-3 py-2 rounded bg-yellow-500 text-white">Edit</Link>
          {data.status !== "Received" && (
            <button disabled={receiving} onClick={markReceived} className="px-3 py-2 rounded bg-green-600 text-white">Tandai Diterima</button>
          )}
          <Link href={`/finance/payment?type=OUT&refType=PURCHASE&refId=${id}`} className="px-3 py-2 rounded bg-blue-600 text-white">Tambah Pembayaran</Link>
        </div>
      </div>

      <div className="rounded border bg-white p-3">
        <div className="text-sm font-semibold mb-2">Pembayaran & Kwitansi</div>
        {loadingPayments ? (
          <div className="text-sm text-gray-500">Memuat...</div>
        ) : payments.length === 0 ? (
          <div className="text-sm text-gray-500">Belum ada pembayaran</div>
        ) : (
          <div className="space-y-1">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <div>
                  {new Date(p.paidAt).toLocaleString("id-ID")} • {p.method} • {p.type} • Rp{Number(p.amount).toLocaleString("id-ID")}
                </div>
                <div>
                  {p.receipt ? (
                    <a className="text-blue-600 underline" href={`/api/receipts/${p.receipt.id}/pdf`} target="_blank" rel="noreferrer">{p.receipt.receiptNumber}</a>
                  ) : (
                    <span className="text-gray-500">Tanpa kwitansi</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <div><span className="text-gray-500">Tanggal:</span> {new Date(data.date).toLocaleDateString()}</div>
          <div><span className="text-gray-500">Supplier:</span> {data.supplierName}</div>
          <div><span className="text-gray-500">Status:</span> {data.status}</div>
          {data.marketplaceOrderId && <div><span className="text-gray-500">Order Marketplace:</span> {data.marketplaceOrderId}</div>}
          {data.notes && <div><span className="text-gray-500">Catatan:</span> {data.notes}</div>}
        </div>
        <div>
          <div className="text-sm font-medium mb-2">Lampiran</div>
          <div className="flex flex-wrap gap-2">
            {(data.attachments as any[]|undefined)?.map((a, idx) => (
              <a key={idx} href={(a as any).url} target="_blank" className="px-3 py-2 border rounded text-blue-600">{(a as any).name || (a as any).url}</a>
            ))}
            {(!data.attachments || (data.attachments as any[]).length===0) && <div className="text-gray-500">Tidak ada lampiran</div>}
            {data.proofUrl && (
              <a href={data.proofUrl} target="_blank" className="px-3 py-2 border rounded text-green-700">Bukti</a>
            )}
          </div>
        </div>
      </div>

      <div className="border rounded p-3 w-full md:w-1/2">
        <div className="flex justify-between"><span>Subtotal</span><span>{Number(data.subtotal||0).toLocaleString()}</span></div>
        <div className="flex justify-between"><span>Ongkir</span><span>{Number(data.shippingCost||0).toLocaleString()}</span></div>
        <div className="flex justify-between"><span>Biaya/Fee</span><span>{Number(data.fee||0).toLocaleString()}</span></div>
        <div className="flex justify-between"><span>Pajak</span><span>{Number(data.tax||0).toLocaleString()}</span></div>
        <div className="flex justify-between font-semibold border-t mt-2 pt-2"><span>Total</span><span>{Number(data.total||0).toLocaleString()}</span></div>
      </div>

      <div className="border rounded overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 text-left">Nama</th>
              <th className="p-2 text-left">Qty</th>
              <th className="p-2 text-left">Unit</th>
              <th className="p-2 text-left">Harga Beli</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((it) => (
              <tr key={it.id} className="border-t">
                <td className="p-2">{it.name}</td>
                <td className="p-2">{it.qty}</td>
                <td className="p-2">{it.unit}</td>
                <td className="p-2">{it.unitCost ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
