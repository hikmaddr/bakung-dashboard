import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuth } from "@/lib/auth";
import { ACTIVE_BRAND_COOKIE, userCanAccessBrand } from "@/lib/brand";

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuth();
    if (!auth?.userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const brandIdBody = Number(body?.brandId || body?.brandProfileId || 0);
    const brandSlugBody = String(body?.brandSlug || "").trim();

    let brandId: number | null = null;
    if (brandIdBody && Number.isFinite(brandIdBody)) brandId = brandIdBody;

    let brand = null as null | { id: number; slug: string };
    if (brandId) {
      const b = await prisma.brandProfile.findUnique({ where: { id: brandId } });
      if (!b) return NextResponse.json({ success: false, message: "Brand tidak ditemukan" }, { status: 404 });
      brand = { id: b.id, slug: b.slug };
    } else if (brandSlugBody) {
      const b = await prisma.brandProfile.findUnique({ where: { slug: brandSlugBody } });
      if (!b) return NextResponse.json({ success: false, message: "Brand tidak ditemukan" }, { status: 404 });
      brand = { id: b.id, slug: b.slug };
    } else {
      return NextResponse.json({ success: false, message: "brandId atau brandSlug wajib" }, { status: 400 });
    }

    const allowed = await userCanAccessBrand(auth.userId, brand!.id);
    if (!allowed) {
      return NextResponse.json({ success: false, message: "Forbidden: brand scope" }, { status: 403 });
    }

    const res = NextResponse.json({ success: true, brandProfileId: brand!.id, brandSlug: brand!.slug });
    res.cookies.set({
      name: ACTIVE_BRAND_COOKIE,
      value: brand!.slug,
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  } catch (err: any) {
    console.error("[auth/set-active-brand]", err);
    return NextResponse.json({ success: false, message: err?.message || "Error" }, { status: 500 });
  }
}

