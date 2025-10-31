import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signToken, setAuthCookie, verifyPassword } from "@/lib/auth";
import { logActivity, logLogin } from "@/lib/activity";
import { sendNotificationToUser } from "@/lib/notification";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ success: false, message: "Email dan password wajib." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { roles: { include: { role: true } } },
    });

    if (!user || !user.isActive) {
      return NextResponse.json({ success: false, message: "User tidak ditemukan atau non-aktif." }, { status: 401 });
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ success: false, message: "Password salah." }, { status: 401 });
    }

    const roleNames = user.roles.map((ur) => ur.role.name);
    const token = signToken({ userId: user.id, email: user.email, roles: roleNames });
    setAuthCookie(token);

    // Log to ActivityLog and LoginLog
    await logActivity(req, { userId: user.id, action: "LOGIN", entity: "auth" });
    await logLogin(req, { userId: user.id, action: "LOGIN", success: true });

    // Notify user
    try {
      await sendNotificationToUser(
        user.id,
        "Selamat datang",
        `Login berhasil pada ${new Date().toLocaleString()}`,
        "success"
      );
    } catch {}

    return NextResponse.json({ success: true, data: { id: user.id, email: user.email, name: user.name, roles: roleNames } });
  } catch (err: any) {
    console.error("[auth/login] error", err);
    return NextResponse.json({ success: false, message: err?.message || "Gagal login" }, { status: 500 });
  }
}
