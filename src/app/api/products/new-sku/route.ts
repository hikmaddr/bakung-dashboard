import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const codeRaw = (req.nextUrl.searchParams.get('code') || '').toUpperCase().replace(/[^A-Z0-9]/g,'');
    if (!codeRaw || codeRaw.length < 2) return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
    const code = codeRaw.slice(0,3);
    const count = await prisma.product.count({ where: { sku: { startsWith: code } } });
    const next = `${code}${String(count + 1).padStart(4,'0')}`;
    return NextResponse.json({ sku: next });
  } catch (e:any) { return NextResponse.json({ error: e?.message || 'Gagal' }, { status: 500 }); }
}

