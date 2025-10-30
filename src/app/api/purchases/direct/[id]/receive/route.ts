import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuth } from "@/lib/auth";
import { getActiveBrandProfile, resolveAllowedBrandIds } from "@/lib/brand";
import { logActivity } from "@/lib/activity";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const auth = await getAuth();
  const brand = await getActiveBrandProfile();
  const purchase = await prisma.purchaseDirect.findFirst({ where: { id }, include: { items: true } });
  if (!purchase) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });
  // Brand guard: ensure the purchase belongs to allowed brand scope
  const allowedBrandIds = await resolveAllowedBrandIds(auth?.userId ?? null, (auth?.roles as string[]) ?? [], []);
  if (purchase.brandProfileId != null && !allowedBrandIds.includes(purchase.brandProfileId)) {
    return NextResponse.json({ success: false, message: "Forbidden: brand scope" }, { status: 403 });
  }
  if (purchase.status === "Received") return NextResponse.json({ success: true, data: purchase });

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Update status
      const updated = await tx.purchaseDirect.update({
        where: { id },
        data: { status: "Received", receivedAt: new Date() },
        include: { items: true },
      });

      // Apply stock mutations
      for (const it of updated.items) {
        if (!it.productId || it.qty === 0) continue;
        // increment product qty when trackStock=true or always? We'll increment if trackStock true
        const product = await tx.product.findFirst({ where: { id: it.productId } });
        if (!product) continue;
        if (product.trackStock) {
          await tx.product.update({ where: { id: product.id }, data: { qty: { increment: it.qty } } });
          await tx.stockMutation.create({
            data: {
              productId: product.id,
              qty: it.qty,
              type: "IN",
              refTable: "purchasedirect",
              refId: id,
              note: `Pembelian Langsung ${updated.purchaseNumber}`,
              brandProfileId: brand?.id || null,
              createdByUserId: auth?.userId || null,
            },
          });
        }
      }

      return updated;
    });
    // Log important transaction
    try {
      await logActivity(req, {
        userId: auth?.userId || null,
        action: "PURCHASE_RECEIVE",
        entity: "purchase_direct",
        entityId: id,
        metadata: {
          brandProfileId: brand?.id || null,
          purchaseNumber: result.purchaseNumber,
          receivedAt: result.receivedAt,
        },
      });
    } catch {}
    return NextResponse.json({ success: true, data: result });
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || "Gagal tandai diterima" }, { status: 500 });
  }
}
