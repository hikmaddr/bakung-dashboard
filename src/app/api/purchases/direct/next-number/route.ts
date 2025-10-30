import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

function firstDayOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function firstDayOfNextMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}

export async function GET(req: NextRequest) {
  try {
    const dateStr = req.nextUrl.searchParams.get("date");
    const date = dateStr ? new Date(dateStr) : new Date();
    const start = firstDayOfMonth(date);
    const end = firstDayOfNextMonth(date);

    const count = await prisma.purchaseDirect.count({
      where: { date: { gte: start, lt: end } },
    });

    const y = String(date.getFullYear());
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const seq = String(count + 1).padStart(4, "0");
    const number = `PL-${y}${m}-${seq}`;
    return NextResponse.json({ success: true, number });
  } catch (e) {
    return NextResponse.json({ success: false, message: "Gagal generate nomor" }, { status: 500 });
  }
}

