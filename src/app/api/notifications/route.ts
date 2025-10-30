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

    const { ids = [], read = true } = await req.json();
    if (Array.isArray(ids) && ids.length) {
      await prisma.notification.updateMany({ where: { id: { in: ids }, userId: auth.userId }, data: { read } });
    } else {
      await prisma.notification.updateMany({ where: { userId: auth.userId }, data: { read } });
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[notifications][PATCH]", err);
    return NextResponse.json({ success: false, message: err?.message || "Gagal update notif" }, { status: 500 });
  }
}