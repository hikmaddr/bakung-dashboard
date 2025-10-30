import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuth } from "@/lib/auth";

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

    const before = await prisma.user.findUnique({ where: { id: userId } });
    if (!before) {
      return NextResponse.json({ success: false, message: "User tidak ditemukan" }, { status: 404 });
    }

    const updated = await prisma.user.update({ where: { id: userId }, data: { isActive: true } });

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
          after: { id: updated.id, email: updated.email, isActive: updated.isActive },
          ip,
          userAgent,
        },
      },
    });

    return NextResponse.json({ success: true, data: { id: updated.id, email: updated.email, isActive: updated.isActive } });
  } catch (err: any) {
    console.error("[users/:id/approve][POST]", err);
    return NextResponse.json({ success: false, message: err?.message || "Gagal approve user" }, { status: 500 });
  }
}
