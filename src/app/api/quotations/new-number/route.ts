import { NextResponse, type NextRequest } from "next/server";
import { generateNextNumber } from "@/lib/documentNumber";
import { getActiveBrandProfile } from "@/lib/brand";

export async function GET(req: NextRequest) {
  try {
    const dateParam = req.nextUrl.searchParams.get("date");
    const dt = dateParam ? new Date(dateParam) : new Date();
    const active = await getActiveBrandProfile();
    const quotationNumber = await generateNextNumber("quotation", { brandProfileId: active?.id ?? undefined, date: dt });
    return NextResponse.json({ quotationNumber });
  } catch (e) {
    console.error("GET /api/quotations/new-number error:", e);
    return NextResponse.json({ error: "Gagal menghitung nomor" }, { status: 500 });
  }
}
