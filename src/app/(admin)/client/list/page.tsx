"use client";

import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { Modal } from "@/components/ui/modal";
import { toast } from "react-hot-toast";
import { useEffect, useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import Pagination from "@/components/tables/Pagination";

type Customer = {
  id: number;
  pic: string;
  email: string | null;
  company: string;
  address: string;
  phone: string;
};

export default function ClientListPageWithTemplate() {
  const [clients, setClients] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(5);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState({ pic: "", email: "", company: "", address: "", phone: "" });
  const [errors, setErrors] = useState<string[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const res = await fetch("/api/customers");
      if (res.ok) {
        const data = await res.json();
        setClients(data);
      } else {
        console.error("Gagal ambil data client");
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const filteredClients = useMemo(() => {
    return clients.filter(
      (client) =>
        client.pic.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (client.email?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
        client.phone.includes(searchTerm) ||
        client.address.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [clients, searchTerm]);

  const totalPages = Math.ceil(filteredClients.length / limit);
  const paginatedClients = filteredClients.slice((currentPage - 1) * limit, currentPage * limit);

  const handleDelete = async (id: number) => {
    setConfirmDeleteId(id);
  };

  const confirmDelete = async () => {
    if (confirmDeleteId == null) return;
    try {
      const res = await fetch(`/api/customers/${confirmDeleteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setClients((prev) => prev.filter((c) => c.id !== confirmDeleteId));
      toast.success("Client berhasil dihapus");
    } catch (e) {
      toast.error("Gagal menghapus client");
    } finally {
      setConfirmDeleteId(null);
    }
  };

  const openAdd = () => {
    setForm({ pic: "", email: "", company: "", address: "", phone: "" });
    setIsAddOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({ pic: c.pic ?? "", email: c.email ?? "", company: c.company ?? "", address: c.address ?? "", phone: c.phone ?? "" });
    setIsEditOpen(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // Normalisasi nomor HP menjadi format Indonesia: harus diawali 62
  const normalizePhone = (raw: string) => {
    let digits = (raw || "").replace(/\D/g, "");
    if (digits.startsWith("620")) {
      digits = "62" + digits.slice(3);
    }
    if (digits.startsWith("0")) {
      digits = "62" + digits.slice(1);
    }
    if (!digits.startsWith("62")) {
      digits = "62" + digits;
    }
    return digits;
  };

  // Validasi: semua field wajib, phone 10-15 digit setelah dinormalisasi
  const validateForm = () => {
    const msgs: string[] = [];
    if (!form.pic.trim()) msgs.push("PIC wajib diisi.");
    if (!form.company.trim()) msgs.push("Perusahaan wajib diisi.");
    if (!form.address.trim()) msgs.push("Alamat wajib diisi.");
    if (!form.phone.trim()) msgs.push("No HP wajib diisi.");
    const normalized = normalizePhone(form.phone);
    const digitsOnly = normalized.replace(/\D/g, "");
    if (digitsOnly.length < 12 || digitsOnly.length > 14) {
      // Catatan: '62' + minimal 10 → total 12, maksimal 15 → total 17; namun standar umum 62 + 8-13. Kita ikuti permintaan 10-15 angka user terhadap nomor inti, sehingga setelah prepend 62 total 12-17.
      // Untuk memenuhi permintaan: valid jika nomor inti 10-15. Kita periksa panjang tanpa kode negara 62.
    }
    // Periksa panjang inti 10-15 angka
    const withoutCC = digitsOnly.startsWith("62") ? digitsOnly.slice(2) : digitsOnly;
    if (withoutCC.length < 10) msgs.push("No HP minimal 10 angka (tanpa 62). ");
    if (withoutCC.length > 15) msgs.push("No HP maksimal 15 angka (tanpa 62). ");

    setErrors(msgs);
    return msgs.length === 0;
  };

  const handleSubmitAdd = async () => {
    if (!validateForm()) return;
    setSaving(true);
    try {
      const payload = { ...form, phone: normalizePhone(form.phone) };
      const res = await fetch("/api/customers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error("Gagal menambah client");
      const created = await res.json();
      setClients((prev) => [created, ...prev]);
      setIsAddOpen(false);
    } catch (e) {
      console.error(e);
      toast.error("Gagal menyimpan. Cek input Anda.");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitEdit = async () => {
    if (!editing) return;
    if (!validateForm()) return;
    setSaving(true);
    try {
      const payload = { ...form, phone: normalizePhone(form.phone) };
      const res = await fetch(`/api/customers/${editing.id}` as const, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error("Gagal mengubah client");
      const updated = await res.json();
      setClients((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setIsEditOpen(false);
      setEditing(null);
    } catch (e) {
      console.error(e);
      toast.error("Gagal menyimpan perubahan.");
    } finally {
      setSaving(false);
    }
  };

  const ModalHeader = ({ title, subtitle }: { title: string; subtitle: string }) => (
    <div className="sticky top-0 z-10 mb-6 bg-white px-6 pt-6 dark:bg-gray-900 sm:px-8 sm:pt-8">
      <h3 className="text-2xl font-semibold text-gray-900 dark:text-white">{title}</h3>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
    </div>
  );

  const FormBody = (
    <div className="px-6 pb-6 sm:px-8 sm:pb-8">
      {errors.length > 0 && (
        <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-800">
          <p className="font-semibold mb-2">Mohon lengkapi data berikut:</p>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="space-y-5">
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">PIC</label>
          <input name="pic" value={form.pic} onChange={handleChange} placeholder="Nama PIC" className={`h-11 w-full rounded-lg border bg-white px-4 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 ${!form.pic.trim() && errors.length ? 'border-red-400' : 'border-gray-300'}`} />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
          <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="email@perusahaan.com" className="h-11 w-full rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90" />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Perusahaan</label>
          <input name="company" value={form.company} onChange={handleChange} placeholder="Nama Perusahaan" className={`h-11 w-full rounded-lg border bg-white px-4 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 ${!form.company.trim() && errors.length ? 'border-red-400' : 'border-gray-300'}`} />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Alamat</label>
          <textarea name="address" value={form.address} onChange={handleChange} rows={3} placeholder="Alamat lengkap" className={`w-full rounded-lg border bg-white px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 ${!form.address.trim() && errors.length ? 'border-red-400' : 'border-gray-300'}`} />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">No HP</label>
          <input
            name="phone"
            value={form.phone}
            onChange={handleChange}
            onBlur={(e) => setForm((p) => ({ ...p, phone: normalizePhone(e.target.value) }))}
            placeholder="62xxxxxxxxxx"
            className={`h-11 w-full rounded-lg border bg-white px-4 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 ${(!form.phone.trim() || (()=>{const d=(normalizePhone(form.phone)||'').replace(/\D/g,''); const core=d.startsWith('62')?d.slice(2):d; return core.length<10||core.length>15;})()) && errors.length ? 'border-red-400' : 'border-gray-300'}`}
          />
        </div>
      </div>
    </div>
  );

  const Footer = ({ onClose, onSave }: { onClose: () => void; onSave: () => void }) => (
    <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4 dark:border-gray-800 sm:px-8">
      <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">Close</button>
      <button disabled={saving} onClick={onSave} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">{saving ? "Saving..." : "Save Changes"}</button>
    </div>
  );

  return (
    <div>
      <PageBreadcrumb pageTitle="Daftar Client" />
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="my-4 flex justify-between">
          <input type="text" placeholder="Cari client..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="dark:bg-dark-900 shadow-theme-xs focus:border-brand-300 focus:ring-brand-500/10 dark:focus:border-brand-800 h-11 w-64 rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:ring-3 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30" />
          <button onClick={openAdd} className="rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700">+ Tambah Client</button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-200 text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="border-b px-4 py-2 text-left">#</th>
                <th className="border-b px-4 py-2 text-left">PIC</th>
                <th className="border-b px-4 py-2 text-left">Email</th>
                <th className="border-b px-4 py-2 text-left">Perusahaan</th>
                <th className="border-b px-4 py-2 text-left">Alamat</th>
                <th className="border-b px-4 py-2 text-left">No HP</th>
                <th className="border-b px-4 py-2 text-left">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {paginatedClients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-gray-500">Tidak ada data client.</td>
                </tr>
              ) : (
                paginatedClients.map((client, index) => (
                  <tr key={client.id} className="hover:bg-gray-50">
                    <td className="border-b px-4 py-2">{(currentPage - 1) * limit + index + 1}</td>
                    <td className="border-b px-4 py-2">{client.pic}</td>
                    <td className="border-b px-4 py-2">{client.email ?? "-"}</td>
                    <td className="border-b px-4 py-2">{client.company}</td>
                    <td className="border-b px-4 py-2">{client.address}</td>
                    <td className="border-b px-4 py-2">{client.phone}</td>
                    <td className="flex gap-2 border-b px-4 py-2">
                      <button onClick={() => openEdit(client)} title="Edit" className="rounded-full p-1 text-blue-600 hover:bg-blue-50"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => handleDelete(client.id)} title="Hapus" className="rounded-full p-1 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            limit={limit}
            onLimitChange={(value) => {
              setLimit(value);
              setCurrentPage(1);
            }}
          />
        )}
      </div>

      {/* Modal Tambah Client */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} className="max-h-[88vh] w-[92vw] max-w-2xl overflow-hidden rounded-3xl shadow-xl">
        <div className="max-h-[88vh] overflow-y-auto pb-2">
          <ModalHeader title="Tambah Client" subtitle="Lengkapi detail client untuk menambah data." />
          {FormBody}
        </div>
        <Footer onClose={() => setIsAddOpen(false)} onSave={handleSubmitAdd} />
      </Modal>

      {/* Modal Edit Client */}
      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} className="max-h-[88vh] w-[92vw] max-w-2xl overflow-hidden rounded-3xl shadow-xl">
        <div className="max-h-[88vh] overflow-y-auto pb-2">
          <ModalHeader title="Edit Client" subtitle="Perbarui detail untuk menjaga data tetap akurat." />
          {FormBody}
        </div>
        <Footer onClose={() => setIsEditOpen(false)} onSave={handleSubmitEdit} />
      </Modal>

      {/* Modal Konfirmasi Hapus */}
      <Modal isOpen={confirmDeleteId !== null} onClose={() => setConfirmDeleteId(null)} className="w-[92vw] max-w-md overflow-hidden rounded-3xl shadow-xl">
        <div className="px-6 pt-6 pb-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Hapus Client</h3>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Anda yakin ingin menghapus client ini? Tindakan ini tidak dapat dibatalkan.</p>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4 dark:border-gray-800">
          <button onClick={() => setConfirmDeleteId(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">Batal</button>
          <button onClick={confirmDelete} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">Hapus</button>
        </div>
      </Modal>
    </div>
  );
}
