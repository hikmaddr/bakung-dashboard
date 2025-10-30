import { NextResponse } from "next/server";
import { getActiveBrandProfile } from "@/lib/brand";

// Ensure Node runtime for Prisma usage inside getActiveBrandProfile
export const runtime = "nodejs";

export async function GET() {
  try {
    const brand = await getActiveBrandProfile();
    if (!brand) return NextResponse.json({ message: "Brand tidak ditemukan" }, { status: 404 });
    return NextResponse.json(brand);
  } catch (err: any) {
    console.error("[brand-profiles/active][GET]", err);
    return NextResponse.json({ message: err?.message || "Gagal load brand aktif" }, { status: 500 });
  }
}
