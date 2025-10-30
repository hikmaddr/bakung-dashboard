import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveBrandProfile } from "@/lib/brand";
export const runtime = "nodejs";

function generateOrderNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `SO-${year}-${random}`;
}

type NormalizedItem = {
  productId?: number;
  product: string;
  description: string;
  quantity: number;
  unit: string;
  price: number;
  discount: number;
  imageUrl: string | null;
  subtotal: number;
};

const parseTaxMode = (raw: unknown) => {
  switch (raw) {
    case "ppn_11_inclusive":
      return { key: "ppn_11_inclusive" as const, rate: 11, inclusive: true };
    case "ppn_11_exclusive":
      return { key: "ppn_11_exclusive" as const, rate: 11, inclusive: false };
    case "ppn_12_inclusive":
      return { key: "ppn_12_inclusive" as const, rate: 12, inclusive: true };
    case "ppn_12_exclusive":
      return { key: "ppn_12_exclusive" as const, rate: 12, inclusive: false };
    default:
      return { key: "none" as const, rate: 0, inclusive: false };
  }
};

const normalizeItems = (rawItems: unknown[]): NormalizedItem[] => {
  return rawItems.map((raw) => {
    const item = raw as Record<string, unknown>;
    const qRaw = Number(
      typeof item.quantity !== "undefined" ? item.quantity : item.qty ?? 0
    ) || 0;
    const quantity = Math.max(0, Math.round(qRaw));
    const price = Math.max(0, Number(item.price) || 0);
    const baseSubtotal = quantity * price;
    const discount = Math.min(
      baseSubtotal,
      Math.max(0, Number(item.discount) || 0)
    );
    const parsedProductId = Number(
      typeof item.productId !== "undefined" ? item.productId : item.product_id
    );
    const productId =
      Number.isFinite(parsedProductId) && parsedProductId > 0
        ? parsedProductId
        : undefined;

    return {
      productId,
      product: String(item.product || "").trim(),
      description: String(item.description || ""),
      quantity,
      unit: String(item.unit || "pcs"),
      price,
      discount,
      imageUrl: typeof item.imageUrl === "string" ? item.imageUrl : null,
      subtotal: baseSubtotal,
    };
  });
};

const computeTotals = (items: NormalizedItem[], extraDiscountRaw: unknown, taxMode: unknown) => {
  const subtotal = items.reduce((acc, it) => acc + it.subtotal, 0);
  const lineDiscount = items.reduce((acc, it) => acc + it.discount, 0);
  const baseAfterLine = Math.max(0, subtotal - lineDiscount);
  const extraDiscount = Math.min(
    baseAfterLine,
    Math.max(0, Number(extraDiscountRaw) || 0)
  );
  const baseAfterExtra = Math.max(0, baseAfterLine - extraDiscount);
  const taxInfo = parseTaxMode(taxMode);
  const taxAmount =
    taxInfo.rate === 0
      ? 0
      : taxInfo.inclusive
      ? Math.round((baseAfterExtra * taxInfo.rate) / (100 + taxInfo.rate))
      : Math.round((baseAfterExtra * taxInfo.rate) / 100);
  const totalAmount = taxInfo.inclusive
    ? baseAfterExtra
    : baseAfterExtra + taxAmount;

  return {
    subtotal,
    lineDiscount,
    extraDiscount,
    taxMode: taxInfo.key,
    taxAmount,
    totalAmount,
  };
};

const parseDateInput = (value: unknown) => {
  if (!value) return new Date();
  const dt = new Date(value as string);
  if (Number.isNaN(dt.getTime())) {
    throw new Error("Format tanggal tidak valid");
  }
  return dt;
};

const parseOptionalNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

