import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ id: string }> };

const parseId = (raw: string) => {
  const idNum = Number(raw);
  return Number.isNaN(idNum) ? null : idNum;
};

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const idNum = parseId(id);
  if (idNum == null) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  try {
    const row = await prisma.customer.findFirst({ where: { id: idNum, deletedAt: null } });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(row);
  } catch (e) {
    console.error("GET /api/customers/[id] error:", e);
    return NextResponse.json({ error: "Gagal mengambil data" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const idNum = parseId(id);
  if (idNum == null) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
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

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const idNum = parseId(id);
  if (idNum == null) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  try {
    await prisma.customer.update({
      where: { id: idNum },
      data: { deletedAt: new Date(), isDeleted: true },
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE /api/customers/[id] error:", e);
    return NextResponse.json({ error: "Gagal menghapus data" }, { status: 500 });
  }
}
