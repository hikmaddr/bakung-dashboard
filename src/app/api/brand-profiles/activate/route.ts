import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuth } from "@/lib/auth";
import { ACTIVE_BRAND_COOKIE } from "@/lib/brand";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  try {
    const { slug } = await req.json();
    if (!slug || typeof slug !== "string") {
      return NextResponse.json({ success: false, message: "Slug brand wajib" }, { status: 400 });
    }

    const brand = await prisma.brandProfile.findUnique({ where: { slug } });
    if (!brand) return NextResponse.json({ success: false, message: "Brand tidak ditemukan" }, { status: 404 });

    const auth = await getAuth();
    if (!auth?.userId) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

    // Admin sistem dan Owner bebas akses; selain itu cek scope user-brand
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      include: { roles: { include: { role: true } } },
    });
    const roleNames = (user?.roles || []).map((ur) => ur.role.name.toLowerCase());
    const isSystemAdmin = roleNames.includes("admin");
    const isOwner = roleNames.includes("owner");
    if (!isSystemAdmin && !isOwner) {
      const scope = await prisma.userBrandScope.findUnique({
        where: { userId_brandProfileId: { userId: auth.userId, brandProfileId: brand.id } },
      });
      if (!scope) {
        return NextResponse.json({ success: false, message: "Akses brand ditolak" }, { status: 403 });
      }
    }

    const store = await cookies();
    store.set({
      name: ACTIVE_BRAND_COOKIE,
      value: slug,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
    });

    return NextResponse.json({ success: true, message: "Brand diaktifkan", data: { slug } });
  } catch (err: any) {
    console.error("[brand-profiles/activate][POST]", err);
    return NextResponse.json({ success: false, message: err?.message || "Gagal mengaktifkan brand" }, { status: 500 });
  }
}
