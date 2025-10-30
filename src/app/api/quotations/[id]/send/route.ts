import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/quotations/[id]/send -> set status to "Sent"
export async function POST(
  _req: NextRequest,
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

    const updated = await prisma.quotation.update({
      where: { id: qid },
      data: { status: "Sent" },
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

