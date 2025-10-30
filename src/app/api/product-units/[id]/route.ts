import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";

const FILE_PATH = join(process.cwd(), "public", "uploads", "product-units.json");

async function readUnits() {
  try {
    const buf = await readFile(FILE_PATH, "utf8");
    return JSON.parse(buf);
  } catch {
    return [];
  }
}

async function writeUnits(units: any[]) {
  await writeFile(FILE_PATH, JSON.stringify(units, null, 2), "utf8");
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isFinite(idNum)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  const units = await readUnits();
  const found = units.find((u: any) => Number(u.id) === idNum);
  if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(found);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isFinite(idNum)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  try {
    const body = await req.json();
    const name = String(body?.name || "").trim();
    const symbol = String(body?.symbol || "").trim();
    const description = body?.description?.trim?.() || null;
    if (!name || !symbol) return NextResponse.json({ error: "Satuan dan simbol wajib" }, { status: 400 });
    const units = await readUnits();
    const idx = units.findIndex((u: any) => Number(u.id) === idNum);
    if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });
    units[idx] = { ...units[idx], name, symbol, description };
    await writeUnits(units);
    return NextResponse.json(units[idx]);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Gagal memperbarui" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isFinite(idNum)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  const units = await readUnits();
  const exists = units.some((u: any) => Number(u.id) === idNum);
  if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const filtered = units.filter((u: any) => Number(u.id) !== idNum);
  await writeUnits(filtered);
  return NextResponse.json({ success: true });
}

