import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest) {
  try {
    const count = await prisma.productCategory.count();
    if (count === 0) {
      await prisma.productCategory.createMany({ data: [
        { name: 'Elektronik', code: 'ELK', description: 'Perangkat elektronik' },
        { name: 'Fashion', code: 'FSH', description: 'Pakaian dan aksesoris' },
        { name: 'Furnitur', code: 'FRN', description: 'Perabot rumah' },
      ]});
    }
    const rows = await prisma.productCategory.findMany({ orderBy: { name: 'asc' } });
    return NextResponse.json(rows);
  } catch (e:any) { return NextResponse.json({ error: e?.message || 'Gagal' }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, code, description, parentId } = body;
    if (!name || !code) return NextResponse.json({ error: 'Nama dan kode wajib' }, { status: 400 });
    const row = await prisma.productCategory.create({ data: { name, code: String(code).toUpperCase().slice(0,3), description: description || null, parentId: parentId || null } });
    return NextResponse.json(row, { status: 201 });
  } catch (e:any) { return NextResponse.json({ error: e?.message || 'Gagal' }, { status: 500 }); }
}
