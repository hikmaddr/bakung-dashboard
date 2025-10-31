import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuth } from "@/lib/auth";
import { resolveAllowedBrandIds } from "@/lib/brand";
import { logActivity } from "@/lib/activity";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const numericId = Number(id);
    const auth = await getAuth();
    const allowedBrandIds = await resolveAllowedBrandIds(auth?.userId ?? null, (auth?.roles as string[]) ?? [], []);
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: Number.isFinite(numericId) ? numericId : -1,
        brandProfileId: allowedBrandIds.length ? { in: allowedBrandIds } : undefined,
      },
      include: { customer: true, items: true, quotation: true },
    });
    if (!invoice) return NextResponse.json({ success: false, message: "Invoice tidak ditemukan" }, { status: 404 });
    return NextResponse.json({ success: true, data: invoice });
  } catch (e) {
    console.error("GET /api/invoices/[id] error:", e);
    return NextResponse.json({ success: false, message: "Gagal mengambil invoice" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const numericId = Number(id);
    const body = await req.json();
    const { status, downPayment, deletedAt } = body as { status?: string; downPayment?: number; deletedAt?: string | null };
    const auth = await getAuth();
    const allowedBrandIds = await resolveAllowedBrandIds(auth?.userId ?? null, (auth?.roles as string[]) ?? [], []);

    const existing = await prisma.invoice.findFirst({
      where: {
        id: Number.isFinite(numericId) ? numericId : -1,
        brandProfileId: allowedBrandIds.length ? { in: allowedBrandIds } : undefined,
      },
      select: { id: true, brandProfileId: true, invoiceNumber: true, total: true },
    });
    if (!existing) return NextResponse.json({ success: false, message: "Invoice tidak ditemukan" }, { status: 404 });

    const data: any = {};
    if (typeof status === "string" && status.trim()) data.status = status.trim();
    if (downPayment != null) data.downPayment = Number(downPayment) || 0;
    if (Object.prototype.hasOwnProperty.call(body, 'deletedAt')) {
      // Unarchive when null; otherwise set specific date if valid
      if (deletedAt === null) data.deletedAt = null;
      else if (typeof deletedAt === 'string') {
        const d = new Date(deletedAt);
        if (!isNaN(d.getTime())) data.deletedAt = d;
      }
    }

    const updated = await prisma.invoice.update({ where: { id: existing.id }, data });

    try {
      await logActivity(req, {
        userId: auth?.userId || null,
        action: Object.prototype.hasOwnProperty.call(body, 'deletedAt') ? (deletedAt === null ? "INVOICE_UNARCHIVE" : "INVOICE_UPDATE") : "INVOICE_UPDATE",
        entity: "invoice",
        entityId: existing.id,
        metadata: { invoiceNumber: existing.invoiceNumber, ...data },
      });
    } catch {}

    return NextResponse.json({ success: true, data: updated });
  } catch (e) {
    console.error("PATCH /api/invoices/[id] error:", e);
    return NextResponse.json({ success: false, message: "Gagal menyimpan perubahan" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const numericId = Number(id);
    const auth = await getAuth();
    const allowedBrandIds = await resolveAllowedBrandIds(auth?.userId ?? null, (auth?.roles as string[]) ?? [], []);
    const existing = await prisma.invoice.findFirst({
      where: {
        id: Number.isFinite(numericId) ? numericId : -1,
        brandProfileId: allowedBrandIds.length ? { in: allowedBrandIds } : undefined,
      },
      select: { id: true, brandProfileId: true, invoiceNumber: true },
    });
    if (!existing) return NextResponse.json({ success: false, message: "Invoice tidak ditemukan" }, { status: 404 });

    await prisma.invoice.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });

    try {
      await logActivity(req, {
        userId: auth?.userId || null,
        action: "INVOICE_DELETE_SOFT",
        entity: "invoice",
        entityId: existing.id,
        metadata: { invoiceNumber: existing.invoiceNumber },
      });
    } catch {}

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE /api/invoices/[id] error:", e);
    return NextResponse.json({ success: false, message: "Gagal menghapus (arsip) invoice" }, { status: 500 });
  }
}
