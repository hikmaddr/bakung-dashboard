"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Pagination from "@/components/tables/Pagination";

type ExpenseRow = {
  id: number;
  category: string;
  amount: number;
  payee?: string | null;
  paidAt: string;
  notes?: string | null;
  paymentId?: number | null;
  payment?: { id: number; receipt?: { id: number; receiptNumber: string } | null } | null;
};

export default function FinanceExpensePage() {
  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [category, setCategory] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ category: "", amount: "", payee: "", paidAt: "", notes: "", attachmentUrl: "" });

  const fetchRows = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const qs = new URLSearchParams();
      qs.set("page", String(page));
      qs.set("pageSize", String(limit));
      if (category) qs.set("category", category);
      const res = await fetch(`/api/expenses?${qs.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || json?.success === false) throw new Error(json?.message || "Gagal memuat data");
      const data: ExpenseRow[] = Array.isArray(json?.data) ? json.data : [];
      setRows(data);
      setTotal(Number(json?.total) || 0);
    } catch (e: any) {
      setError(e?.message || "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, [page, limit, category]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const pages = useMemo(() => Math.ceil(total / limit) || 1, [total, limit]);
  const currency = (n: number) => (Number(n) || 0).toLocaleString("id-ID", { style: "currency", currency: "IDR" });
  const fmtDate = (s?: string) => (s ? new Date(s).toLocaleString("id-ID") : "-");

  const submitForm = async () => {
    try {
      const payload = {
        category: form.category,
        amount: Number(form.amount),
        payee: form.payee || undefined,
        paidAt: form.paidAt || undefined,
        notes: form.notes || undefined,
        attachmentUrl: form.attachmentUrl || undefined,
      };
      const res = await fetch("/api/expenses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (!res.ok || json?.success === false) throw new Error(json?.message || "Gagal menyimpan expense");
      setShowForm(false);
      setForm({ category: "", amount: "", payee: "", paidAt: "", notes: "", attachmentUrl: "" });
      fetchRows();
    } catch (e: any) {
      alert(e?.message || "Gagal menyimpan");
    }
  };

  return (
    <div className="space-y-4">
      <PageBreadcrumb pageTitle="Finance / Expense" />
      <div className="flex items-end gap-3">
        <div>
          <label className="block text-sm">Kategori</label>
          <input className="border rounded px-2 py-1" value={category} onChange={(e) => { setPage(1); setCategory(e.target.value); }} placeholder="Filter kategori" />
        </div>
        <div className="ml-auto">
          <button className="bg-blue-600 text-white px-3 py-2 rounded" onClick={() => setShowForm(true)}>Tambah Expense</button>
        </div>
      </div>

      <div className="bg-white rounded border overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2">Tanggal</th>
              <th className="text-left p-2">Kategori</th>
              <th className="text-right p-2">Amount</th>
              <th className="text-left p-2">Payee</th>
              <th className="text-left p-2">Payment</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="p-3" colSpan={5}>Loading...</td></tr>
            ) : error ? (
              <tr><td className="p-3 text-red-600" colSpan={5}>{error}</td></tr>
            ) : rows.length === 0 ? (
              <tr><td className="p-3" colSpan={5}>Belum ada data</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{fmtDate(r.paidAt)}</td>
                  <td className="p-2">{r.category}</td>
                  <td className="p-2 text-right">{currency(r.amount)}</td>
                  <td className="p-2">{r.payee || '-'}</td>
                  <td className="p-2">
                    {r.payment?.receipt ? (
                      <a
                        className="text-blue-600 underline"
                        href={`/api/receipts/${r.payment.receipt.id}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {r.payment.receipt.receiptNumber || "Receipt"}
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
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
            <div className="text-lg font-semibold">Tambah Expense</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm">Kategori</label>
                <input className="border rounded px-2 py-1 w-full" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm">Jumlah</label>
                <input className="border rounded px-2 py-1 w-full" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="0" />
              </div>
              <div>
                <label className="block text-sm">Payee</label>
                <input className="border rounded px-2 py-1 w-full" value={form.payee} onChange={(e) => setForm((f) => ({ ...f, payee: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm">Tanggal</label>
                <input type="datetime-local" className="border rounded px-2 py-1 w-full" value={form.paidAt} onChange={(e) => setForm((f) => ({ ...f, paidAt: e.target.value }))} />
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
