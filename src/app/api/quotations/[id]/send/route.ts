import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/quotations/[id]/send -> set status to "Sent via <method>"
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const qid = Number(id);
    if (Number.isNaN(qid)) {
      return NextResponse.json(
        { success: false, message: "ID tidak valid" },
        { status: 400 }
      );
    }

    let via = "";
    try {
      const body = await req.json().catch(() => ({}));
      via = String(body?.via || "").toLowerCase();
    } catch {}

    const statusValue = via === "whatsapp"
      ? "Sent via WhatsApp"
      : via === "email"
      ? "Sent via Email"
      : via === "pdf"
      ? "Sent via PDF"
      : "Sent";

    const updated = await prisma.quotation.update({
      where: { id: qid },
      data: { status: statusValue },
      include: { customer: true, items: true },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (err: any) {
    console.error("POST /api/quotations/[id]/send error:", err);
    return NextResponse.json(
      { success: false, message: err?.message ?? "Gagal mengubah status" },
      { status: 500 }
    );
  }
}
