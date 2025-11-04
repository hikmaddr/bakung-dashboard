import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuth } from "@/lib/auth";
import { resolveAllowedBrandIds, ACTIVE_BRAND_COOKIE, getActiveBrandProfile } from "@/lib/brand";

function parseIntMaybe(v: string | null): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuth();
    if (!auth?.userId) {
      return NextResponse.json({ success: false, allowed: false, message: "Unauthorized" }, { status: 401 });
    }

    const allowedBrandIds = await resolveAllowedBrandIds(auth.userId, auth.roles, []);
    if (allowedBrandIds.length === 0) {
      return NextResponse.json(
        { success: false, allowed: false, message: "Forbidden: no brand scope assigned" },
        { status: 403 }
      );
    }

    const url = new URL(req.url);
    const brandIdParam = parseIntMaybe(url.searchParams.get("brandId") || url.searchParams.get("brandProfileId"));
    const brandSlugParam = (url.searchParams.get("brandSlug") || "").trim();

    let brandId: number | null = null;

    // 1) If explicit brandId is provided, use it
    if (brandIdParam) {
      brandId = brandIdParam;
    }

    // 2) If explicit slug provided, resolve to id
    if (!brandId && brandSlugParam) {
      const brand = await prisma.brandProfile.findUnique({ where: { slug: brandSlugParam } });
      if (brand) brandId = brand.id;
    }

    if (!brandId) {
      // 3) Fallback to active brand cookie or default resolution
      const brand = await getActiveBrandProfile();
      if (brand?.id) brandId = brand.id;
    }

    if (!brandId) {
      return NextResponse.json({ success: false, allowed: false, message: "Brand tidak ditemukan" }, { status: 404 });
    }

    if (!allowedBrandIds.includes(brandId)) {
      return NextResponse.json({ success: false, allowed: false, message: "Forbidden: brand scope" }, { status: 403 });
    }

    return NextResponse.json({ success: true, allowed: true, activeBrandId: brandId, allowedBrandIds });
  } catch (err: any) {
    console.error("[auth/brand-access-check]", err);
    return NextResponse.json({ success: false, allowed: false, message: err?.message || "Error" }, { status: 500 });
  }
}
