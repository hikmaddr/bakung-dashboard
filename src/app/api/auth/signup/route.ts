import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { sendNotificationToRole, sendNotificationToUser } from "@/lib/notification";

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: "Email dan password wajib." },
        { status: 400 }
      );
    }

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return NextResponse.json(
        { success: false, message: "Email sudah terdaftar." },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    const created = await prisma.user.create({
      data: {
        email,
        name: name ?? null,
        passwordHash,
        isActive: false, // signup -> PENDING (non-aktif)
      },
    });

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      (req as any).ip ||
      null;
    const userAgent = req.headers.get("user-agent") || null;

    await prisma.activityLog.create({
      data: {
        userId: created.id,
        action: "SIGNUP",
        entity: "user",
        entityId: created.id,
        metadata: {
          before: null,
          after: { id: created.id, email: created.email, isActive: created.isActive },
          ip,
          userAgent,
        },
      },
    });

    // Notify Owners to approve, and notify user about status
    try {
      await sendNotificationToRole(
        "Owner",
        "User baru mendaftar",
        `User ${email} mendaftar. Mohon dilakukan approval.`,
        "info"
      );
    } catch {}

    try {
      await sendNotificationToUser(
        created.id,
        "Pendaftaran berhasil",
        "Akun Anda menunggu persetujuan admin.",
        "info"
      );
    } catch {}

    return NextResponse.json({ success: true, message: "Pendaftaran berhasil. Menunggu persetujuan admin." });
  } catch (err: any) {
    console.error("[auth/signup][POST]", err);
    return NextResponse.json(
      { success: false, message: err?.message || "Gagal mendaftar" },
      { status: 500 }
    );
  }
}
