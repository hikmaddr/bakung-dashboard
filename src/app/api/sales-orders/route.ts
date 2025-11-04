import { NextResponse, type NextRequest } from "next/server";
export const revalidate = 60;
import { prisma } from "@/lib/prisma";
import { getActiveBrandProfile, resolveAllowedBrandIds } from "@/lib/brand";
import { getAuth } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { normalizeSalesOrderItems, computeSalesOrderTotals, parseDateInput, createSalesOrder } from "@/services/salesService";
export const runtime = "nodejs";



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

    const normalizedItems = normalizeSalesOrderItems(items);
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

    const totals = computeSalesOrderTotals(normalizedItems, extraDiscount, taxMode);
    const resolvedQuotationId = parseOptionalNumber(quotationId);

    // Gunakan brand aktif dan batasi sesuai izin pengguna
    const auth = await getAuth();
    const brand = await getActiveBrandProfile();
    if (!brand?.id) return NextResponse.json({ success: false, message: "Brand aktif tidak ditemukan" }, { status: 400 });
    const allowedBrandIds = await resolveAllowedBrandIds(auth?.userId ?? null, (auth?.roles as string[]) ?? [], []);
    if (!allowedBrandIds.includes(brand.id)) return NextResponse.json({ success: false, message: "Forbidden: brand scope" }, { status: 403 });

    const order = await createSalesOrder({
      brandId: brand.id,
      customerId: parsedCustomerId,
      items: normalizedItems,
      extraDiscount,
      taxMode,
      date: parsedDate,
      quotationId: resolvedQuotationId,
      orderNumber: typeof orderNumber === "string" ? orderNumber : null,
      status,
      notes,
    });

    // Catat aktivitas pembuatan sales order
    try {
      await logActivity(req, {
        userId: auth?.userId || null,
        action: "SALES_ORDER_CREATE",
        entity: "sales_order",
        entityId: order.id,
        metadata: {
          brandProfileId: brand.id,
          orderNumber: order.orderNumber,
          totalAmount: order.totalAmount,
          customerId: order.customerId,
          quotationId: order.quotationId || null,
          status: order.status,
        },
      });
    } catch {}

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
