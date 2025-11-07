import { NextRequest, NextResponse } from "next/server";
import { logActivity } from "@/lib/activity";
import { getAuth } from "@/lib/auth";

// Ensure Node runtime to allow Prisma via logActivity
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuth();
    const { path, reason, extra } = await req.json().catch(() => ({ path: null, reason: null }));
    await logActivity(req, {
      userId: auth?.userId ?? null,
      action: "ACCESS_DENIED",
      entity: "page",
      entityId: null,
      metadata: { path, reason, extra },
    });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || "Failed to log" }, { status: 500 });
  }
}

