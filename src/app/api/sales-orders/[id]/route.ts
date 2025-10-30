import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveBrandProfile, resolveAllowedBrandIds } from "@/lib/brand";
import { getAuth } from "@/lib/auth";
export const runtime = "nodejs";

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

const normalizeItems = (rawItems: unknown[]): NormalizedItem[] =>
  rawItems.map((raw) => {
    const item = raw as Record<string, unknown>;
    const qRaw = Number(
      typeof item.quantity !== "undefined" ? item.quantity : item.qty ?? 0
    ) || 0;
    const quantity = Math.max(0, Math.round(qRaw));
    const price = Math.max(0, Number(item.price) || 0);
    const subtotal = quantity * price;
    const discount = Math.min(
      subtotal,
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
      subtotal,
    };
  });

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
  if (typeof value === "undefined") return undefined;
  if (!value) return undefined;
  const dt = new Date(String(value));
  if (Number.isNaN(dt.getTime())) {
    throw new Error("Format tanggal tidak valid");
  }
  return dt;
};

const parseOptionalNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

/* =========================
 * GET — detail sales order
 * ========================= */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const id = Number(idParam);
    if (Number.isNaN(id)) {
      return NextResponse.json(
        { success: false, message: "ID Sales Order tidak valid" },
        { status: 400 }
      );
    }
    const auth = await getAuth();
    const allowedBrandIds = await resolveAllowedBrandIds(
      auth?.userId ?? null,
      (auth?.roles as string[]) ?? [],
      []
    );
    const order = await prisma.salesOrder.findFirst({
      where: { id, brandProfileId: { in: allowedBrandIds } },
      include: { customer: true, items: true, quotation: true },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, message: "Sales order tidak ditemukan" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: order });
  } catch (error: unknown) {
    console.error("GET /sales-orders/:id error:", error);
    const message =
      typeof error === "object" && error && "message" in error
        ? String((error as any).message)
        : "Gagal ambil detail sales order";
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}

