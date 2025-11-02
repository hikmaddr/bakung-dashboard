import { NextRequest, NextResponse } from "next/server";
import { saveFile } from "@/lib/storage";

export async function POST(request: NextRequest) {
  try {
    const data = await request.formData();
    const file: File | null = data.get("avatar") as unknown as File;

    if (!file) {
      return NextResponse.json({ success: false, error: "No file received." }, { status: 400 });
    }

    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/svg+xml",
    ];

    const result = await saveFile(file, {
      prefix: "avatars/",
      allowedContentTypes: allowedTypes,
      maxSizeBytes: 5 * 1024 * 1024,
    });

    return NextResponse.json({ success: true, url: result.url, message: "Avatar uploaded successfully" });
  } catch (error: any) {
    const msg = String(error?.message || error);
    console.error("Error uploading avatar:", msg);
    const isValidation = /File type not allowed|File too large|No file received/i.test(msg);
    const status = isValidation ? 400 : 500;
    return NextResponse.json({ success: false, error: msg }, { status });
  }
}
