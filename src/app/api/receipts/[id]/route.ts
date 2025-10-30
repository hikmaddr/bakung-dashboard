import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (!Number.isFinite(id)) return NextResponse.json({ success: false, message: "ID tidak valid" }, { status: 400 });
    const receipt = await prisma.receipt.findUnique({ where: { id }, include: { payment: true } });
    if (!receipt) return NextResponse.json({ success: false, message: "Receipt tidak ditemukan" }, { status: 404 });
    return NextResponse.json({ success: true, data: receipt });
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || "Gagal memuat receipt" }, { status: 500 });
  }
}

