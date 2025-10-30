import { NextResponse } from "next/server";
import { clearAuthCookie, getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    const auth = await getAuth();
    await clearAuthCookie();
    if (auth?.userId) {
      await prisma.activityLog.create({ data: { userId: auth.userId, action: "LOGOUT", entity: "auth" } });
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[auth/logout] error", err);
    return NextResponse.json({ success: false, message: err?.message || "Gagal logout" }, { status: 500 });
  }
}