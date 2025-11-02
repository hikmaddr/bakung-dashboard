import { NextResponse } from "next/server";
import { generateNextNumber } from "@/lib/documentNumber";
import { getActiveBrandProfile } from "@/lib/brand";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const dateParam = url.searchParams.get("date");
    let dt: Date;
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      const [y, m, d] = dateParam.split("-").map((v) => Number(v));
      dt = new Date(y, (m || 1) - 1, d || 1);
    } else {
      dt = dateParam ? new Date(dateParam) : new Date();
    }
    const active = await getActiveBrandProfile();
    const orderNumber = await generateNextNumber("salesOrder", { brandProfileId: active?.id ?? undefined, date: dt });
    return NextResponse.json({ success: true, data: { orderNumber } });
  } catch (error) {
    console.error("GET /api/sales-orders/new-number error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Gagal menghasilkan nomor sales order",
      },
      { status: 500 }
    );
  }
}
