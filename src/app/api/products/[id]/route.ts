import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import path from "path";
import { writeFile } from "fs/promises";
import crypto from "crypto";

async function saveFile(file: File, productName: string) {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const ext = file.name.split(".").pop();
  const safe = productName.replace(/\s+/g, "_").toLowerCase();
  const unique = `${safe}_${crypto.randomUUID()}.${ext}`;
  const uploadPath = path.join(process.cwd(), "public/uploads", unique);
  await writeFile(uploadPath, buffer);
  return `/uploads/${unique}`;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  try {
    const row = await prisma.product.findUnique({ where: { id: idNum }, include: { category: true } });
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(row);
  } catch (e:any) { return NextResponse.json({ error: e?.message || 'Gagal' }, { status: 500 }); }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  try {
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const fd = await req.formData();
      const sku = fd.get('sku') != null ? String(fd.get('sku')) : undefined;
      const name = fd.get('name') != null ? String(fd.get('name')) : undefined;
      const description = fd.get('description') != null ? String(fd.get('description')) : undefined;
      const categoryId = fd.get('categoryId') != null ? Number(fd.get('categoryId')) : undefined;
      const unit = fd.get('unit') != null ? String(fd.get('unit')) : undefined;
      const buyPrice = fd.get('buyPrice') != null ? Number(fd.get('buyPrice')) : undefined;
      const sellPrice = fd.get('sellPrice') != null ? Number(fd.get('sellPrice')) : undefined;
      const qty = fd.get('qty') != null ? Number(fd.get('qty')) : undefined;
      const file = fd.get('photo') as File | null;
      let imageUrl: string | undefined;
      if (file && (file as any).size) imageUrl = await saveFile(file, (name as string) || (sku as string) || 'product');
      const row = await prisma.product.update({ where: { id: idNum }, data: { sku, name, description, categoryId, unit, buyPrice, sellPrice, qty, imageUrl } });
      return NextResponse.json(row);
    } else {
      const body = await req.json();
      const { sku, name, description, categoryId, unit, buyPrice, sellPrice, qty, imageUrl } = body;
      const row = await prisma.product.update({ where: { id: idNum }, data: { sku, name, description, categoryId, unit, buyPrice, sellPrice, qty, imageUrl } });
      return NextResponse.json(row);
    }
  } catch (e:any) { return NextResponse.json({ error: e?.message || 'Gagal' }, { status: 500 }); }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  try {
    await prisma.product.delete({ where: { id: idNum } });
    return NextResponse.json({ success: true });
  } catch (e:any) { return NextResponse.json({ error: e?.message || 'Gagal' }, { status: 500 }); }
}
