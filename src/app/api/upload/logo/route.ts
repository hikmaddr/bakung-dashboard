import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { saveFile } from "@/lib/storage";

export async function POST(request: NextRequest) {
  try {
    const data = await request.formData();
    const file: File | null = data.get("logo") as unknown as File;

    if (!file) {
      return NextResponse.json({ error: "No file received." }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "image/svg+xml"];

    const result = await saveFile(file, {
      prefix: "logos/",
      allowedContentTypes: allowedTypes,
      maxSizeBytes: 5 * 1024 * 1024,
    });

    return NextResponse.json({
      success: true,
      url: result.url,
      message: "Logo uploaded successfully",
    });

  } catch (error) {
    console.error("Error uploading logo:", error);
    return NextResponse.json({ error: "Failed to upload logo." }, { status: 500 });
  }
}
