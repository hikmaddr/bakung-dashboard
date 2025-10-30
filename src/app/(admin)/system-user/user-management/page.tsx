"use client";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import FeatureGuard from "@/components/FeatureGuard";
import { Modal } from "@/components/ui/modal";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import Checkbox from "@/components/form/input/Checkbox";
import MultiSelect from "@/components/form/MultiSelect";
import { Badge } from "@/components/ui/badge";

type UserItem = { id: number; email: string; name: string | null; isActive: boolean; roles: string[] };
type RoleItem = { id: number; name: string };
type BrandItem = { id: number; name: string; slug: string };

type FormState = {
  email: string;
  password: string;
  name?: string;
  isActive: boolean;
  roles: string[];
  brandSlugs?: string[];
};

export default function Page() {
  const [items, setItems] = useState<UserItem[]>([]);
  const [userBrands, setUserBrands] = useState<Record<number, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [brands, setBrands] = useState<BrandItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "pending">("all");
  const [approvingId, setApprovingId] = useState<number | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [savingAdd, setSavingAdd] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ email: "", password: "", isActive: true, roles: [], brandSlugs: [] });

  const [editOpen, setEditOpen] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<FormState>({ email: "", password: "", isActive: true, roles: [], brandSlugs: [] });

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const query = statusFilter === "all" ? "" : `?status=${statusFilter}`;
        const res = await fetch(`/api/users${query}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.message || "Gagal load users");
        setItems(json.data);
        // Load brand scopes per user untuk tampilan tabel
        const ids: number[] = (json.data || []).map((u: any) => u.id).filter((id: any) => typeof id === 'number');
        if (ids.length > 0) {
          try {
            const results = await Promise.all(
              ids.map(async (id) => {
                const r = await fetch(`/api/user-brand-scopes?userId=${id}`, { cache: "no-store" });
                const j = await r.json().catch(() => ({ success: false, data: [] }));
                const names = j?.success && Array.isArray(j?.data) ? j.data.map((s: any) => s.brandName || s.brandSlug).filter(Boolean) : [];
                return { id, names };
              })
            );
            const map: Record<number, string[]> = {};
            results.forEach((r) => { map[r.id] = r.names; });
            setUserBrands(map);
          } catch {}
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    setLoading(true);
    load();
  }, [statusFilter]);

  useEffect(() => {
    const loadRoles = async () => {
      try {
        const r = await fetch("/api/roles", { cache: "no-store" });
        const j = await r.json();
        if (j.success) setRoles(j.data.map((x: any) => ({ id: x.id, name: x.name })));
      } catch {}
    };
    loadRoles();
  }, []);

  useEffect(() => {
    const loadBrands = async () => {
      try {
        const r = await fetch("/api/brand-profiles", { cache: "no-store" });
        const j = await r.json();
        if (Array.isArray(j)) {
          setBrands(j.map((x: any) => ({ id: x.id, name: x.name, slug: x.slug })));
        }
      } catch {}
    };
    loadBrands();
  }, []);

  const roleOptions = useMemo(() => roles.map(r => ({ value: r.name, text: r.name, selected: form.roles.includes(r.name) })), [roles, form.roles]);
  const roleOptionsEdit = useMemo(() => roles.map(r => ({ value: r.name, text: r.name, selected: editForm.roles.includes(r.name) })), [roles, editForm.roles]);
  const brandOptions = useMemo(() => brands.map(b => ({ value: b.slug, text: b.name, selected: (form.brandSlugs || []).includes(b.slug) })), [brands, form.brandSlugs]);
  const brandOptionsEdit = useMemo(() => brands.map(b => ({ value: b.slug, text: b.name, selected: (editForm.brandSlugs || []).includes(b.slug) })), [brands, editForm.brandSlugs]);

  const updateForm = (field: keyof FormState, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const submitAdd = async () => {
    setAddError(null);
    if (!form.email || !form.password) {
      setAddError("Email dan password wajib diisi.");
      return;
    }
    setSavingAdd(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, password: form.password, name: form.name, isActive: form.isActive, roles: form.roles }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "Gagal membuat user");
      const createdUser = json.data;
      // Assign brand scopes jika ada pilihan
      if (createdUser?.id && Array.isArray(form.brandSlugs) && form.brandSlugs.length > 0) {
        await fetch("/api/user-brand-scopes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: createdUser.id, brands: form.brandSlugs, replaceAll: true }),
        });
      }
      // Refresh list
      const query = statusFilter === "all" ? "" : `?status=${statusFilter}`;
      const listRes = await fetch(`/api/users${query}`, { cache: "no-store" });
      const listJson = await listRes.json();
      if (listJson.success) {
        setItems(listJson.data);
        const ids: number[] = (listJson.data || []).map((u: any) => u.id).filter((id: any) => typeof id === 'number');
        if (ids.length > 0) {
          try {
            const results = await Promise.all(
              ids.map(async (id) => {
                const r = await fetch(`/api/user-brand-scopes?userId=${id}`, { cache: "no-store" });
                const j = await r.json().catch(() => ({ success: false, data: [] }));
                const names = j?.success && Array.isArray(j?.data) ? j.data.map((s: any) => s.brandName || s.brandSlug).filter(Boolean) : [];
                return { id, names };
              })
            );
            const map: Record<number, string[]> = {};
            results.forEach((r) => { map[r.id] = r.names; });
            setUserBrands(map);
          } catch {}
        }
      }
      setAddOpen(false);
      setForm({ email: "", password: "", isActive: true, roles: [], brandSlugs: [] });
    } catch (e: any) {
      setAddError(e.message);
    } finally {
      setSavingAdd(false);
    }
  };

  const openEdit = async (id: number) => {
    try {
      setEditError(null);
      setSavingEdit(false);
      setEditId(id);
      const res = await fetch(`/api/users/${id}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "Gagal memuat user");
      const u = json.data;
      setEditForm({
        email: u.email || "",
        password: "",
        name: u.name || "",
        isActive: Boolean(u.isActive),
        roles: Array.isArray(u.roles) ? u.roles : [],
        brandSlugs: [],
      });
      try {
        const scopesRes = await fetch(`/api/user-brand-scopes?userId=${id}`);
        const scopesJson = await scopesRes.json();
        if (scopesJson.success && Array.isArray(scopesJson.data)) {
          setEditForm(prev => ({ ...prev, brandSlugs: scopesJson.data.map((s: any) => s.brandSlug) }));
        }
      } catch {}
      setEditOpen(true);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const updateEditForm = (field: keyof FormState, value: any) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  const submitEdit = async () => {
    if (!editId) return;
    setEditError(null);
    setSavingEdit(true);
    try {
      const payload: any = { ...editForm };
      if (!payload.password) delete payload.password;
      const { email, password, name, isActive, roles } = editForm;
      const res = await fetch(`/api/users/${editId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name, isActive, roles }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "Gagal memperbarui user");
      // Replace brand scopes sesuai pilihan edit
      if (Array.isArray(editForm.brandSlugs)) {
        await fetch("/api/user-brand-scopes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: editId, brands: editForm.brandSlugs, replaceAll: true }),
        });
      }
      const query = statusFilter === "all" ? "" : `?status=${statusFilter}`;
      const listRes = await fetch(`/api/users${query}`, { cache: "no-store" });
      const listJson = await listRes.json();
      if (listJson.success) {
        setItems(listJson.data);
        const ids: number[] = (listJson.data || []).map((u: any) => u.id).filter((id: any) => typeof id === 'number');
        if (ids.length > 0) {
          try {
            const results = await Promise.all(
              ids.map(async (id) => {
                const r = await fetch(`/api/user-brand-scopes?userId=${id}`, { cache: "no-store" });
                const j = await r.json().catch(() => ({ success: false, data: [] }));
                const names = j?.success && Array.isArray(j?.data) ? j.data.map((s: any) => s.brandName || s.brandSlug).filter(Boolean) : [];
                return { id, names };
              })
            );
            const map: Record<number, string[]> = {};
            results.forEach((r) => { map[r.id] = r.names; });
            setUserBrands(map);
          } catch {}
        }
      }
      setEditOpen(false);
      setEditId(null);
    } catch (e: any) {
      setEditError(e.message);
    } finally {
      setSavingEdit(false);
    }
  };

  const confirmDelete = async () => {
    if (confirmDeleteId == null) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/users/${confirmDeleteId}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) throw new Error(json?.message || "Gagal menghapus user");
      // Refresh list after delete to maintain filter
      const query = statusFilter === "all" ? "" : `?status=${statusFilter}`;
      const listRes = await fetch(`/api/users${query}`, { cache: "no-store" });
      const listJson = await listRes.json();
      if (listJson.success) setItems(listJson.data);
      setConfirmDeleteId(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeleting(false);
    }
  };

  const approveUser = async (id: number) => {
    try {
      setApprovingId(id);
      const res = await fetch(`/api/users/${id}/approve`, { method: "POST" });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "Gagal menyetujui user");
      // Refresh list to reflect status
      const query = statusFilter === "all" ? "" : `?status=${statusFilter}`;
      const listRes = await fetch(`/api/users${query}`, { cache: "no-store" });
      const listJson = await listRes.json();
      if (listJson.success) setItems(listJson.data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <FeatureGuard feature="system.user">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">User Management</h1>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-300">Status:</span>
              <select
                className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
              >
                <option value="all">Semua</option>
                <option value="active">Aktif</option>
                <option value="pending">Pending</option>
              </select>
            </div>
            <Button variant="primary" size="sm" onClick={() => setAddOpen(true)}>Tambah User</Button>
          </div>
        </div>

      {error && <div className="rounded-lg bg-red-50 p-3 text-red-600">{error}</div>}

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold">Name</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Email</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Roles</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Brands</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
              <th className="px-4 py-3 text-right text-sm font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {loading ? (
              <tr>
                <td className="px-4 py-4" colSpan={5}><LoadingSpinner label="Memuat data pengguna..." /></td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td className="px-4 py-4" colSpan={5}>Belum ada user</td>
              </tr>
            ) : (
              items.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                  <td className="px-4 py-3">{u.name || "-"}</td>
                  <td className="px-4 py-3">{u.email}</td>
                  <td className="px-4 py-3">{u.roles.join(", ") || "-"}</td>
                  <td className="px-4 py-3">
                    {Array.isArray(userBrands[u.id]) && userBrands[u.id].length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {userBrands[u.id].map((b, idx) => (
                          <Badge key={`${u.id}-${b}-${idx}`} variant="secondary" className="bg-gray-100 text-gray-700 text-xs">
                            {b}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs ${u.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                      {u.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-2 justify-end">
                      {!u.isActive && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => approveUser(u.id)}
                          disabled={approvingId === u.id}
                        >
                          {approvingId === u.id ? "Menyetujui…" : "Approve"}
                        </Button>
                      )}
                      <Button variant="secondary" size="sm" onClick={() => openEdit(u.id)}>Edit</Button>
                      <Button variant="destructive" size="sm" onClick={() => setConfirmDeleteId(u.id)}>Hapus</Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} className="max-w-[700px] p-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Tambah User Baru</h3>
          {addError && <div className="rounded-lg bg-red-50 p-3 text-red-600">{addError}</div>}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label>Email *</Label>
              <Input type="email" value={form.email} onChange={(e) => updateForm("email", e.target.value)} placeholder="user@example.com" />
            </div>
            <div>
              <Label>Password *</Label>
              <Input type="password" value={form.password} onChange={(e) => updateForm("password", e.target.value)} placeholder="••••••••" />
            </div>
            <div>
              <Label>Nama Tampilan</Label>
              <Input type="text" value={form.name || ""} onChange={(e) => updateForm("name", e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <MultiSelect label="Roles" options={roleOptions} onChange={(vals) => updateForm("roles", vals)} dropdownDarkBackground={false} />
            </div>
            <div className="md:col-span-2">
              <MultiSelect label="Brands" options={brandOptions} onChange={(vals) => updateForm("brandSlugs", vals)} dropdownDarkBackground={false} />
            </div>
            <div className="md:col-span-2">
              <div className="flex items-center gap-2">
                <Checkbox checked={form.isActive} onChange={(v) => updateForm("isActive", v)} />
                <span className="text-sm text-gray-700 dark:text-gray-300">Aktifkan user</span>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setAddOpen(false)}>Batal</Button>
            <Button variant="primary" size="sm" onClick={submitAdd} disabled={savingAdd}>{savingAdd ? "Menyimpan…" : "Simpan"}</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} className="max-w-[700px] p-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Edit User</h3>
          {editError && <div className="rounded-lg bg-red-50 p-3 text-red-600">{editError}</div>}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label>Email *</Label>
              <Input type="email" value={editForm.email} onChange={(e) => updateEditForm("email", e.target.value)} />
            </div>
            <div>
              <Label>Password (kosongkan jika tidak diubah)</Label>
              <Input type="password" value={editForm.password} onChange={(e) => updateEditForm("password", e.target.value)} />
            </div>
            <div>
              <Label>Nama Tampilan</Label>
              <Input type="text" value={editForm.name || ""} onChange={(e) => updateEditForm("name", e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <MultiSelect label="Roles" options={roleOptionsEdit} onChange={(vals) => updateEditForm("roles", vals)} dropdownDarkBackground={false} />
            </div>
            <div className="md:col-span-2">
              <MultiSelect label="Brands" options={brandOptionsEdit} onChange={(vals) => updateEditForm("brandSlugs", vals)} dropdownDarkBackground={false} />
            </div>
            <div className="md:col-span-2">
              <div className="flex items-center gap-2">
                <Checkbox checked={editForm.isActive} onChange={(v) => updateEditForm("isActive", v)} />
                <span className="text-sm text-gray-700 dark:text-gray-300">Aktifkan user</span>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(false)}>Batal</Button>
            <Button variant="primary" size="sm" onClick={submitEdit} disabled={savingEdit}>{savingEdit ? "Menyimpan…" : "Simpan"}</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={confirmDeleteId != null} onClose={() => setConfirmDeleteId(null)} className="max-w-[500px] p-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Konfirmasi Hapus</h3>
          <p className="text-sm text-gray-700 dark:text-gray-300">Anda yakin ingin menghapus user ini? Tindakan ini tidak dapat dibatalkan.</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmDeleteId(null)}>Batal</Button>
            <Button variant="destructive" size="sm" onClick={confirmDelete} disabled={deleting}>{deleting ? "Menghapus…" : "Hapus"}</Button>
          </div>
        </div>
      </Modal>
      </div>
    </FeatureGuard>
  );
}
