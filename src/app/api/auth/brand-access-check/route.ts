import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuth } from "@/lib/auth";
import { ACTIVE_BRAND_COOKIE, userCanAccessBrand, getActiveBrandProfile } from "@/lib/brand";

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

    // 3) Fallback to active brand cookie or default resolution
    if (!brandId) {
      // Prefer cookie when available
      const cookieSlug = req.cookies.get(ACTIVE_BRAND_COOKIE)?.value;
      if (cookieSlug && cookieSlug.trim()) {
        const brand = await prisma.brandProfile.findUnique({ where: { slug: cookieSlug } });
        if (brand) brandId = brand.id;
      }
    }

    if (!brandId) {
      const brand = await getActiveBrandProfile();
      if (brand?.id) brandId = brand.id;
    }

    if (!brandId) {
      return NextResponse.json({ success: false, allowed: false, message: "Brand tidak ditemukan" }, { status: 404 });
    }

    const allowed = await userCanAccessBrand(auth.userId, brandId);
    if (!allowed) {
      return NextResponse.json({ success: false, allowed: false, message: "Forbidden: brand scope" }, { status: 403 });
    }

    return NextResponse.json({ success: true, allowed: true, brandProfileId: brandId });
  } catch (err: any) {
    console.error("[auth/brand-access-check]", err);
    return NextResponse.json({ success: false, allowed: false, message: err?.message || "Error" }, { status: 500 });
  }
}

