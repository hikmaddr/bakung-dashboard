import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveBrandProfile, resolveAllowedBrandIds } from "@/lib/brand";
import { getAuth } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { saveFile } from "@/lib/storage";

async function saveAttachments(formData: FormData) {
  const files: File[] = [];
  const attachments: { url: string; name: string; type: string }[] = [];
  for (const [key, value] of formData.entries()) {
    if (key === "attachments" && value instanceof File) files.push(value);
  }
  for (const f of files) {
    const result = await saveFile(f, {
      prefix: "attachments/",
      maxSizeBytes: 20 * 1024 * 1024,
    });
    attachments.push({ url: result.url, name: f.name, type: f.type });
  }
  return attachments;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    const auth = await getAuth();
    const allowedBrandIds = await resolveAllowedBrandIds(
      auth?.userId ?? null,
      (auth?.roles as string[]) ?? [],
      []
    );
    const data = await prisma.purchaseDirect.findFirst({ where: { id, brandProfileId: allowedBrandIds.length ? { in: allowedBrandIds } : undefined }, include: { items: true } });
    if (!data) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || "Gagal memuat detail" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  try {
    const auth = await getAuth();
    const brand = await getActiveBrandProfile();
    const allowedBrandIds = await resolveAllowedBrandIds(
      auth?.userId ?? null,
      (auth?.roles as string[]) ?? [],
      []
    );
    const inScope = await prisma.purchaseDirect.findFirst({ where: { id, brandProfileId: allowedBrandIds.length ? { in: allowedBrandIds } : undefined }, select: { id: true, brandProfileId: true, purchaseNumber: true } });
    if (!inScope) {
      return NextResponse.json({ success: false, message: "Forbidden: brand scope" }, { status: 403 });
    }
    // Soft delete: tandai record tanpa mengubah stok atau item
    await prisma.purchaseDirect.update({ where: { id }, data: { isDeleted: true, deletedAt: new Date() } });
    try {
      await logActivity(req, {
        userId: auth?.userId || null,
        action: "PURCHASE_DELETE_SOFT",
        entity: "purchase_direct",
        entityId: id,
        metadata: { brandProfileId: brand?.id || null }
      });
    } catch {}
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || "Gagal hapus" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  try {
    const auth = await getAuth();
    const allowedBrandIds = await resolveAllowedBrandIds(
      auth?.userId ?? null,
      (auth?.roles as string[]) ?? [],
      []
    );
    const inScope = await prisma.purchaseDirect.findFirst({ where: { id, brandProfileId: allowedBrandIds.length ? { in: allowedBrandIds } : undefined }, select: { id: true, brandProfileId: true } });
    if (!inScope) {
      return NextResponse.json({ success: false, message: "Forbidden: brand scope" }, { status: 403 });
    }
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

    // Log update activity
    try {
      await logActivity(req, {
        userId: auth?.userId || null,
        action: "PURCHASE_UPDATE",
        entity: "purchase_direct",
        entityId: id,
        metadata: { total: updated.total, supplierName: updated.supplierName }
      });
    } catch {}

    return NextResponse.json({ success: true, data: updated });
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || "Gagal update" }, { status: 500 });
  }
}
