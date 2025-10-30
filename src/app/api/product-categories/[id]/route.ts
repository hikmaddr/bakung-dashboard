import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const idNum = Number(id); if (Number.isNaN(idNum)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  try { const body = await req.json(); const { name, code, description, parentId } = body; const row = await prisma.productCategory.update({ where: { id: idNum }, data: { name, code, description, parentId } }); return NextResponse.json(row); }
  catch (e:any) { return NextResponse.json({ error: e?.message || 'Gagal' }, { status: 500 }); }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const idNum = Number(id); if (Number.isNaN(idNum)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  try { await prisma.product.deleteMany({ where: { categoryId: idNum } }); await prisma.productCategory.delete({ where: { id: idNum } }); return NextResponse.json({ success: true }); }
  catch (e:any) { return NextResponse.json({ error: e?.message || 'Gagal' }, { status: 500 }); }
}
