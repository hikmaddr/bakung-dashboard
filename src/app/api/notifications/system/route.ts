import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuth } from "@/lib/auth";

function isOwnerOrAdmin(roles?: string[] | null): boolean {
  if (!Array.isArray(roles)) return false;
  const lower = roles.map((r) => r.toLowerCase());
  return lower.includes("owner") || lower.includes("admin");
}

export async function GET(_req: NextRequest) {
  try {
    const auth = await getAuth();
    if (!auth?.userId) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    if (!isOwnerOrAdmin(auth.roles)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

    // Ambil notifikasi terbaru (global/system-wide)
    const items = await prisma.notification.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
    return NextResponse.json({ success: true, data: items });
  } catch (err: any) {
    console.error("[notifications/system][GET]", err);
    return NextResponse.json({ success: false, message: err?.message || "Gagal memuat notifikasi sistem" }, { status: 500 });
  }
}

