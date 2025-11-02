import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuth } from "@/lib/auth";

export async function GET() {
  try {
    const auth = await getAuth();
    if (!auth?.userId) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    const items = await prisma.notification.findMany({ where: { userId: auth.userId }, orderBy: { createdAt: "desc" } });
    return NextResponse.json({ success: true, data: items });
  } catch (err: any) {
    console.error("[notifications][GET]", err);
    return NextResponse.json({ success: false, message: err?.message || "Gagal load notif" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await getAuth();
    if (!auth?.userId) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const idsRaw: any[] = Array.isArray(body?.ids) ? body.ids : [];
    const ids: number[] = idsRaw
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n) && n > 0);
    const read: boolean = typeof body?.read === "boolean"
      ? body.read
      : (typeof body?.isRead === "boolean" ? body.isRead : true);

    // Revisi kebijakan: JANGAN menghapus massal pada PATCH read=true.
    // Hanya update status baca untuk ID yang dikirim.
    if (!ids.length) {
      return NextResponse.json({ success: false, message: "ids wajib" }, { status: 400 });
    }

    await prisma.notification.updateMany({
      where: { id: { in: ids }, userId: auth.userId },
      data: { read },
    });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[notifications][PATCH]", err);
    return NextResponse.json({ success: false, message: err?.message || "Gagal update notif" }, { status: 500 });
  }
}
