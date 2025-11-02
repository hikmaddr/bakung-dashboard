import { NextResponse } from "next/server";

export async function GET() {
  const hasToken = !!process.env.BLOB_READ_WRITE_TOKEN;
  return NextResponse.json({
    hasBlobToken: hasToken,
    mode: hasToken ? "blob" : "local-fallback",
  });
}

