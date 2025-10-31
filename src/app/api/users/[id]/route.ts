import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { getAuth } from "@/lib/auth";
import { sendNotificationToUser } from "@/lib/notification";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = Number(id);
  if (Number.isNaN(userId)) return NextResponse.json({ success: false, message: "ID tidak valid" }, { status: 400 });
  try {
    const u = await prisma.user.findUnique({ where: { id: userId }, include: { roles: { include: { role: true } } } });
    if (!u) return NextResponse.json({ success: false, message: "User tidak ditemukan" }, { status: 404 });
    return NextResponse.json({ 
      success: true, 
      data: { 
        id: u.id, 
        email: u.email, 
        name: u.name,
        firstName: u.firstName,
        lastName: u.lastName,
        phone: u.phone,
        bio: u.bio,
        address: u.address,
        city: u.city,
        country: u.country,
        postalCode: u.postalCode,
        company: u.company,
        website: u.website,
        avatar: u.avatar,
        facebook: u.facebook,
        twitter: u.twitter,
        linkedin: u.linkedin,
        instagram: u.instagram,
        isActive: u.isActive, 
        roles: u.roles.map((ur) => ur.role.name) 
      } 
    });
  } catch (err: any) {
    console.error("[users/:id][GET]", err);
    return NextResponse.json({ success: false, message: err?.message || "Gagal" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = Number(id);
  if (Number.isNaN(userId)) return NextResponse.json({ success: false, message: "ID tidak valid" }, { status: 400 });
  try {
    const auth = await getAuth();
    const roles = auth?.roles || [];
    const lower = roles.map((r) => r.toLowerCase());
    const isOwner = lower.includes("owner");
    if (!auth?.userId || !isOwner) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const before = await prisma.user.findUnique({ where: { id: userId }, include: { roles: { include: { role: true } } } });
    const body = await req.json();
    const data: any = {};
    if (body.email) data.email = body.email;
    if (body.name != null) data.name = body.name;
    if (body.firstName != null) data.firstName = body.firstName;
    if (body.lastName != null) data.lastName = body.lastName;
    if (body.phone != null) data.phone = body.phone;
    if (body.bio != null) data.bio = body.bio;
    if (body.address != null) data.address = body.address;
    if (body.city != null) data.city = body.city;
    if (body.country != null) data.country = body.country;
    if (body.postalCode != null) data.postalCode = body.postalCode;
    if (body.company != null) data.company = body.company;
    if (body.website != null) data.website = body.website;
    if (body.avatar != null) data.avatar = body.avatar;
    if (body.facebook != null) data.facebook = body.facebook;
    if (body.twitter != null) data.twitter = body.twitter;
    if (body.linkedin != null) data.linkedin = body.linkedin;
    if (body.instagram != null) data.instagram = body.instagram;
    if (typeof body.isActive === "boolean") data.isActive = body.isActive;
    if (body.password) data.passwordHash = await hashPassword(body.password);

    const updated = await prisma.user.update({ where: { id: userId }, data });
    if (Array.isArray(body.roles)) {
      if (!isOwner) {
        return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
      }
      // Replace roles
      const foundRoles = await prisma.role.findMany({ where: { name: { in: body.roles } } });
      await prisma.userRole.deleteMany({ where: { userId } });
      await prisma.userRole.createMany({ data: foundRoles.map((r) => ({ userId, roleId: r.id })) });
      // Notify user about role changes
      try {
        await sendNotificationToUser(
          userId,
          "Perubahan peran",
          `Peran Anda diperbarui: ${body.roles.join(", ")}`,
          "info"
        );
      } catch {}
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      (req as any).ip ||
      null;
    const userAgent = req.headers.get("user-agent") || null;
    await prisma.activityLog.create({
      data: {
        userId: auth.userId,
        action: "USER_UPDATE",
        entity: "user",
        entityId: updated.id,
        metadata: {
          before: before
            ? {
                id: before.id,
                email: before.email,
                isActive: before.isActive,
                roles: before.roles.map((ur) => ur.role.name),
              }
            : null,
          after: {
            id: updated.id,
            email: updated.email,
            isActive: updated.isActive,
            roles: Array.isArray(body.roles) ? body.roles : undefined,
          },
          ip,
          userAgent,
        },
      },
    });

    // Notify user if activation status changed
    if (typeof body.isActive === "boolean" && before && before.isActive !== body.isActive) {
      try {
        await sendNotificationToUser(
          userId,
          body.isActive ? "Akun diaktifkan" : "Akun dinonaktifkan",
          body.isActive ? "Akun Anda telah diaktifkan." : "Akun Anda telah dinonaktifkan.",
          body.isActive ? "success" : "warning"
        );
      } catch {}
    }

    return NextResponse.json({ 
      success: true, 
      data: { 
        id: updated.id, 
        email: updated.email, 
        name: updated.name,
        firstName: updated.firstName,
        lastName: updated.lastName,
        phone: updated.phone,
        bio: updated.bio,
        address: updated.address,
        city: updated.city,
        country: updated.country,
        postalCode: updated.postalCode,
        company: updated.company,
        website: updated.website,
        avatar: updated.avatar,
        facebook: updated.facebook,
        twitter: updated.twitter,
        linkedin: updated.linkedin,
        instagram: updated.instagram,
        isActive: updated.isActive 
      } 
    });
  } catch (err: any) {
    console.error("[users/:id][PUT]", err);
    return NextResponse.json({ success: false, message: err?.message || "Gagal update" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = Number(id);
  if (Number.isNaN(userId)) return NextResponse.json({ success: false, message: "ID tidak valid" }, { status: 400 });
  try {
    const auth = await getAuth();
    const roles = auth?.roles || [];
    const isOwner = roles.some((r) => r.toLowerCase() === "owner");
    if (!auth?.userId || !isOwner) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const before = await prisma.user.findUnique({ where: { id: userId } });
    await prisma.userRole.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });

    await prisma.activityLog.create({
      data: {
        userId: auth.userId,
        action: "USER_DELETE",
        entity: "user",
        entityId: userId,
        metadata: {
          before: before ? { id: before.id, email: before.email, isActive: before.isActive } : null,
          after: null,
        },
      },
    });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[users/:id][DELETE]", err);
    return NextResponse.json({ success: false, message: err?.message || "Gagal hapus" }, { status: 500 });
  }
}