// ✅ GET — ambil semua sales order
export async function GET(req: NextRequest, _ctx: { params: Promise<{}> }) {
  try {
    const active = await getActiveBrandProfile();
    // Parse optional filters
    const sp = req.nextUrl.searchParams;
    const rangeRaw = (sp.get("range") || "").toLowerCase();
    const statusRaw = sp.get("status") || ""; // comma-separated allowed
    const days = (() => {
      const m = rangeRaw.match(/^(\d+)d$/);
      return m ? Number(m[1]) : undefined;
    })();
    const now = new Date();
    const start = days ? new Date(now.getTime() - days * 24 * 60 * 60 * 1000) : undefined;
    const statuses = statusRaw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => !!s);

    const where: any = {};
    if (active?.id) where.brandProfileId = active.id;
    if (start) where.date = { gte: start, lt: now };
    if (statuses.length > 0) where.status = { in: statuses };
    const orders = await prisma.salesOrder.findMany({
      orderBy: { createdAt: "desc" },
      where,
      include: {
        customer: true,
        items: true,
        quotation: true,
      },
    });

    return NextResponse.json({ success: true, data: orders });
  } catch (error) {
    console.error("GET /sales-orders error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal ambil data sales order" },
      { status: 500 }
    );
  }
}

// ✅ POST — buat sales order (manual atau dari quotation)
export async function POST(req: NextRequest, _ctx: { params: Promise<{}> }) {
  try {
    const body = await req.json();
    const {
      orderNumber,
      customerId,
      quotationId,
      status,
      notes,
      items,
      extraDiscount = 0,
      taxMode = "none",
      date,
    } = body ?? {};

    // Accept flexible customer id shapes for better compatibility
    const rawCustomerId =
      typeof customerId !== "undefined"
        ? customerId
        : (body as any)?.customer?.id ?? (body as any)?.customer_id;
    const parsedCustomerId = Number(rawCustomerId);
    if (!Number.isFinite(parsedCustomerId) || parsedCustomerId <= 0) {
      return NextResponse.json(
        { success: false, message: "Customer wajib dipilih" },
        { status: 400 }
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, message: "Minimal satu item diperlukan" },
        { status: 400 }
      );
    }

    const normalizedItems = normalizeItems(items);
    if (normalizedItems.some((item) => !item.product)) {
      return NextResponse.json(
        { success: false, message: "Nama produk/jasa tidak boleh kosong" },
        { status: 400 }
      );
    }

    let parsedDate: Date;
    try {
      parsedDate = parseDateInput(date);
    } catch (err: any) {
      return NextResponse.json(
        { success: false, message: err.message ?? "Tanggal tidak valid" },
        { status: 400 }
      );
    }

    const totals = computeTotals(normalizedItems, extraDiscount, taxMode);
    const resolvedQuotationId = parseOptionalNumber(quotationId);
    const finalOrderNumber =
      typeof orderNumber === "string" && orderNumber.trim().length > 0
        ? orderNumber.trim()
        : generateOrderNumber();

  const order = await prisma.salesOrder.create({
    data: {
      orderNumber: finalOrderNumber,
      date: parsedDate,
      status: status ? String(status) : "Draft",
      notes:
        typeof notes === "string" && notes.trim().length > 0
          ? notes.trim()
          : null,
      customerId: parsedCustomerId,
      quotationId: resolvedQuotationId,
      brandProfileId: (await getActiveBrandProfile())?.id,
      subtotal: totals.subtotal,
      lineDiscount: totals.lineDiscount,
      extraDiscount: totals.extraDiscount,
      taxMode: totals.taxMode,
      taxAmount: totals.taxAmount,
      totalAmount: totals.totalAmount,
      items: {
        create: normalizedItems.map((item) => ({
          product: item.product,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          price: item.price,
          discount: item.discount,
          imageUrl: item.imageUrl,
          subtotal: item.subtotal,
        })),
      },
    },
    include: {
      customer: true,
      items: true,
      quotation: true,
    },
  });

    return NextResponse.json({
      success: true,
      message: "Sales order berhasil dibuat",
      data: order,
    });
  } catch (error: unknown) {
    console.error("POST /sales-orders error:", error);
    const message =
      typeof error === "object" && error && "message" in error
        ? String((error as any).message)
        : "Gagal buat sales order";
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}
