import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  try {
    const row = await prisma.customer.findUnique({ where: { id: idNum } });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(row);
  } catch (e) {
    console.error("GET /api/customers/[id] error:", e);
    return NextResponse.json({ error: "Gagal mengambil data" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  try {
    const body = await req.json();
    const { pic, email, company, address, phone } = body || {};
    if (!pic || !company || !address || !phone) {
      return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });
    }
    const updated = await prisma.customer.update({
      where: { id: idNum },
      data: { pic, email: email ?? null, company, address, phone },
    });
    return NextResponse.json(updated);
  } catch (e) {
    console.error("PUT /api/customers/[id] error:", e);
    return NextResponse.json({ error: "Gagal memperbarui data" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  try {
    await prisma.customer.delete({ where: { id: idNum } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE /api/customers/[id] error:", e);
    return NextResponse.json({ error: "Gagal menghapus data" }, { status: 500 });
  }
}

