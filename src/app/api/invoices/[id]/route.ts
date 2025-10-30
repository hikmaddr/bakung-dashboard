import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return NextResponse.json({ success: false, message: "Invalid id" }, { status: 400 });
  try {
    const row = await prisma.invoice.findUnique({ where: { id: idNum }, include: { customer: true, items: true, quotation: true } });
    if (!row) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true, data: row });
  } catch (e) {
    return NextResponse.json({ success: false, message: "Gagal mengambil invoice" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return NextResponse.json({ success: false, message: "Invalid id" }, { status: 400 });
  try {
    const body = await req.json();

    // Ambil invoice saat ini untuk menghitung total terbaru ketika DP berubah
    const existing = await prisma.invoice.findUnique({ where: { id: idNum } });
    if (!existing) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });

    const data: any = {};
    if (body.notes !== undefined) data.notes = body.notes ? String(body.notes).slice(0, 191) : null;
    if (body.terms !== undefined) data.terms = body.terms ? String(body.terms).slice(0, 191) : null;

    // Normalisasi DP baru (jika dikirim), jika tidak ada gunakan DP lama
    const newDownPayment = typeof body.downPayment === 'number' ? (Number(body.downPayment) || 0) : (Number(existing.downPayment) || 0);
    if (typeof body.downPayment === 'number') data.downPayment = newDownPayment;

    // Hitung total sebelum DP berdasarkan field yang sudah tersimpan
    const subtotal = Number(existing.subtotal) || 0;
    const lineDiscount = Number(existing.lineDiscount) || 0;
    const baseAfterLine = Math.max(0, subtotal - lineDiscount);
    const extraDiscountType = existing.extraDiscountType || 'amount';
    const extraDiscountValue = Number(existing.extraDiscountValue) || 0;
    const extraDisc = extraDiscountType === 'percent'
      ? Math.round((baseAfterLine * Math.max(0, Math.min(100, extraDiscountValue))) / 100)
      : Math.min(baseAfterLine, Math.max(0, extraDiscountValue));
    const afterExtra = Math.max(0, baseAfterLine - extraDisc);
    const shippingCost = Number(existing.shippingCost) || 0;
    const basePlusShip = Math.max(0, afterExtra + shippingCost);
    const taxMode = existing.taxMode || 'none';
    let taxRate = 0, taxInclusive = false;
    if (taxMode === "ppn_11_inclusive") { taxRate = 11; taxInclusive = true; }
    else if (taxMode === "ppn_11_exclusive") { taxRate = 11; taxInclusive = false; }
    else if (taxMode === "ppn_12_inclusive") { taxRate = 12; taxInclusive = true; }
    else if (taxMode === "ppn_12_exclusive") { taxRate = 12; taxInclusive = false; }
    const taxAmount = taxRate === 0 ? 0 : (taxInclusive ? Math.round((basePlusShip * taxRate) / (100 + taxRate)) : Math.round((basePlusShip * taxRate) / 100));
    const totalBeforeDP = taxInclusive ? basePlusShip : basePlusShip + taxAmount;
    const newTotal = Math.max(0, totalBeforeDP - newDownPayment);

    // Simpan total baru jika DP berubah
    if (typeof body.downPayment === 'number') data.total = newTotal;

    // Atur status: jika total menjadi 0 atau kurang, set Paid (override DP)
    if (newTotal <= 0) {
      data.status = 'Paid';
    } else if (typeof body.status === 'string') {
      data.status = body.status;
    }

    if (Object.keys(data).length === 0) return NextResponse.json({ success: false, message: "No fields to update" }, { status: 400 });

    const updated = await prisma.invoice.update({ where: { id: idNum }, data });
    return NextResponse.json({ success: true, data: updated });
  } catch (e) {
    return NextResponse.json({ success: false, message: "Gagal mengubah invoice" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return NextResponse.json({ success: false, message: "Invalid id" }, { status: 400 });
  try {
    await prisma.invoiceItem.deleteMany({ where: { invoiceId: idNum } });
    await prisma.invoice.delete({ where: { id: idNum } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, message: "Gagal menghapus invoice" }, { status: 500 });
  }
}

// Full update: replace header fields + items
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return NextResponse.json({ success: false, message: "Invalid id" }, { status: 400 });
  try {
    const body = await req.json();
    const {
      invoiceNumber,
      invoiceDate,
      dueDate,
      customerId,
      quotationId,
      items,
      notes,
      terms,
      extraDiscountType = "amount",
      extraDiscountValue = 0,
      shippingCost = 0,
      taxMode = "none",
      downPayment = 0,
      status,
    } = body;

    if (!customerId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, message: "Customer dan items wajib diisi" }, { status: 400 });
    }

    // compute server-side like POST
    const subtotal = items.reduce((acc: number, it: any) => acc + Number(it.qty || 0) * Number(it.price || 0), 0);
    const lineDiscount = items.reduce((acc: number, it: any) => {
      const base = Number(it.qty || 0) * Number(it.price || 0);
      const t = (it.discountType || "percent") === "amount"
        ? Math.max(0, Math.min(base, Number(it.discount) || 0))
        : Math.round((base * Math.max(0, Math.min(100, Number(it.discount) || 0))) / 100);
      return acc + t;
    }, 0);
    const baseAfterLine = Math.max(0, subtotal - lineDiscount);
    const extraDisc = extraDiscountType === "percent"
      ? Math.round((baseAfterLine * Math.max(0, Math.min(100, Number(extraDiscountValue) || 0))) / 100)
      : Math.min(baseAfterLine, Math.max(0, Number(extraDiscountValue) || 0));
    const afterExtra = Math.max(0, baseAfterLine - extraDisc);
    const basePlusShip = Math.max(0, afterExtra + Number(shippingCost || 0));
    let taxRate = 0, taxInclusive = false;
    if (taxMode === "ppn_11_inclusive") { taxRate = 11; taxInclusive = true; }
    else if (taxMode === "ppn_11_exclusive") { taxRate = 11; taxInclusive = false; }
    else if (taxMode === "ppn_12_inclusive") { taxRate = 12; taxInclusive = true; }
    else if (taxMode === "ppn_12_exclusive") { taxRate = 12; taxInclusive = false; }
    const taxAmount = taxRate === 0 ? 0 : (taxInclusive ? Math.round((basePlusShip * taxRate) / (100 + taxRate)) : Math.round((basePlusShip * taxRate) / 100));
    const totalBeforeDP = taxInclusive ? basePlusShip : basePlusShip + taxAmount;
    const total = Math.max(0, totalBeforeDP - Number(downPayment || 0));

    // ensure invoice number uniqueness (if changed)
    if (invoiceNumber) {
      const exists = await prisma.invoice.findFirst({ where: { invoiceNumber, NOT: { id: idNum } } });
      if (exists) {
        return NextResponse.json({ success: false, message: "Nomor invoice sudah digunakan" }, { status: 400 });
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id: idNum },
        data: {
          invoiceNumber: invoiceNumber || undefined,
          issueDate: invoiceDate ? new Date(invoiceDate) : undefined,
          dueDate: dueDate ? new Date(dueDate) : undefined,
          customerId: Number(customerId),
          quotationId: quotationId !== undefined ? (quotationId == null ? null : Number(quotationId)) : undefined,
          notes: notes !== undefined ? (notes ? String(notes).slice(0, 191) : null) : undefined,
          terms: terms !== undefined ? (terms ? String(terms).slice(0, 191) : null) : undefined,
          // Jika total setelah DP = 0, set Paid walaupun status dari client DP
          status: total <= 0 ? 'Paid' : (status || undefined),
          subtotal,
          lineDiscount,
          extraDiscountType,
          extraDiscountValue,
          shippingCost: Number(shippingCost) || 0,
          taxMode,
          taxAmount,
          downPayment: Number(downPayment) || 0,
          total,
        },
      });
      await tx.invoiceItem.deleteMany({ where: { invoiceId: idNum } });
      await tx.invoiceItem.createMany({
        data: items.map((it: any) => ({
          invoiceId: idNum,
          name: String(it.name || ""),
          description: it.description || null,
          qty: Number(it.qty) || 0,
          unit: it.unit || "pcs",
          price: Number(it.price) || 0,
          discount: Number(it.discount) || 0,
          discountType: it.discountType || "percent",
          subtotal: Number(it.qty || 0) * Number(it.price || 0),
        })),
      });
    });

    const updated = await prisma.invoice.findUnique({ where: { id: idNum }, include: { customer: true, items: true } });
    return NextResponse.json({ success: true, data: updated });
  } catch (e) {
    console.error("PUT /api/invoices/[id] error:", e);
    return NextResponse.json({ success: false, message: "Gagal memperbarui invoice" }, { status: 500 });
  }
}
