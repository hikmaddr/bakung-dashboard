import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getAuth } from "@/lib/auth";

export const ACTIVE_BRAND_COOKIE = "active_brand_slug";

export async function getActiveBrandProfile() {
  try {
    const store = await cookies();
    const cookieSlug = store.get(ACTIVE_BRAND_COOKIE)?.value;
    const auth = await getAuth();

    // 1) Cookie override (jika ada), dan user berhak akses brand tsb
    if (cookieSlug && cookieSlug.trim()) {
      const brand = await prisma.brandProfile.findUnique({ where: { slug: cookieSlug } });
      if (brand) {
        if (await userCanAccessBrand(auth?.userId ?? null, brand.id)) {
          return brand;
        }
      }
    }

    // 2) Default brand dari user (jika di-set)
    if (auth?.userId) {
      const user = await prisma.user.findUnique({
        where: { id: auth.userId },
        select: { defaultBrandProfileId: true },
      });
      if (user?.defaultBrandProfileId) {
        const brand = await prisma.brandProfile.findUnique({ where: { id: user.defaultBrandProfileId } });
        if (brand) return brand;
      }
    }

    // 3) Fallback: brand yang isActive
    const active = await prisma.brandProfile.findFirst({ where: { isActive: true }, orderBy: { updatedAt: "desc" } });
    if (active) return active;

    // 4) Jika tidak ada yang aktif, ambil brand pertama sebagai fallback
    const first = await prisma.brandProfile.findFirst({ orderBy: { createdAt: "asc" } });
    return first ?? null;
  } catch (err) {
    console.error("getActiveBrandProfile fallback: DB error", err);
    return null;
  }
}

export async function userCanAccessBrand(userId: number | null, brandId: number) {
  if (!userId) return false;
  // Admin sistem bisa akses semua brand
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { roles: { include: { role: true } } },
  });
  const roleNames = (user?.roles || []).map((ur) => ur.role.name.toLowerCase());
  const isSystemAdmin = roleNames.includes("admin");
  const isOwner = roleNames.includes("owner");
  if (isSystemAdmin || isOwner) return true;

  const scope = await prisma.userBrandScope.findUnique({
    where: { userId_brandProfileId: { userId, brandProfileId: brandId } },
  });
  return Boolean(scope);
}

export function isOwnerOrAdmin(roles?: string[] | null): boolean {
  if (!Array.isArray(roles)) return false;
  const lower = roles.map((r) => r.toLowerCase());
  return lower.includes("owner") || lower.includes("admin");
}

export function isOwnerOnly(roles?: string[] | null): boolean {
  if (!Array.isArray(roles)) return false;
  const lower = roles.map((r) => r.toLowerCase());
  return lower.includes("owner");
}

export async function resolveAllowedBrandIds(userId: number | null, roles?: string[] | null, requestedBrandIds?: number[]) {
  if (isOwnerOrAdmin(roles)) {
    if (requestedBrandIds && requestedBrandIds.length > 0) return requestedBrandIds;
    const all = await prisma.brandProfile.findMany({ select: { id: true } });
    return all.map((b) => b.id);
  }
  if (!userId) return [];
  const scopes = await prisma.userBrandScope.findMany({ where: { userId }, select: { brandProfileId: true } });
  const scoped = scopes.map((s) => s.brandProfileId);
  if (requestedBrandIds && requestedBrandIds.length > 0) {
    const set = new Set(scoped);
    return requestedBrandIds.filter((id) => set.has(id));
  }
  return scoped;
}

export async function brandScopeWhere(field: string = "brandProfileId", userId?: number | null, roles?: string[] | null, requestedBrandIds?: number[]) {
  const allowed = await resolveAllowedBrandIds(userId ?? null, roles ?? [], requestedBrandIds);
  if (isOwnerOrAdmin(roles)) return {} as any;
  if (!allowed || allowed.length === 0) return { [field]: -1 } as any; // no access
  return { [field]: { in: allowed } } as any;
}
