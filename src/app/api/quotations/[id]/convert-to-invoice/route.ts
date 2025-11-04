import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveBrandProfile, resolveAllowedBrandIds } from "@/lib/brand";
import { getAuth } from "@/lib/auth";
import { upsertInvoiceFromQuotation } from "@/services/salesService";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuth();
    const allowedBrandIds = await resolveAllowedBrandIds(
      auth?.userId ?? null,
      (auth?.roles as string[]) ?? [],
      []
    );

    const { id } = await params;
    const qid = Number(id);

    try {
      const result = await upsertInvoiceFromQuotation(qid, {
        allowedBrandIds,
        onlyCreativeScope: true,
      });

      if (result.action === "created") {
        return NextResponse.json({
          success: true,
          message: "Quotation berhasil disalin ke Invoice.",
          data: result.invoice,
        });
      }

      if (result.action === "updated") {
        return NextResponse.json({
          success: true,
          message: "Perubahan quotation tersinkron ke Invoice yang sudah ada.",
          data: result.invoice,
        });
      }

      return NextResponse.json(
        { success: false, message: result.reason ?? "Tidak ada perubahan" },
        { status: 409 }
      );
    } catch (err: any) {
      const statusCode = typeof err?.statusCode === "number" ? err.statusCode : undefined;
      if (statusCode === 403) {
        return NextResponse.json(
          { success: false, message: String(err?.message || "Akses ditolak") },
          { status: 403 }
        );
      }
      throw err;
    }
  } catch (error) {
    console.error("convert-to-invoice error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal salin ke Invoice" },
      { status: 500 }
    );
  }
}
