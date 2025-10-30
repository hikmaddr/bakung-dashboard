import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuth } from "@/lib/auth";

function isOwner(roles?: string[]) {
  return Array.isArray(roles) && roles.some((r) => r.toLowerCase() === "owner");
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const userIdParam = url.searchParams.get("userId");
    const where = userIdParam ? { userId: Number(userIdParam) } : undefined;
    const scopes = await prisma.userBrandScope.findMany({
      where,
      include: { brand: true },
      orderBy: { createdAt: "desc" },
    });
    const data = scopes.map((s) => ({
      id: s.id,
      userId: s.userId,
      brandProfileId: s.brandProfileId,
      brandSlug: s.brand.slug,
      brandName: s.brand.name,
      isBrandAdmin: s.isBrandAdmin,
      createdAt: s.createdAt,
    }));
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("[user-brand-scopes][GET]", err);
    return NextResponse.json({ success: false, message: err?.message || "Gagal load scopes" }, { status: 500 });
  }
}

async function POST_SINGLE(req: NextRequest) {
  try {
    const auth = await getAuth();
    if (!auth?.userId) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    if (!isOwner(auth.roles)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const userId = Number(body?.userId);
    const brandSlug = String(body?.brandSlug || "").trim();
    const isBrandAdmin = Boolean(body?.isBrandAdmin ?? false);
    if (!userId || !brandSlug) {
      return NextResponse.json({ success: false, message: "userId dan brandSlug wajib" }, { status: 400 });
    }
    const brand = await prisma.brandProfile.findUnique({ where: { slug: brandSlug } });
    if (!brand) return NextResponse.json({ success: false, message: "Brand tidak ditemukan" }, { status: 404 });

    const created = await prisma.userBrandScope.upsert({
      where: { userId_brandProfileId: { userId, brandProfileId: brand.id } },
      update: { isBrandAdmin },
      create: { userId, brandProfileId: brand.id, isBrandAdmin },
    });
    await prisma.activityLog.create({
      data: {
        userId: auth.userId,
        action: "USER_BRAND_SCOPE_UPSERT",
        entity: "user_brand_scope",
        entityId: created.id,
        metadata: { targetUserId: userId, brandProfileId: brand.id, isBrandAdmin },
      },
    });

    return NextResponse.json({ success: true, data: created });
  } catch (err: any) {
    console.error("[user-brand-scopes][POST]", err);
    return NextResponse.json({ success: false, message: err?.message || "Gagal membuat scope" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuth();
    if (!auth?.userId) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    if (!isOwner(auth.roles)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const { userId, brands, isBrandAdmin = false, replaceAll = true } = body ?? {};
    const uid = Number(userId);
    if (!uid || !Array.isArray(brands)) {
      return NextResponse.json({ success: false, message: "userId dan brands[] wajib" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: uid } });
    if (!user) return NextResponse.json({ success: false, message: "User tidak ditemukan" }, { status: 404 });

    // Resolve brand slugs to IDs
    const uniqueSlugs = [...new Set(brands.filter((s: any) => typeof s === "string" && s.trim()))];
    const brandRows = await prisma.brandProfile.findMany({ where: { slug: { in: uniqueSlugs } } });
    const brandIds = brandRows.map((b) => b.id);

    if (replaceAll) {
      await prisma.userBrandScope.deleteMany({ where: { userId: uid } });
      await prisma.activityLog.create({
        data: {
          userId: auth.userId,
          action: "USER_BRAND_SCOPE_CLEAR",
          entity: "user_brand_scope",
          entityId: uid,
          metadata: { targetUserId: uid },
        },
      });
    }

    if (brandIds.length > 0) {
      // Create missing scopes; ignore duplicates via unique constraint
      for (const b of brandRows) {
        const scope = await prisma.userBrandScope.upsert({
          where: { userId_brandProfileId: { userId: uid, brandProfileId: b.id } },
          update: { isBrandAdmin: Boolean(isBrandAdmin) },
          create: { userId: uid, brandProfileId: b.id, isBrandAdmin: Boolean(isBrandAdmin) },
        });
        await prisma.activityLog.create({
          data: {
            userId: auth.userId,
            action: "USER_BRAND_SCOPE_UPSERT",
            entity: "user_brand_scope",
            entityId: scope.id,
            metadata: { targetUserId: uid, brandProfileId: b.id, isBrandAdmin: Boolean(isBrandAdmin) },
          },
        });
      }
    }

    // Return updated scopes
    const scopes = await prisma.userBrandScope.findMany({ where: { userId: uid }, include: { brand: true } });
    const data = scopes.map((s) => ({ id: s.id, userId: s.userId, brandProfileId: s.brandProfileId, brandSlug: s.brand.slug, brandName: s.brand.name, isBrandAdmin: s.isBrandAdmin }));
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("[user-brand-scopes][POST]", err);
    return NextResponse.json({ success: false, message: err?.message || "Gagal menyimpan scopes" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await getAuth();
    if (!auth?.userId) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    if (!isOwner(auth.roles)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

    const url = new URL(req.url);
    const userIdParam = url.searchParams.get("userId");
    const brandSlug = url.searchParams.get("brandSlug");
    const userId = Number(userIdParam);
    if (!userId || !brandSlug) {
      return NextResponse.json({ success: false, message: "userId dan brandSlug wajib" }, { status: 400 });
    }
    const brand = await prisma.brandProfile.findUnique({ where: { slug: brandSlug } });
    if (!brand) return NextResponse.json({ success: false, message: "Brand tidak ditemukan" }, { status: 404 });

    await prisma.userBrandScope.delete({
      where: { userId_brandProfileId: { userId, brandProfileId: brand.id } },
    });
    await prisma.activityLog.create({
      data: {
        userId: auth.userId,
        action: "USER_BRAND_SCOPE_DELETE",
        entity: "user_brand_scope",
        metadata: { targetUserId: userId, brandProfileId: brand.id },
      },
    });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[user-brand-scopes][DELETE]", err);
    return NextResponse.json({ success: false, message: err?.message || "Gagal menghapus scope" }, { status: 500 });
  }
}
