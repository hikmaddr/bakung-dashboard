"use client";

import React, { useEffect, useMemo, useState } from "react";

type UserItem = { id: number; email: string; name: string | null; isActive: boolean; roles: string[] };
type RoleItem = { id: number; name: string };
type BrandItem = { id: number; name: string; slug: string };

export default function Page() {
  const [profile, setProfile] = useState<{ roles: string[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [users, setUsers] = useState<UserItem[]>([]);
  const [userBrands, setUserBrands] = useState<Record<number, string[]>>({});
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [brands, setBrands] = useState<BrandItem[]>([]);

  const isOwner = useMemo(() => (profile?.roles || []).map((r) => r.toLowerCase()).includes("owner"), [profile]);

  const [editRoleOpen, setEditRoleOpen] = useState(false);
  const [editRoleUser, setEditRoleUser] = useState<UserItem | null>(null);
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [savingRole, setSavingRole] = useState(false);
  const [editRoleError, setEditRoleError] = useState<string | null>(null);

  const [assignBrandOpen, setAssignBrandOpen] = useState(false);
  const [assignBrandUser, setAssignBrandUser] = useState<UserItem | null>(null);
  const [assignBrands, setAssignBrands] = useState<string[]>([]); // store slugs
  const [savingAssign, setSavingAssign] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const r = await fetch("/api/profile", { cache: "no-store" });
        const j = await r.json();
        if (!j.success) throw new Error(j.message || "Gagal memuat profil");
        setProfile({ roles: j.data.roles || [] });
      } catch (e: any) {
        setError(e.message || "Gagal memuat profil");
      }
    };
    loadProfile();
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const [usersRes, rolesRes, brandsRes] = await Promise.all([
          fetch("/api/users", { cache: "no-store" }),
          fetch("/api/roles", { cache: "no-store" }),
          fetch("/api/brand-profiles", { cache: "no-store" }),
        ]);
        const usersJson = await usersRes.json();
        const rolesJson = await rolesRes.json();
        const brandsJson = await brandsRes.json();
        if (!usersJson.success) throw new Error(usersJson.message || "Gagal memuat pengguna");
        if (!rolesJson.success) throw new Error(rolesJson.message || "Gagal memuat roles");
        if (!brandsJson.success) throw new Error(brandsJson.message || "Gagal memuat brand");

        setUsers(usersJson.data);
        setRoles((rolesJson.data || []).map((x: any) => ({ id: x.id, name: x.name })));
        setBrands((brandsJson.data || []).map((b: any) => ({ id: b.id, name: b.name, slug: b.slug })));

        const ids: number[] = (usersJson.data || []).map((u: any) => u.id).filter((id: any) => typeof id === "number");
        if (ids.length > 0) {
          const results = await Promise.all(
            ids.map(async (id) => {
              const r = await fetch(`/api/user-brand-scopes?userId=${id}`, { cache: "no-store" });
              const j = await r.json().catch(() => ({ success: false, data: [] }));
              const names = j?.success && Array.isArray(j?.data) ? j.data.map((s: any) => s.brandName || s.brandSlug).filter(Boolean) : [];
              return { id, names };
            })
          );
          const map: Record<number, string[]> = {};
          results.forEach((r) => {
            map[r.id] = r.names;
          });
          setUserBrands(map);
        }
      } catch (e: any) {
        setError(e.message || "Gagal memuat data");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const openEditRole = (u: UserItem) => {
    setEditRoleUser(u);
    setEditRoles(u.roles || []);
    setEditRoleError(null);
    setEditRoleOpen(true);
  };

  const submitEditRole = async () => {
    if (!editRoleUser) return;
    try {
      setSavingRole(true);
      setEditRoleError(null);
      const res = await fetch(`/api/users/${editRoleUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roles: editRoles }),
      });
      const j = await res.json();
      if (!j.success) throw new Error(j.message || "Gagal menyimpan role");
      setUsers((prev) => prev.map((x) => (x.id === editRoleUser.id ? { ...x, roles: [...editRoles] } : x)));
      setEditRoleOpen(false);
      setEditRoleUser(null);
    } catch (e: any) {
      setEditRoleError(e.message || "Gagal menyimpan role");
    } finally {
      setSavingRole(false);
    }
  };

  const openAssignBrand = (u: UserItem) => {
    setAssignBrandUser(u);
    const existing = userBrands[u.id] || [];
    // map brand names back to slugs where possible
    const nameToSlug = new Map(brands.map((b) => [b.name, b.slug] as const));
    const slugToSlug = new Set(brands.map((b) => b.slug));
    const selected = existing.map((label) => (nameToSlug.get(label) || (slugToSlug.has(label) ? label : null))).filter(Boolean) as string[];
    setAssignBrands(selected);
    setAssignError(null);
    setAssignBrandOpen(true);
  };

  const submitAssignBrand = async () => {
    if (!assignBrandUser) return;
    try {
      setSavingAssign(true);
      setAssignError(null);
      const res = await fetch("/api/user-brand-scopes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: assignBrandUser.id, brands: assignBrands, replaceAll: true }),
      });
      const j = await res.json();
      if (!j.success) throw new Error(j.message || "Gagal assign brand");
      // Refresh display labels
      const labels = assignBrands
        .map((slug) => brands.find((b) => b.slug === slug)?.name || slug)
        .filter(Boolean);
      setUserBrands((prev) => ({ ...prev, [assignBrandUser.id]: labels }));
      setAssignBrandOpen(false);
      setAssignBrandUser(null);
    } catch (e: any) {
      setAssignError(e.message || "Gagal assign brand");
    } finally {
      setSavingAssign(false);
    }
  };

  if (!profile) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold mb-2">Role & Access</h1>
        <p className="text-sm text-gray-500">Memuat profil...</p>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold mb-2">Role & Access</h1>
        <p className="text-sm text-red-600">Akses ditolak. Halaman ini hanya untuk Owner.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">Role & Access</h1>
        <p className="text-gray-500 text-sm">Kelola role user dan scope brand.</p>
      </div>
      {error && (
        <div className="mb-4 text-sm text-red-600">{error}</div>
      )}
      {loading ? (
        <div className="text-sm text-gray-500">Memuat data...</div>
      ) : (
        <div className="overflow-x-auto rounded border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Roles</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Brand Scope</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-2 text-sm">{u.name || "-"}</td>
                  <td className="px-4 py-2 text-sm">{u.email}</td>
                  <td className="px-4 py-2 text-sm">{(u.roles || []).join(", ")}</td>
                  <td className="px-4 py-2 text-sm">{(userBrands[u.id] || []).join(", ") || <span className="text-gray-400">(tidak ada)</span>}</td>
                  <td className="px-4 py-2 text-sm space-x-2 whitespace-nowrap">
                    <button className="px-3 py-1 rounded bg-indigo-600 text-white text-xs" onClick={() => openEditRole(u)}>Edit Role</button>
                    <button className="px-3 py-1 rounded bg-emerald-600 text-white text-xs" onClick={() => openAssignBrand(u)}>Assign Brand</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Role Modal */}
      {editRoleOpen && editRoleUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-lg max-w-lg w-full p-4">
            <h3 className="text-lg font-semibold mb-2">Edit Role</h3>
            <p className="text-sm text-gray-500 mb-4">{editRoleUser.email}</p>
            <div className="mb-4">
              <label className="block text-xs text-gray-600 mb-1">Pilih Role</label>
              <div className="border rounded p-2 max-h-52 overflow-auto">
                {roles.map((r) => {
                  const checked = editRoles.includes(r.name);
                  return (
                    <label key={r.id} className="flex items-center gap-2 text-sm py-1">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={checked}
                        onChange={(e) => {
                          const v = e.target.checked;
                          setEditRoles((prev) => (v ? Array.from(new Set([...prev, r.name])) : prev.filter((x) => x !== r.name)));
                        }}
                      />
                      <span>{r.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            {editRoleError && <div className="text-sm text-red-600 mb-2">{editRoleError}</div>}
            <div className="flex justify-end gap-2">
              <button className="px-3 py-1 text-sm" onClick={() => { setEditRoleOpen(false); setEditRoleUser(null); }}>Batal</button>
              <button className="px-3 py-1 rounded bg-indigo-600 text-white text-sm" disabled={savingRole} onClick={submitEditRole}>
                {savingRole ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Brand Modal */}
      {assignBrandOpen && assignBrandUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-lg max-w-lg w-full p-4">
            <h3 className="text-lg font-semibold mb-2">Assign Brand</h3>
            <p className="text-sm text-gray-500 mb-4">{assignBrandUser.email}</p>
            <div className="mb-4">
              <label className="block text-xs text-gray-600 mb-1">Pilih Brand</label>
              <div className="border rounded p-2 max-h-52 overflow-auto">
                {brands.map((b) => {
                  const checked = assignBrands.includes(b.slug);
                  return (
                    <label key={b.id} className="flex items-center gap-2 text-sm py-1">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={checked}
                        onChange={(e) => {
                          const v = e.target.checked;
                          setAssignBrands((prev) => (v ? Array.from(new Set([...prev, b.slug])) : prev.filter((x) => x !== b.slug)));
                        }}
                      />
                      <span>{b.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            {assignError && <div className="text-sm text-red-600 mb-2">{assignError}</div>}
            <div className="flex justify-end gap-2">
              <button className="px-3 py-1 text-sm" onClick={() => { setAssignBrandOpen(false); setAssignBrandUser(null); }}>Batal</button>
              <button className="px-3 py-1 rounded bg-emerald-600 text-white text-sm" disabled={savingAssign} onClick={submitAssignBrand}>
                {savingAssign ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

