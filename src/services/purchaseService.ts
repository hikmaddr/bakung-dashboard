import { prisma } from "@/lib/prisma";
import { PurchaseStatus, PurchaseInvoiceStatus } from "@prisma/client";
import { generateNextNumber } from "@/lib/documentNumber";

export type NormalizedPurchaseItem = {
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

export const parseTaxMode = (raw: unknown) => {
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

export const parseDateInput = (value: unknown) => {
  if (!value) return new Date();
  const dt = new Date(value as string);
  if (Number.isNaN(dt.getTime())) {
    throw new Error("Format tanggal tidak valid");
  }
  return dt;
};

export const normalizePurchaseOrderItems = (rawItems: unknown[]): NormalizedPurchaseItem[] => {
  return rawItems.map((raw) => {
    const item = raw as Record<string, unknown>;
    const qRaw = Number(
      typeof item.quantity !== "undefined" ? item.quantity : (item as any).qty ?? 0
    ) || 0;
    const quantity = Math.max(0, Math.round(qRaw));
    const price = Math.max(0, Number(item.price || item.unitCost) || 0);
    const baseSubtotal = quantity * price;
    const discount = Math.min(
      baseSubtotal,
      Math.max(0, Number(item.discount) || 0)
    );
    const parsedProductId = Number(
      typeof item.productId !== "undefined" ? item.productId : (item as any).product_id
    );
    const productId =
      Number.isFinite(parsedProductId) && parsedProductId > 0
        ? parsedProductId
        : undefined;

    return {
      productId,
      product: String(item.product || item.name || "").trim(),
      description: String(item.description || ""),
      quantity,
      unit: String(item.unit || "pcs"),
      price,
      discount,
      imageUrl: typeof item.imageUrl === "string" ? (item.imageUrl as string) : null,
      subtotal: baseSubtotal,
    };
  });
};

export const computePurchaseOrderTotals = (items: NormalizedPurchaseItem[], extraDiscountRaw: unknown, taxMode: unknown) => {
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

export async function createPurchaseOrder(args: {
  brandId: number;
  supplierName: string;
  items: NormalizedPurchaseItem[];
  extraDiscount?: number;
  taxMode?: string;
  date: Date;
  orderNumber?: string | null;
  status?: PurchaseStatus;
  notes?: string | null;
  supplierId?: number | null;
  attachments?: any;
  createdByUserId?: string | null;
}) {
  const {
    brandId,
    supplierName,
    items,
    extraDiscount = 0,
    taxMode = "none",
    date,
    orderNumber,
    status,
    notes = null,
    supplierId = null,
    attachments = [],
    createdByUserId = null,
  } = args;

  const totals = computePurchaseOrderTotals(items, extraDiscount, taxMode);
  const finalOrderNumber =
    typeof orderNumber === "string" && orderNumber.trim().length > 0
      ? orderNumber.trim()
      : await generateNextNumber("purchaseOrder", { brandProfileId: brandId, date });

  const order = await prisma.purchaseOrder.create({
    data: {
      orderNumber: finalOrderNumber,
      date,
      status: status || PurchaseStatus.Draft,
      notes: typeof notes === "string" && notes.trim().length > 0 ? notes.trim() : null,
      supplierId,
      supplierName,
      attachments,
      brandProfileId: brandId,
      createdByUserId,
      subtotal: totals.subtotal,
      lineDiscount: totals.lineDiscount,
      extraDiscount: totals.extraDiscount,
      taxMode: totals.taxMode,
      taxAmount: totals.taxAmount,
      totalAmount: totals.totalAmount,
      items: {
        create: items.map((item) => ({
          product: item.product,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          price: item.price,
          discount: item.discount,
          imageUrl: item.imageUrl,
          subtotal: item.subtotal,
          productId: item.productId,
        })),
      },
    },
    include: { items: true, brand: true },
  });

  return order;
}

export async function updatePurchaseOrder(id: number, args: {
  supplierName?: string;
  supplierId?: number | null;
  items: NormalizedPurchaseItem[];
  extraDiscount?: number;
  taxMode?: string;
  date: Date;
  status?: PurchaseStatus;
  notes?: string | null;
  attachments?: any;
}) {
  const {
    supplierName,
    supplierId,
    items,
    extraDiscount = 0,
    taxMode = "none",
    date,
    status,
    notes,
    attachments,
  } = args;

  const totals = computePurchaseOrderTotals(items, extraDiscount, taxMode);

  const order = await prisma.$transaction(async (tx) => {
    // Delete existing items
    await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });

    // Update main order
    return tx.purchaseOrder.update({
      where: { id },
      data: {
        date,
        status,
        notes: typeof notes === "string" ? notes.trim() : notes,
        supplierId,
        supplierName,
        attachments,
        subtotal: totals.subtotal,
        lineDiscount: totals.lineDiscount,
        extraDiscount: totals.extraDiscount,
        taxMode: totals.taxMode,
        taxAmount: totals.taxAmount,
        totalAmount: totals.totalAmount,
        items: {
          create: items.map((item) => ({
            product: item.product,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            price: item.price,
            discount: item.discount,
            imageUrl: item.imageUrl,
            subtotal: item.subtotal,
            productId: item.productId,
          })),
        },
      },
      include: { items: true },
    });
  });

  return order;
}

export async function createPurchaseInvoiceFromOrder(orderId: number) {
  const order = await prisma.purchaseOrder.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) throw new Error("Purchase Order tidak ditemukan");

  const now = new Date();
  const invoiceNumber = await generateNextNumber("purchaseInvoice", {
    brandProfileId: order.brandProfileId,
    date: now,
  });

  const invoice = await prisma.purchaseInvoice.create({
    data: {
      invoiceNumber,
      date: now,
      dueDate: now,
      status: PurchaseInvoiceStatus.Draft,
      supplierName: order.supplierName ?? "",
      purchaseOrderId: order.id,
      brandProfileId: order.brandProfileId,
      subtotal: order.subtotal,
      tax: order.taxAmount,
      total: order.totalAmount,
      notes: order.notes,
      items: {
        create: order.items.map((item) => ({
          name: item.product,
          description: item.description,
          qty: item.quantity,
          unit: item.unit,
          unitCost: item.price,
          subtotal: item.subtotal,
          productId: item.productId,
        })),
      },
    },
    include: { items: true },
  });

  // Update PO status if needed
  if (order.status === PurchaseStatus.Draft) {
    await prisma.purchaseOrder.update({
      where: { id: orderId },
      data: { status: PurchaseStatus.Ordered },
    });
  }

  return invoice;
}
