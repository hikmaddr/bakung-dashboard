import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { getAuth } from "@/lib/auth";

function isOwner(roles?: string[] | null): boolean {
  if (!Array.isArray(roles)) return false;
  return roles.some((r) => r.toLowerCase() === "owner");
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuth();
    if (!auth?.userId || !isOwner(auth.roles)) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }
    const url = new URL(req.url);
    const status = (url.searchParams.get("status") || "").toLowerCase();
    let where: any = undefined;
    if (status === "active") where = { isActive: true };
    else if (status === "pending" || status === "inactive") where = { isActive: false };

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { roles: { include: { role: true } } },
    });
    const data = users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      isActive: u.isActive,
      roles: u.roles.map((ur) => ur.role.name),
      createdAt: u.createdAt,
    }));
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("[users][GET]", err);
    return NextResponse.json({ success: false, message: err?.message || "Gagal load users" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuth();
    if (!auth?.userId || !isOwner(auth.roles)) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }
    const body = await req.json();
    const {
      email,
      password,
      name,
      firstName,
      lastName,
      phone,
      bio,
      address,
      city,
      country,
      postalCode,
      company,
      website,
      avatar,
      facebook,
      twitter,
      linkedin,
      instagram,
      isActive,
      roles = [],
    } = body;

    if (!email || !password) {
      return NextResponse.json({ success: false, message: "Email dan password wajib." }, { status: 400 });
    }

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return NextResponse.json({ success: false, message: "Email sudah terdaftar." }, { status: 409 });

    const passwordHash = await hashPassword(password);

    const created = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: name ?? null,
        firstName: firstName ?? null,
        lastName: lastName ?? null,
        phone: phone ?? null,
        bio: bio ?? null,
        address: address ?? null,
        city: city ?? null,
        country: country ?? null,
        postalCode: postalCode ?? null,
        company: company ?? null,
        website: website ?? null,
        avatar: avatar ?? null,
        facebook: facebook ?? null,
        twitter: twitter ?? null,
        linkedin: linkedin ?? null,
        instagram: instagram ?? null,
        isActive: typeof isActive === "boolean" ? isActive : true,
      },
    });

    if (Array.isArray(roles) && roles.length) {
      const foundRoles = await prisma.role.findMany({ where: { name: { in: roles } } });
      await prisma.userRole.createMany({
        data: foundRoles.map((r) => ({ userId: created.id, roleId: r.id })),
        skipDuplicates: true,
      });
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      (req as any).ip ||
      null;
    const userAgent = req.headers.get("user-agent") || null;

    await prisma.activityLog.create({
      data: {
        userId: auth.userId,
        action: "USER_CREATE",
        entity: "user",
        entityId: created.id,
        metadata: {
          before: null,
          after: { id: created.id, email: created.email, isActive: created.isActive, roles },
          ip,
          userAgent,
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: created.id,
        email: created.email,
        name: created.name,
        firstName: created.firstName,
        lastName: created.lastName,
        phone: created.phone,
        bio: created.bio,
        address: created.address,
        city: created.city,
        country: created.country,
        postalCode: created.postalCode,
        company: created.company,
        website: created.website,
        avatar: created.avatar,
        facebook: created.facebook,
        twitter: created.twitter,
        linkedin: created.linkedin,
        instagram: created.instagram,
        isActive: created.isActive,
      },
    });
  } catch (err: any) {
    console.error("[users][POST]", err);
    return NextResponse.json({ success: false, message: err?.message || "Gagal membuat user" }, { status: 500 });
  }
}
