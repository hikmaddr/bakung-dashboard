import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveBrandProfile, resolveAllowedBrandIds } from "@/lib/brand";
import { getAuth } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

// Purge invoices that were soft-deleted more than N days ago (default 30)
export async function POST(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const daysParam = sp.get("days");
    const days = Number(daysParam || 30);
    const safeDays = Number.isFinite(days) && days > 0 ? days : 30;

    const now = new Date();
    const cutoff = new Date(now.getTime() - safeDays * 24 * 60 * 60 * 1000);

    const auth = await getAuth();
    const brand = await getActiveBrandProfile();
    if (!brand?.id) return NextResponse.json({ success: false, message: "Brand aktif tidak ditemukan" }, { status: 400 });
    const allowedBrandIds = await resolveAllowedBrandIds(auth?.userId ?? null, (auth?.roles as string[]) ?? [], []);
    if (!allowedBrandIds.includes(brand.id)) return NextResponse.json({ success: false, message: "Forbidden: brand scope" }, { status: 403 });

    const result = await prisma.invoice.deleteMany({ where: { brandProfileId: brand.id, deletedAt: { lt: cutoff } } });

    try {
      await logActivity(req, {
        userId: auth?.userId || null,
        action: "INVOICE_PURGE_SOFT_DELETE",
        entity: "invoice",
        entityId: null,
        metadata: { brandId: brand.id, purgedCount: result.count, cutoff: cutoff.toISOString(), days: safeDays },
      });
    } catch {}

    return NextResponse.json({ success: true, data: { purged: result.count, days: safeDays } });
  } catch (e) {
    console.error("POST /api/invoices/purge error:", e);
    return NextResponse.json({ success: false, message: "Gagal purge invoice terhapus" }, { status: 500 });
  }
}

