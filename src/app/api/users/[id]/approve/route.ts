import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuth } from "@/lib/auth";
import { sendNotificationToUser } from "@/lib/notification";

function isOwner(roles?: string[] | null): boolean {
  if (!Array.isArray(roles)) return false;
  return roles.some((r) => r.toLowerCase() === "owner");
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = Number(id);
  if (Number.isNaN(userId)) {
    return NextResponse.json({ success: false, message: "ID tidak valid" }, { status: 400 });
  }

  try {
    const auth = await getAuth();
    if (!auth?.userId || !isOwner(auth.roles)) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const before = await prisma.user.findUnique({ where: { id: userId }, include: { roles: { include: { role: true } } } });
    if (!before) {
      return NextResponse.json({ success: false, message: "User tidak ditemukan" }, { status: 404 });
    }

    // Ambil payload untuk role pilihan saat approve
    let body: any = {};
    try { body = await req.json(); } catch {}
    const roleName: string | undefined = typeof body?.roleName === "string" ? body.roleName : undefined;
    const roles: string[] | undefined = Array.isArray(body?.roles) ? body.roles : (roleName ? [roleName] : undefined);

    const updated = await prisma.user.update({ where: { id: userId }, data: { isActive: true } });

    // Jika ada role yang dipilih, assign ke user
    if (Array.isArray(roles) && roles.length > 0) {
      const foundRoles = await prisma.role.findMany({ where: { name: { in: roles } } });
      if (foundRoles.length) {
        // Hapus role existing (biasanya user baru tidak punya), lalu set yang dipilih
        await prisma.userRole.deleteMany({ where: { userId } });
        await prisma.userRole.createMany({ data: foundRoles.map((r) => ({ userId, roleId: r.id })) });
      }
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      (req as any).ip ||
      null;
    const userAgent = req.headers.get("user-agent") || null;

    await prisma.activityLog.create({
      data: {
        userId: auth.userId,
        action: "USER_APPROVE",
        entity: "user",
        entityId: updated.id,
        metadata: {
          before: before ? { id: before.id, email: before.email, isActive: before.isActive } : null,
          after: { id: updated.id, email: updated.email, isActive: updated.isActive, roles: roles ?? (before?.roles || []).map((ur) => ur.role.name) },
          ip,
          userAgent,
        },
      },
    });

    // Notify approved user
    try {
      await sendNotificationToUser(
        updated.id,
        "Akun disetujui",
        "Akun Anda telah diaktifkan oleh admin.",
        "success"
      );
    } catch {}

    return NextResponse.json({ success: true, data: { id: updated.id, email: updated.email, isActive: updated.isActive } });
  } catch (err: any) {
    console.error("[users/:id/approve][POST]", err);
    return NextResponse.json({ success: false, message: err?.message || "Gagal approve user" }, { status: 500 });
  }
}
