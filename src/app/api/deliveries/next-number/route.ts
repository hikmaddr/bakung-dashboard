import { NextResponse, type NextRequest } from "next/server";
import { generateNextNumber } from "@/lib/documentNumber";
import { createApiHandler } from "@/lib/api-handler";

export const GET = createApiHandler({
  handler: async (req, _, { activeBrand }) => {
    const dateParam = req.nextUrl.searchParams.get("date");
    let dt: Date;
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      const [y, m, d] = dateParam.split("-").map((v) => Number(v));
      dt = new Date(y, (m || 1) - 1, d || 1);
    } else {
      dt = dateParam ? new Date(dateParam) : new Date();
    }
    
    const brandProfileId = activeBrand.id;
    const number = await generateNextNumber("deliveryNote", { brandProfileId, date: dt });
    
    return NextResponse.json({ success: true, deliveryNumber: number, number });
  }
});


