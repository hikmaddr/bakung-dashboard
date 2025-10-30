import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest) {
  try {
    const year = new Date().getFullYear();
    const base = `QUO-${year}`;
    const count = await prisma.quotation.count({
      where: { quotationNumber: { startsWith: base } },
    });
    const quotationNumber = `${base}-${String(count + 1).padStart(4, "0")}`;
    return NextResponse.json({ quotationNumber });
  } catch (e) {
    console.error("GET /api/quotations/new-number error:", e);
    return NextResponse.json({ error: "Gagal menghitung nomor" }, { status: 500 });
  }
}

