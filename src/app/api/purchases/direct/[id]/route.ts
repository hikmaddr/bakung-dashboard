import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveBrandProfile } from "@/lib/brand";
import { getAuth } from "@/lib/auth";

async function saveAttachments(formData: FormData) {
  const files: File[] = [];
  const attachments: { url: string; name: string; type: string }[] = [];
  for (const [key, value] of formData.entries()) {
    if (key === "attachments" && value instanceof File) files.push(value);
  }
  for (const f of files) {
    const arrayBuffer = await f.arrayBuffer();
    const bytes = Buffer.from(arrayBuffer);
    const ext = f.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const fs = await import("fs");
    const path = await import("path");
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    const fullPath = path.join(uploadDir, fileName);
    fs.writeFileSync(fullPath, bytes);
    attachments.push({ url: `/uploads/${fileName}`, name: f.name, type: f.type });
  }
  return attachments;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    const data = await prisma.purchaseDirect.findFirst({ where: { id }, include: { items: true } });
    if (!data) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || "Gagal memuat detail" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  try {
    const auth = await getAuth();
    const brand = await getActiveBrandProfile();
    await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchaseDirect.findUnique({ where: { id }, include: { items: true } });
      if (!purchase) return;
      // If previously received, rollback stock by creating OUT reversal and decrementing product.qty
      if (purchase.status === "Received") {
        const hadIn = await tx.stockMutation.count({ where: { refTable: "purchasedirect", refId: id, type: "IN" } });
        const hadOutReversal = await tx.stockMutation.count({ where: { refTable: "purchasedirect", refId: id, type: "OUT" } });
        if (hadIn > 0 && hadOutReversal === 0) {
          for (const it of purchase.items) {
            if (!it.productId || it.qty === 0) continue;
            const product = await tx.product.findFirst({ where: { id: it.productId } });
            if (!product || !product.trackStock) continue;
            await tx.product.update({ where: { id: product.id }, data: { qty: { decrement: it.qty } } });
            await tx.stockMutation.create({
              data: {
                productId: product.id,
                qty: it.qty,
                type: "OUT",
                refTable: "purchasedirect",
                refId: id,
                note: `Reversal pembelian ${purchase.purchaseNumber || id} dibatalkan`,
                brandProfileId: brand?.id || null,
                createdByUserId: auth?.userId || null,
              },
            });
          }
        }
      }

      await tx.purchaseDirectItem.deleteMany({ where: { purchaseDirectId: id } });
      await tx.purchaseDirect.delete({ where: { id } });
    });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || "Gagal hapus" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  try {
    let payload: any = {};
    let attachments: any[] | undefined;

    if (req.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await req.formData();
      const itemsRaw = form.get("items") as string | null;
      const uploaded = await saveAttachments(form);
      attachments = uploaded.length ? uploaded : undefined;
      payload = {
        purchaseNumber: (form.get("purchaseNumber") as string) || undefined,
        date: form.get("date") ? new Date(String(form.get("date"))) : undefined,
        supplierName: (form.get("supplierName") as string) || undefined,
        marketplaceOrderId: (form.get("marketplaceOrderId") as string) || undefined,
        notes: (form.get("notes") as string) || undefined,
        shippingCost: form.get("shippingCost") != null ? Number(form.get("shippingCost")) : undefined,
        fee: form.get("fee") != null ? Number(form.get("fee")) : undefined,
        tax: form.get("tax") != null ? Number(form.get("tax")) : undefined,
        items: itemsRaw ? JSON.parse(itemsRaw) : undefined,
      };
    } else {
      payload = await req.json();
      attachments = payload.attachments; // optional override
    }

    // Normalize items and compute totals if items/costs provided
    const itemsProvided = Array.isArray(payload.items) ? payload.items : undefined;
    const itemsNormalized = itemsProvided
      ? payload.items.map((it: any) => ({
          productId: it.productId ?? null,
          name: it.name,
          description: it.description ?? null,
          qty: Number(it.qty || 0),
          unit: it.unit || "pcs",
          unitCost: it.unitCost != null ? Number(it.unitCost) : (it.price != null ? Number(it.price) : 0),
        }))
      : undefined;

    const subtotal = itemsNormalized
      ? itemsNormalized.reduce((sum: number, it: any) => sum + Number(it.qty) * Number(it.unitCost || 0), 0)
      : undefined;
    const shippingCost = payload.shippingCost != null ? Number(payload.shippingCost) : undefined;
    const fee = payload.fee != null ? Number(payload.fee) : undefined;
    const tax = payload.tax != null ? Number(payload.tax) : undefined;
    const total =
      subtotal != null || shippingCost != null || fee != null || tax != null
        ? (subtotal ?? 0) + (shippingCost ?? 0) + (fee ?? 0) + (tax ?? 0)
        : undefined;

    const updated = await prisma.$transaction(async (tx) => {
      if (itemsNormalized) {
        await tx.purchaseDirectItem.deleteMany({ where: { purchaseDirectId: id } });
      }
      return tx.purchaseDirect.update({
        where: { id },
        data: {
          ...(payload.purchaseNumber != null ? { purchaseNumber: payload.purchaseNumber } : {}),
          ...(payload.date != null ? { date: new Date(payload.date) } : {}),
          ...(payload.supplierName != null ? { supplierName: payload.supplierName } : {}),
          ...(payload.marketplaceOrderId != null ? { marketplaceOrderId: payload.marketplaceOrderId } : {}),
          ...(payload.notes != null ? { notes: payload.notes } : {}),
          ...(attachments ? { attachments, proofUrl: attachments[0]?.url || null } : {}),
          ...(subtotal != null ? { subtotal } : {}),
          ...(shippingCost != null ? { shippingCost } : {}),
          ...(fee != null ? { fee } : {}),
          ...(tax != null ? { tax } : {}),
          ...(total != null ? { total } : {}),
          ...(itemsNormalized ? { items: { create: itemsNormalized } } : {}),
        },
        include: { items: true },
      });
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || "Gagal update" }, { status: 500 });
  }
}
