import { NextResponse, type NextRequest } from "next/server";
import { generateNextNumber } from "@/lib/documentNumber";
import { getActiveBrandProfile } from "@/lib/brand";

export async function GET(req: NextRequest) {
  try {
    const dateParam = req.nextUrl.searchParams.get("date");
    let dt: Date;
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      const [y, m, d] = dateParam.split("-").map((v) => Number(v));
      dt = new Date(y, (m || 1) - 1, d || 1);
    } else {
      dt = dateParam ? new Date(dateParam) : new Date();
    }
    const brandParam = req.nextUrl.searchParams.get("brandId");
    const brandProfileId = brandParam ? Number(brandParam) : (await getActiveBrandProfile())?.id ?? undefined;
    const number = await generateNextNumber("purchaseInvoice", { brandProfileId, date: dt });
    return NextResponse.json({ number });
  } catch (e) {
    console.error("GET /api/purchases/invoices/next-number error:", e);
    return NextResponse.json({ error: "Gagal menghitung nomor" }, { status: 500 });
  }
}
