"use server";

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { saveFile } from "@/lib/storage";

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

    const result = await saveFile(file, {
      prefix: "signatures/",
      allowedContentTypes: ALLOWED_TYPES,
      maxSizeBytes: MAX_SIZE,
    });

    return NextResponse.json({ success: true, url: result.url, message: "Signature berhasil diunggah." });
  } catch (error) {
    console.error("[upload/signature] error", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengunggah signature. Silakan coba lagi." },
      { status: 500 }
    );
  }
}
