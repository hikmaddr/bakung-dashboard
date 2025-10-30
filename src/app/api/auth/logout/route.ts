import { NextResponse, type NextRequest } from "next/server";
import { clearAuthCookie, getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity, logLogin } from "@/lib/activity";

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuth();
    await clearAuthCookie();
    if (auth?.userId) {
      await logActivity(req, { userId: auth.userId, action: "LOGOUT", entity: "auth" });
      await logLogin(req, { userId: auth.userId, action: "LOGOUT", success: true });
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[auth/logout] error", err);
    return NextResponse.json({ success: false, message: err?.message || "Gagal logout" }, { status: 500 });
  }
}
