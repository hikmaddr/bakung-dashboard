import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, mkdir, access } from "fs/promises";
import { join } from "path";

const DATA_DIR = join(process.cwd(), "public", "uploads");
const FILE_PATH = join(DATA_DIR, "product-units.json");

async function ensureDataFile() {
  try { await mkdir(DATA_DIR, { recursive: true }); } catch {}
  try { await access(FILE_PATH); } catch {
    const seed = [
      { id: 1, name: "pcs", symbol: "pcs", description: null },
      { id: 2, name: "Potong", symbol: "PTG", description: null },
      { id: 3, name: "Ekor", symbol: "EKOR", description: null },
      { id: 4, name: "meter", symbol: "meter", description: null },
      { id: 5, name: "GALN", symbol: "GLN", description: null },
      { id: 6, name: "TBG", symbol: "TBG", description: null },
      { id: 7, name: "GL", symbol: "GL", description: null },
      { id: 8, name: "BTNG", symbol: "BTNG", description: null },
    ];
    await writeFile(FILE_PATH, JSON.stringify(seed, null, 2), "utf8");
  }
}

async function readUnits() {
  await ensureDataFile();
  const buf = await readFile(FILE_PATH, "utf8");
  try { return JSON.parse(buf); } catch { return []; }
}

async function writeUnits(units: any[]) {
  await writeFile(FILE_PATH, JSON.stringify(units, null, 2), "utf8");
}

export async function GET(_req: NextRequest) {
  try {
    const units = await readUnits();
    return NextResponse.json(units);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Gagal mengambil data" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = String(body?.name || "").trim();
    const symbol = String(body?.symbol || "").trim();
    const description = body?.description?.trim?.() || null;
    if (!name || !symbol) return NextResponse.json({ error: "Satuan dan simbol wajib" }, { status: 400 });
    const units = await readUnits();
    const nextId = units.length ? Math.max(...units.map((u: any) => Number(u.id) || 0)) + 1 : 1;
    const created = { id: nextId, name, symbol, description };
    units.push(created);
    await writeUnits(units);
    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Gagal menyimpan data" }, { status: 500 });
  }
}

