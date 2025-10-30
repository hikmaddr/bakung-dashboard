"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Pagination from "@/components/tables/Pagination";

type PaymentRow = {
  id: number;
  type: "IN" | "OUT";
  method: "CASH" | "BCA" | "BRI" | "OTHER";
  amount: number;
  paidAt: string;
  refType: "SALES_ORDER" | "INVOICE" | "PURCHASE" | "EXPENSE";
  refId: number;
  notes?: string | null;
  receipt?: { id: number; receiptNumber: string } | null;
};

export default function FinancePaymentPage() {
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [byMethod, setByMethod] = useState<{ method: string; type: string; amount: number }[]>([]);
  const [type, setType] = useState<"" | "IN" | "OUT">("");
  const [method, setMethod] = useState<"" | "CASH" | "BCA" | "BRI" | "OTHER">("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    type: "IN" as "IN" | "OUT",
    method: "CASH" as "CASH" | "BCA" | "BRI" | "OTHER",
    amount: "",
    paidAt: "",
    refType: "SALES_ORDER" as "SALES_ORDER" | "INVOICE" | "PURCHASE" | "EXPENSE",
    refId: "",
    notes: "",
  });

  // Prefill form dari query string (type, refType, refId)
  useEffect(() => {
    const t = (searchParams?.get("type") || "").toUpperCase();
    const rt = (searchParams?.get("refType") || "").toUpperCase();
    const rid = searchParams?.get("refId") || "";
    setForm((f) => ({
      ...f,
      type: (t === "IN" || t === "OUT") ? (t as any) : f.type,
      refType: (["SALES_ORDER","INVOICE","PURCHASE","EXPENSE"] as const).includes(rt as any) ? (rt as any) : f.refType,
      refId: rid || f.refId,
    }));
  }, [searchParams]);

  const fetchRows = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const qs = new URLSearchParams();
      qs.set("page", String(page));
      qs.set("pageSize", String(limit));
      if (type) qs.set("type", type);
      if (method) qs.set("method", method);
      const res = await fetch(`/api/payments?${qs.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || json?.success === false) throw new Error(json?.message || "Gagal memuat data");
      const data: PaymentRow[] = Array.isArray(json?.data) ? json.data : [];
      setRows(data);
      setTotal(Number(json?.total) || 0);
      const groups = Array.isArray(json?.byMethod) ? json.byMethod : [];
      const mapped = groups.map((g: any) => ({ method: g.method, type: g.type, amount: Number(g._sum?.amount) || 0 }));
      setByMethod(mapped);
    } catch (e: any) {
      setError(e?.message || "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, [page, limit, type, method]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const pages = useMemo(() => Math.ceil(total / limit) || 1, [total, limit]);
  const currency = (n: number) => (Number(n) || 0).toLocaleString("id-ID", { style: "currency", currency: "IDR" });
  const fmtDate = (s?: string) => (s ? new Date(s).toLocaleString("id-ID") : "-");
  const bankSummary = useMemo(() => {
    const methods = ["CASH","BCA","BRI","OTHER"] as const;
    return methods.map((m) => {
      const sumIn = byMethod.filter((x) => x.method === m && x.type === "IN").reduce((a, b) => a + b.amount, 0);
      const sumOut = byMethod.filter((x) => x.method === m && x.type === "OUT").reduce((a, b) => a + b.amount, 0);
      return { method: m, in: sumIn, out: sumOut, balance: sumIn - sumOut };
    });
  }, [byMethod]);

  const submitForm = async () => {
    try {
      const payload = {
        type: form.type,
        method: form.method,
        amount: Number(form.amount),
        paidAt: form.paidAt || undefined,
        refType: form.refType,
        refId: Number(form.refId),
        notes: form.notes || undefined,
      };
      const res = await fetch("/api/payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (!res.ok || json?.success === false) throw new Error(json?.message || "Gagal menyimpan pembayaran");
      setShowForm(false);
      setForm({ type: "IN", method: "CASH", amount: "", paidAt: "", refType: "SALES_ORDER", refId: "", notes: "" });
      fetchRows();
    } catch (e: any) {
      alert(e?.message || "Gagal menyimpan");
    }
  };

  return (
    <div className="space-y-4">
      <PageBreadcrumb pageTitle="Finance / Payment" />
      <div className="flex items-end gap-3">
        <div>
          <label className="block text-sm">Type</label>
          <select className="border rounded px-2 py-1" value={type} onChange={(e) => { setPage(1); setType(e.target.value as any); }}>
            <option value="">All</option>
            <option value="IN">IN</option>
            <option value="OUT">OUT</option>
          </select>
        </div>
        <div>
          <label className="block text-sm">Method</label>
          <select className="border rounded px-2 py-1" value={method} onChange={(e) => { setPage(1); setMethod(e.target.value as any); }}>
            <option value="">All</option>
            <option value="CASH">CASH</option>
            <option value="BCA">BCA</option>
            <option value="BRI">BRI</option>
            <option value="OTHER">OTHER</option>
          </select>
        </div>
        <div className="ml-auto">
          <button className="bg-blue-600 text-white px-3 py-2 rounded" onClick={() => setShowForm(true)}>Tambah Payment</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {bankSummary.map((b) => (
          <div key={b.method} className="bg-white rounded border p-3">
            <div className="text-sm text-gray-500">{b.method}</div>
            <div className="text-xs text-green-700">IN: {currency(b.in)}</div>
            <div className="text-xs text-red-700">OUT: {currency(b.out)}</div>
            <div className={`text-sm font-semibold ${b.balance >= 0 ? "text-green-700" : "text-red-700"}`}>Saldo: {currency(b.balance)}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded border overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2">Tanggal</th>
              <th className="text-left p-2">Type</th>
              <th className="text-left p-2">Method</th>
              <th className="text-right p-2">Amount</th>
              <th className="text-left p-2">Ref</th>
              <th className="text-left p-2">Receipt</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="p-3" colSpan={6}>Loading...</td></tr>
            ) : error ? (
              <tr><td className="p-3 text-red-600" colSpan={6}>{error}</td></tr>
            ) : rows.length === 0 ? (
              <tr><td className="p-3" colSpan={6}>Belum ada data</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{fmtDate(r.paidAt)}</td>
                  <td className="p-2">{r.type}</td>
                  <td className="p-2">{r.method}</td>
                  <td className="p-2 text-right">{currency(r.amount)}</td>
                  <td className="p-2">{r.refType} #{r.refId}</td>
                  <td className="p-2">{r.receipt ? <a className="text-blue-600 underline" href={`/api/receipts/${r.receipt.id}/pdf`} target="_blank" rel="noreferrer">{r.receipt.receiptNumber}</a> : '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">Total: {total}</div>
        <Pagination currentPage={page} itemsPerPage={limit} totalItems={total} onPageChange={setPage} onItemsPerPageChange={setLimit} />
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded p-4 w-full max-w-xl space-y-3">
            <div className="text-lg font-semibold">Tambah Payment</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm">Type</label>
                <select className="border rounded px-2 py-1 w-full" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as any }))}>
                  <option value="IN">IN</option>
                  <option value="OUT">OUT</option>
                </select>
              </div>
              <div>
                <label className="block text-sm">Method</label>
                <select className="border rounded px-2 py-1 w-full" value={form.method} onChange={(e) => setForm((f) => ({ ...f, method: e.target.value as any }))}>
                  <option value="CASH">CASH</option>
                  <option value="BCA">BCA</option>
                  <option value="BRI">BRI</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </div>
              <div>
                <label className="block text-sm">Jumlah</label>
                <input className="border rounded px-2 py-1 w-full" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="0" />
              </div>
              <div>
                <label className="block text-sm">Tanggal</label>
                <input type="datetime-local" className="border rounded px-2 py-1 w-full" value={form.paidAt} onChange={(e) => setForm((f) => ({ ...f, paidAt: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm">Ref Type</label>
                <select className="border rounded px-2 py-1 w-full" value={form.refType} onChange={(e) => setForm((f) => ({ ...f, refType: e.target.value as any }))}>
                  <option value="SALES_ORDER">SALES_ORDER</option>
                  <option value="INVOICE">INVOICE</option>
                  <option value="PURCHASE">PURCHASE</option>
                  <option value="EXPENSE">EXPENSE</option>
                </select>
              </div>
              <div>
                <label className="block text-sm">Ref ID</label>
                <input className="border rounded px-2 py-1 w-full" value={form.refId} onChange={(e) => setForm((f) => ({ ...f, refId: e.target.value }))} placeholder="ID dokumen" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm">Catatan</label>
                <textarea className="border rounded px-2 py-1 w-full" rows={3} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button className="px-3 py-2 rounded border" onClick={() => setShowForm(false)}>Batal</button>
              <button className="px-3 py-2 rounded bg-blue-600 text-white" onClick={submitForm}>Simpan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
