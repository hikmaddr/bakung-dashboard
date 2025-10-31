"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { CheckCircle, Lock, Plus, RotateCcw } from "lucide-react";

type Role = { id: number; name: string; description?: string | null; permissions: any };

const MODULES: { key: string; label: string }[] = [
  { key: "client", label: "Client" },
  { key: "quotation", label: "Quotation" },
  { key: "salesOrder", label: "Sales Order" },
  { key: "invoice", label: "Invoice" },
  { key: "kwitansi", label: "Kwitansi" },
  { key: "delivery", label: "Surat Jalan" },
  { key: "purchaseOrder", label: "Purchase Order" },
  { key: "productStock", label: "Product & Stok" },
  { key: "templateBranding", label: "Template & Branding" },
  { key: "reporting", label: "Reporting" },
  { key: "systemUser", label: "System & User" },
];

const PERMS: { key: keyof Perms; label: string }[] = [
  { key: "view", label: "View" },
  { key: "create", label: "Create" },
  { key: "edit", label: "Edit" },
  { key: "delete", label: "Delete" },
  { key: "approve", label: "Approve" },
];

type Perms = { view: boolean; create: boolean; edit: boolean; delete: boolean; approve: boolean };

export default function Page() {
  const router = useRouter();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingOpen, setAddingOpen] = useState(false);
  const [newRole, setNewRole] = useState({ name: "", description: "" });

  useEffect(() => {
    (async () => {
      // Owner-only guard
      const prof = await fetch("/api/profile");
      const profJson = await prof.json();
      const roleNames: string[] = profJson?.data?.roles || [];
      const isOwner = roleNames.some((r) => r.toLowerCase() === "owner");
      if (!isOwner) {
        router.replace("/error-403");
        return;
      }
      // Load roles
      const res = await fetch("/api/roles");
      const json = await res.json();
      setRoles(json?.data || []);
      setLoading(false);
    })();
  }, [router]);

  const handleToggle = async (roleId: number, moduleKey: string, perm: keyof Perms) => {
    try {
      const next = roles.map((r) => {
        if (r.id !== roleId) return r;
        const existing = r.permissions?.[moduleKey] || { view: false, create: false, edit: false, delete: false, approve: false };
        const updatedModule = { ...existing, [perm]: !existing[perm] };
        const updatedPerms = { ...(r.permissions || {}), [moduleKey]: updatedModule };
        return { ...r, permissions: updatedPerms };
      });
      setRoles(next);
      const target = next.find((r) => r.id === roleId)!;
      const res = await fetch(`/api/roles/${roleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: target.permissions }),
      });
      const json = await res.json();
      if (json?.success) {
        toast.success("Perubahan disimpan");
      } else {
        throw new Error(json?.message || "Gagal menyimpan");
      }
    } catch (e: any) {
      toast.error(e?.message || "Gagal menyimpan perubahan");
    }
  };

  const addRole = async () => {
    if (!newRole.name.trim()) {
      toast.error("Nama role wajib");
      return;
    }
    try {
      const res = await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newRole.name.trim(), description: newRole.description.trim(), permissions: {} }),
      });
      const json = await res.json();
      if (json?.success) {
        setRoles((prev) => [json.data, ...prev]);
        setAddingOpen(false);
        setNewRole({ name: "", description: "" });
        toast.success("Role ditambahkan");
      } else {
        throw new Error(json?.message || "Gagal menambah role");
      }
    } catch (e: any) {
      toast.error(e?.message || "Gagal menambah role");
    }
  };

  const resetDefaults = async () => {
    try {
      const res = await fetch("/api/roles/reset-default", { method: "POST" });
      const json = await res.json();
      if (json?.success) {
        // refresh roles from server
        const r = await fetch("/api/roles");
        const j = await r.json();
        setRoles(j?.data || []);
        toast.success("Reset ke default berhasil");
      } else {
        throw new Error(json?.message || "Gagal reset");
      }
    } catch (e: any) {
      toast.error(e?.message || "Gagal reset ke default");
    }
  };

  const Header = useMemo(() => (
    <div className="flex items-start justify-between">
      <div>
        <CardTitle>Role & Access Management</CardTitle>
        <CardDescription>Kendalikan hak akses per modul untuk setiap role.</CardDescription>
      </div>
      <button
        className="inline-flex h-9 items-center gap-2 px-3 rounded-md bg-primary text-white hover:opacity-90"
        onClick={() => setAddingOpen(true)}
      >
        <Plus className="w-4 h-4" />
        Tambah Role
      </button>
    </div>
  ), []);

  if (loading) {
    return (
      <div className="p-6"><p className="text-sm text-gray-600">Memuat data…</p></div>
    );
  }

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          {Header}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-left p-3 border-b w-56">Modul / Izin</th>
                  {roles.map((r) => (
                    <th key={r.id} className="text-center p-3 border-b min-w-[180px]">{r.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MODULES.map((m) => (
                  <tr key={m.key}>
                    <td className="p-3 border-b align-top">
                      <div className="font-medium">{m.label}</div>
                      <div className="text-xs text-gray-500">{PERMS.map((p) => p.label).join(", ")}</div>
                    </td>
                    {roles.map((r) => {
                      const perms: Perms = r.permissions?.[m.key] || { view: false, create: false, edit: false, delete: false, approve: false };
                      return (
                        <td key={`${m.key}-${r.id}`} className="p-3 border-b">
                          <div className="flex flex-wrap gap-2 items-center justify-center">
                            {PERMS.map((p) => {
                              const active = perms[p.key];
                              return (
                                <button
                                  key={p.key}
                                  className={`inline-flex items-center gap-1 px-2 h-8 rounded-md border text-xs ${active ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-gray-50 border-gray-200 text-gray-600"}`}
                                  onClick={() => handleToggle(r.id, m.key, p.key)}
                                  title={`${p.label} ${active ? "aktif" : "non-aktif"}`}
                                >
                                  {active ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <Lock className="w-4 h-4 text-gray-500" />}
                                  {p.label}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex items-center justify-end">
            <button
              className="inline-flex items-center gap-2 h-9 px-3 rounded-md border hover:bg-gray-50"
              onClick={resetDefaults}
            >
              <RotateCcw className="w-4 h-4" />
              Reset ke Default
            </button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={addingOpen} onOpenChange={setAddingOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Role</DialogTitle>
            <DialogDescription>Masukkan nama dan deskripsi untuk role baru.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm">Nama Role</label>
              <input
                className="mt-1 w-full h-9 px-3 rounded-md border"
                value={newRole.name}
                onChange={(e) => setNewRole((s) => ({ ...s, name: e.target.value }))}
                placeholder="Contoh: Supervisor, Finance"
              />
            </div>
            <div>
              <label className="text-sm">Deskripsi</label>
              <textarea
                className="mt-1 w-full min-h-[72px] px-3 py-2 rounded-md border"
                value={newRole.description}
                onChange={(e) => setNewRole((s) => ({ ...s, description: e.target.value }))}
                placeholder="Opsional"
              />
            </div>
          </div>
          <DialogFooter>
            <button className="inline-flex h-9 items-center px-3 rounded-md border mr-2" onClick={() => setAddingOpen(false)}>Batal</button>
            <button className="inline-flex h-9 items-center px-4 rounded-md bg-primary text-white hover:opacity-90" onClick={addRole}>Simpan</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

