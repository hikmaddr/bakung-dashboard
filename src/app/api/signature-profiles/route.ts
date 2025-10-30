"use server";

import { NextRequest, NextResponse } from "next/server";
import { access, mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";

const DATA_DIR = join(process.cwd(), "public", "uploads");
const FILE_PATH = join(DATA_DIR, "signature-profiles.json");

type SignatureProfile = {
  id: number;
  name: string;
  title?: string;
  imageUrl: string;
  createdAt: string;
};

async function ensureStore() {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    await access(FILE_PATH);
  } catch {
    const seed: SignatureProfile[] = [];
    await writeFile(FILE_PATH, JSON.stringify(seed, null, 2), "utf8");
  }
}

async function readProfiles(): Promise<SignatureProfile[]> {
  await ensureStore();
  const raw = await readFile(FILE_PATH, "utf8");
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeProfiles(profiles: SignatureProfile[]) {
  await writeFile(FILE_PATH, JSON.stringify(profiles, null, 2), "utf8");
}

export async function GET() {
  try {
    const profiles = await readProfiles();
    return NextResponse.json({ success: true, data: profiles });
  } catch (error) {
    console.error("[signature-profiles] GET error", error);
    return NextResponse.json(
      { success: false, error: "Gagal memuat signature profiles." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = String(body?.name || "").trim();
    const title = String(body?.title || "").trim();
    const imageUrl = String(body?.imageUrl || "").trim();

    if (!name || !imageUrl) {
      return NextResponse.json(
        { success: false, error: "Nama dan file signature wajib diisi." },
        { status: 400 }
      );
    }

    const profiles = await readProfiles();
    const now = Date.now();
    const newProfile: SignatureProfile = {
      id: now,
      name,
      title: title || undefined,
      imageUrl,
      createdAt: new Date(now).toISOString(),
    };
    profiles.push(newProfile);
    await writeProfiles(profiles);

    return NextResponse.json({ success: true, data: newProfile });
  } catch (error) {
    console.error("[signature-profiles] POST error", error);
    return NextResponse.json(
      { success: false, error: "Gagal menyimpan signature profile." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const idParam = url.searchParams.get("id");
    const id = Number(idParam);
    if (!id) {
      return NextResponse.json({ success: false, error: "ID tidak valid." }, { status: 400 });
    }

    const profiles = await readProfiles();
    const nextProfiles = profiles.filter((profile) => profile.id !== id);
    await writeProfiles(nextProfiles);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[signature-profiles] DELETE error", error);
    return NextResponse.json(
      { success: false, error: "Gagal menghapus signature profile." },
      { status: 500 }
    );
  }
}

