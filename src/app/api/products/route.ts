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

export async function GET(_req: NextRequest) {
  try {
    const rows = await prisma.product.findMany({ orderBy: { createdAt: "desc" }, include: { category: true } });
    return NextResponse.json(rows);
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || 'Gagal mengambil data' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const fd = await req.formData();
      const sku = String(fd.get('sku')||'');
      const name = String(fd.get('name')||'');
      const description = String(fd.get('description')||'');
      const categoryId = fd.get('categoryId') ? Number(fd.get('categoryId')) : null;
      const unit = String(fd.get('unit')||'pcs');
      const buyPrice = Number(fd.get('buyPrice')||0);
      const sellPrice = Number(fd.get('sellPrice')||0);
      const qty = Number(fd.get('qty')||0);
      const file = fd.get('photo') as File | null;
      let imageUrl: string|undefined = undefined;
      if (file && (file as any).size) imageUrl = await saveFile(file, name || sku || 'product');
      const row = await prisma.product.create({ data: { sku, name, description: description || null, categoryId: categoryId || undefined, unit, buyPrice, sellPrice, qty, imageUrl } });
      return NextResponse.json(row, { status: 201 });
    } else {
      const body = await req.json();
      const { sku, name, description, categoryId, unit = 'pcs', buyPrice = 0, sellPrice = 0, qty = 0, imageUrl } = body;
      const row = await prisma.product.create({ data: { sku, name, description, categoryId, unit, buyPrice, sellPrice, qty, imageUrl } });
      return NextResponse.json(row, { status: 201 });
    }
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || 'Gagal menyimpan' }, { status: 500 });
  }
}