/* ============================================
 * PUT — update status / header / full + items
 * ============================================ */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const id = Number(idParam);
    if (Number.isNaN(id)) {
      return NextResponse.json(
        { success: false, message: "ID Sales Order tidak valid" },
        { status: 400 }
      );
    }

    // Brand guard: ensure this SO belongs to allowed brands
    const authGuard = await getAuth();
    const allowedBrandIdsGuard = await resolveAllowedBrandIds(
      authGuard?.userId ?? null,
      (authGuard?.roles as string[]) ?? [],
      []
    );
    const existsInScope = await prisma.salesOrder.findFirst({
      where: { id, brandProfileId: { in: allowedBrandIdsGuard } },
      select: { id: true, brandProfileId: true },
    });
    if (!existsInScope) {
      return NextResponse.json(
        { success: false, message: "Forbidden: brand scope" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      orderNumber,
      customerId,
      date,
      status,
      items,
      notes,
      quotationId,
      extraDiscount = 0,
      taxMode = "none",
    } = body ?? {};

    if (typeof items === "undefined") {
      const dataToUpdate: Record<string, unknown> = {};

      if (typeof orderNumber !== "undefined") {
        dataToUpdate.orderNumber = String(orderNumber);
      }

      if (typeof customerId !== "undefined") {
        const parsed = Number(customerId);
        if (Number.isNaN(parsed)) {
          return NextResponse.json(
            { success: false, message: "Customer ID tidak valid" },
            { status: 400 }
          );
        }
        dataToUpdate.customerId = parsed;
      }

      if (typeof date !== "undefined") {
        const parsedDate = parseDateInput(date);
        if (!parsedDate) {
          return NextResponse.json(
            { success: false, message: "Format tanggal tidak valid" },
            { status: 400 }
          );
        }
        dataToUpdate.date = parsedDate;
      }

      if (typeof status !== "undefined") {
        dataToUpdate.status = String(status);
      }

      if (typeof notes !== "undefined") {
        dataToUpdate.notes =
          typeof notes === "string" && notes.trim().length > 0
            ? notes.trim()
            : null;
      }

      if (typeof quotationId !== "undefined") {
        dataToUpdate.quotationId = parseOptionalNumber(quotationId);
      }

      if (Object.keys(dataToUpdate).length === 0) {
        return NextResponse.json(
          { success: false, message: "Tidak ada perubahan yang dikirim" },
          { status: 400 }
        );
      }

      // If status change impacts stock, handle in a transaction to ensure atomicity
      if (typeof status !== "undefined") {
        const auth = await getAuth();
        const brand = await getActiveBrandProfile();
        const result = await prisma.$transaction(async (tx) => {
          const before = await tx.salesOrder.findUnique({
            where: { id },
            include: { items: true },
          });
          if (!before) throw new Error("Sales order tidak ditemukan");

          const updated = await tx.salesOrder.update({
            where: { id },
            data: dataToUpdate,
            include: { customer: true, items: true, quotation: true },
          });

          const prevStatus = String(before.status || "");
          const newStatus = String(updated.status || "");
          const isShipLike = (s: string) => {
            const x = s.toLowerCase();
            return x === "shipped" || x === "sent" || x === "dikirim";
          };

          // Determine if we need to create OUT mutations (first time shipped)
          if (!isShipLike(prevStatus) && isShipLike(newStatus)) {
            const existingOut = await tx.stockMutation.count({
              where: { refTable: "salesorder", refId: id, type: "OUT" },
            });
            if (existingOut === 0) {
              for (const it of before.items) {
                if (!it.productId || it.quantity === 0) continue;
                const product = await tx.product.findFirst({ where: { id: it.productId } });
                if (!product || !product.trackStock) continue;
                await tx.product.update({ where: { id: product.id }, data: { qty: { decrement: it.quantity } } });
                await tx.stockMutation.create({
                  data: {
                    productId: product.id,
                    qty: it.quantity,
                    type: "OUT",
                    refTable: "salesorder",
                    refId: id,
                    note: `Sales Order ${before.orderNumber || id} dikirim`,
                    brandProfileId: brand?.id || null,
                    createdByUserId: auth?.userId || null,
                  },
                });
              }
            }
          }

          // Rollback if previously shipped but now reverted (create IN reversals)
          if (isShipLike(prevStatus) && !isShipLike(newStatus)) {
            const hadOut = await tx.stockMutation.count({
              where: { refTable: "salesorder", refId: id, type: "OUT" },
            });
            const hadInReversal = await tx.stockMutation.count({
              where: { refTable: "salesorder", refId: id, type: "IN" },
            });
            if (hadOut > 0 && hadInReversal === 0) {
              for (const it of before.items) {
                if (!it.productId || it.quantity === 0) continue;
                const product = await tx.product.findFirst({ where: { id: it.productId } });
                if (!product || !product.trackStock) continue;
                await tx.product.update({ where: { id: product.id }, data: { qty: { increment: it.quantity } } });
                await tx.stockMutation.create({
                  data: {
                    productId: product.id,
                    qty: it.quantity,
                    type: "IN",
                    refTable: "salesorder",
                    refId: id,
                    note: `Reversal pengiriman SO ${before.orderNumber || id}`,
                    brandProfileId: brand?.id || null,
                    createdByUserId: auth?.userId || null,
                  },
                });
              }
            }
          }

          return updated;
        });
        return NextResponse.json({ success: true, message: "Sales order berhasil diperbarui", data: result });
      }

      // Simple update when no status impact
      const updated = await prisma.salesOrder.update({
        where: { id },
        data: dataToUpdate,
        include: { customer: true, items: true, quotation: true },
      });

      return NextResponse.json({
        success: true,
        message: "Sales order berhasil diperbarui",
        data: updated,
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, message: "Items tidak boleh kosong" },
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

    let parsedDate: Date | undefined;
    try {
      parsedDate = parseDateInput(date);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Tanggal tidak valid";
      return NextResponse.json(
        { success: false, message },
        { status: 400 }
      );
    }

    let parsedCustomerId: number | undefined;
    if (typeof customerId !== "undefined") {
      const parsed = Number(customerId);
      if (Number.isNaN(parsed)) {
        return NextResponse.json(
          { success: false, message: "Customer ID tidak valid" },
          { status: 400 }
        );
      }
      parsedCustomerId = parsed;
    }

    const resolvedQuotationId = parseOptionalNumber(quotationId);
    const totals = computeTotals(normalizedItems, extraDiscount, taxMode);

    const updateData: Record<string, unknown> = {
      subtotal: totals.subtotal,
      lineDiscount: totals.lineDiscount,
      extraDiscount: totals.extraDiscount,
      taxMode: totals.taxMode,
      taxAmount: totals.taxAmount,
      totalAmount: totals.totalAmount,
    };

    if (typeof orderNumber !== "undefined") {
      updateData.orderNumber = String(orderNumber);
    }
    if (typeof status !== "undefined") {
      updateData.status = String(status);
    }
    if (typeof notes !== "undefined") {
      updateData.notes =
        typeof notes === "string" && notes.trim().length > 0
          ? notes.trim()
          : null;
    }
    if (typeof parsedCustomerId !== "undefined") {
      updateData.customerId = parsedCustomerId;
    }
    if (typeof parsedDate !== "undefined") {
      updateData.date = parsedDate;
    }
    if (typeof quotationId !== "undefined") {
      updateData.quotationId = resolvedQuotationId;
    }

    const [, updated] = await prisma.$transaction([
      prisma.salesOrderItem.deleteMany({ where: { salesOrderId: id } }),
      prisma.salesOrder.update({
        where: { id },
        data: {
          ...updateData,
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
        include: { customer: true, items: true, quotation: true },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: "Sales order berhasil diperbarui",
      data: updated,
    });
  } catch (error: unknown) {
    console.error("PUT /sales-orders/:id error:", error);
    const message =
      typeof error === "object" && error && "message" in error
        ? String((error as any).message)
        : "Gagal update sales order";
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}

/* =========================
 * DELETE — hapus sales order
 * ========================= */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const id = Number(idParam);
    if (Number.isNaN(id)) {
      return NextResponse.json(
        { success: false, message: "ID Sales Order tidak valid" },
        { status: 400 }
      );
    }

    // Brand guard before deletion
    const auth = await getAuth();
    const allowedBrandIds = await resolveAllowedBrandIds(
      auth?.userId ?? null,
      (auth?.roles as string[]) ?? [],
      []
    );
    const inScope = await prisma.salesOrder.findFirst({
      where: { id, brandProfileId: { in: allowedBrandIds } },
      select: { id: true },
    });
    if (!inScope) {
      return NextResponse.json(
        { success: false, message: "Forbidden: brand scope" },
        { status: 403 }
      );
    }

    await prisma.salesOrderItem.deleteMany({ where: { salesOrderId: id } });
    await prisma.salesOrder.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: "Sales order berhasil dihapus",
    });
  } catch (error: unknown) {
    console.error("DELETE /sales-orders/:id error:", error);
    const message =
      typeof error === "object" && error && "message" in error
        ? String((error as any).message)
        : "Gagal hapus sales order";
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}
