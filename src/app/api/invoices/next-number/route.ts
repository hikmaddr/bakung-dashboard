import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const dateParam = req.nextUrl.searchParams.get("date");
    const dt = dateParam ? new Date(dateParam) : new Date();
    const year = dt.getFullYear();
    const base = `INV-${year}`;
    const count = await prisma.invoice.count({
      where: { invoiceNumber: { startsWith: base } },
    });
    return NextResponse.json({ number: `${base}-${String(count + 1).padStart(4, "0")}` });
  } catch (e) {
    console.error("GET /api/invoices/next-number error:", e);
    return NextResponse.json({ error: "Gagal menghitung nomor" }, { status: 500 });
  }
}

