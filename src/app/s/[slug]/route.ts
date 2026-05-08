import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 0;

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    if (!slug) {
      return NextResponse.json({ success: false, message: "Slug kosong" }, { status: 400 });
    }

    const row = await prisma.shortLink.findUnique({ where: { slug } });
    if (!row || !row.isActive || !row.targetUrl) {
      return NextResponse.json({ success: false, message: "Link tidak ditemukan" }, { status: 404 });
    }

    // Fire-and-forget update for analytics
    prisma.shortLink
      .update({ where: { slug }, data: { visitCount: { increment: 1 }, lastAccessAt: new Date() } })
      .catch(() => {});

    const url = new URL(row.targetUrl);
    const res = NextResponse.redirect(url, 302);
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || "Gagal memproses shortlink" }, { status: 500 });
  }
}
