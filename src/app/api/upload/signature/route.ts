"use server";

import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(request: NextRequest) {
  try {
    const data = await request.formData();
    const file = data.get("signature") as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "Tidak ada file yang diunggah." }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: "Format tidak didukung. Unggah file PNG atau JPG." },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { success: false, error: "Ukuran file terlalu besar. Maksimal 5MB." },
        { status: 400 }
      );
    }

    const ext = (() => {
      const nameExt = file.name.split(".").pop();
      if (nameExt) return nameExt.toLowerCase();
      return file.type === "image/png" ? "png" : "jpg";
    })();

    const fileName = `signature_${randomUUID()}.${ext}`;
    const uploadsDir = join(process.cwd(), "public", "uploads", "signatures");
    await mkdir(uploadsDir, { recursive: true });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filePath = join(uploadsDir, fileName);
    await writeFile(filePath, buffer);

    const fileUrl = `/uploads/signatures/${fileName}`;
    return NextResponse.json({ success: true, url: fileUrl, message: "Signature berhasil diunggah." });
  } catch (error) {
    console.error("[upload/signature] error", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengunggah signature. Silakan coba lagi." },
      { status: 500 }
    );
  }
}

