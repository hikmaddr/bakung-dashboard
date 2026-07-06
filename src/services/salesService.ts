import { prisma } from "@/lib/prisma";
import { QuotationStatus, SalesOrderStatus, InvoiceStatus, PaymentStatus, PurchaseStatus } from "@prisma/client";
import { generateNextNumber } from "@/lib/documentNumber";
import { getActiveBrandProfile } from "@/lib/brand";

export type NormalizedItem = {
  productId?: number;
  product: string;
  description: string;
  quantity: number;
  unit: string;
  price: number;
  discount: number;
  imageUrl: string | null;
  subtotal: number;
  supplierCost?: number;
  titipanCostAdjustment?: number;
  hiddenMargin?: number;
  taxAdjustment?: number;
  supplierId?: number | null;
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

export const normalizeSalesOrderItems = (rawItems: unknown[]): NormalizedItem[] => {
  return rawItems.map((raw) => {
    const item = raw as Record<string, unknown>;
    const qRaw = Number(
      typeof item.quantity !== "undefined" ? item.quantity : (item as any).qty ?? 0
    ) || 0;
    const quantity = Math.max(0, Math.round(qRaw));
    const price = Math.max(0, Number(item.price) || 0);
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
      product: String(item.product || "").trim(),
      description: String(item.description || ""),
      quantity,
      unit: String(item.unit || "pcs"),
      price,
      discount,
      imageUrl: typeof item.imageUrl === "string" ? (item.imageUrl as string) : null,
      subtotal: baseSubtotal,
      supplierCost: Number(item.supplierCost) || 0,
      titipanCostAdjustment: Number(item.titipanCostAdjustment) || 0,
      hiddenMargin: Number(item.hiddenMargin) || 0,
      taxAdjustment: Number(item.taxAdjustment) || 0,
      supplierId: item.supplierId ? Number(item.supplierId) : null,
    };
  });
};

export const computeSalesOrderTotals = (items: NormalizedItem[], extraDiscountRaw: unknown, taxMode: unknown) => {
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

export const parseDateInput = (value: unknown) => {
  if (!value) return new Date();
  const dt = new Date(value as string);
  if (Number.isNaN(dt.getTime())) {
    throw new Error("Format tanggal tidak valid");
  }
  return dt;
};

export async function createSalesOrder(args: {
  brandId: number;
  customerId: number;
  items: NormalizedItem[];
  extraDiscount?: number;
  taxMode?: string;
  date: Date;
  quotationId?: number | null;
  orderNumber?: string | null;
  status?: SalesOrderStatus;
  notes?: string | null;
  isNonInventory?: boolean;
}) {
  const {
    brandId,
    customerId,
    items,
    extraDiscount = 0,
    taxMode = "none",
    date,
    quotationId = null,
    orderNumber,
    status,
    notes = null,
    isNonInventory = false,
  } = args;

  const totals = computeSalesOrderTotals(items, extraDiscount, taxMode);
  const finalOrderNumber =
    typeof orderNumber === "string" && orderNumber.trim().length > 0
      ? orderNumber.trim()
      : await generateNextNumber("salesOrder", { brandProfileId: brandId, date });

  const order = await prisma.salesOrder.create({
    data: {
      orderNumber: finalOrderNumber,
      date,
      status: status || SalesOrderStatus.Draft,
      notes: typeof notes === "string" && notes.trim().length > 0 ? notes.trim() : null,
      isNonInventory,
      customerId,
      quotationId,
      brandProfileId: brandId,
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
          supplierCost: item.supplierCost,
          titipanCostAdjustment: item.titipanCostAdjustment,
          hiddenMargin: item.hiddenMargin,
          taxAdjustment: item.taxAdjustment,
          supplierId: item.supplierId,
        })),
      },
    },
    include: { customer: true, items: true, quotation: true },
  });

  // Auto-generate Delivery Order if status is Confirmed or Processing
  const statusStr = String(order.status || "").toLowerCase();
  if (statusStr === "confirmed" || statusStr === "processing") {
    try {
      // Generate Delivery Order
      const doNumber = await generateNextNumber("deliveryOrder", {
        brandProfileId: brandId,
        date: new Date(),
      });
      await prisma.deliveryOrder.create({
        data: {
          doNumber,
          date: new Date(),
          status: "Draft",
          salesOrderId: order.id,
          brandProfileId: brandId,
          items: {
            create: items.map((it) => ({
              product: it.product,
              description: it.description,
              quantity: it.quantity,
              unit: it.unit,
            })),
          },
        },
      });

      // Generate Purchase Orders for items with suppliers
      await createPurchaseOrdersFromSalesOrder(order.id);
    } catch (error) {
      console.error("Failed to auto-generate logistics/procurement documents:", error);
    }
  }

  return order;
}

export async function createSalesOrderFromQuotation(quotationId: number) {
  const quotation = await prisma.quotation.findUnique({ where: { id: quotationId }, include: { items: true } });
  if (!quotation) throw new Error("Quotation tidak ditemukan");

  // Pastikan quotation confirmed sebelum membuat SO
  if (quotation.status !== QuotationStatus.Confirmed) {
    await prisma.quotation.update({ where: { id: quotationId }, data: { status: QuotationStatus.Confirmed } });
  }

  const brand = quotation.brandProfileId ? await prisma.brandProfile.findUnique({ where: { id: quotation.brandProfileId } }) : await getActiveBrandProfile();
  if (!brand?.id) throw new Error("Brand aktif tidak ditemukan");

  const totalAmount = quotation.items.reduce((acc, it) => acc + (Number(it.price) || 0) * (Number(it.quantity) || 0), 0);
  const orderNumber = await generateNextNumber("salesOrder", { brandProfileId: brand.id, date: new Date() });

  const order = await prisma.salesOrder.create({
    data: {
      orderNumber,
      date: new Date(),
      status: SalesOrderStatus.Confirmed,
      customerId: quotation.customerId,
      quotationId: quotation.id,
      brandProfileId: brand.id,
      totalAmount,
      items: {
        create: quotation.items.map((item) => ({
          product: item.product,
          description: item.description || "",
          quantity: Number(item.quantity) || 0,
          unit: item.unit || "pcs",
          price: Number(item.price) || 0,
          discount: 0,
          imageUrl: null,
          subtotal: (Number(item.quantity) || 0) * (Number(item.price) || 0),
        })),
      },
    },
    include: { items: true },
  });

  return order;
}

export async function createInvoiceFromQuotation(quotationId: number) {
  const quotation = await prisma.quotation.findUnique({ where: { id: quotationId }, include: { items: true } });
  if (!quotation) throw new Error("Quotation tidak ditemukan");

  // Confirm quotation agar konsisten
  if (quotation.status !== QuotationStatus.Confirmed) {
    await prisma.quotation.update({ where: { id: quotationId }, data: { status: QuotationStatus.Confirmed } });
  }

  const brand = quotation.brandProfileId ? await prisma.brandProfile.findUnique({ where: { id: quotation.brandProfileId } }) : await getActiveBrandProfile();
  if (!brand?.id) throw new Error("Brand aktif tidak ditemukan");

  const now = new Date();
  const invoiceNumber = await generateNextNumber("invoice", { brandProfileId: brand.id, date: now });
  const subtotal = quotation.items.reduce((acc, it) => acc + (Number(it.price) || 0) * (Number(it.quantity) || 0), 0);

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      issueDate: now,
      dueDate: now,
      status: InvoiceStatus.Draft,
      customerId: quotation.customerId,
      quotationId: quotation.id,
      brandProfileId: brand.id,
      subtotal,
      total: subtotal,
      items: {
        create: quotation.items.map((item) => ({
          name: item.product,
          description: item.description || "",
          qty: Number(item.quantity) || 0,
          unit: item.unit || "pcs",
          price: Number(item.price) || 0,
          discount: 0,
          discountType: "percent",
          subtotal: (Number(item.quantity) || 0) * (Number(item.price) || 0),
        })),
      },
    },
    include: { items: true },
  });

  return invoice;
}

export async function upsertSalesOrderFromQuotation(
  quotationId: number,
  options?: {
    allowedBrandIds?: number[];
    blockCreativeScope?: boolean; // if true, block when brand scope is Creative
  }
) {
  const allowed = options?.allowedBrandIds ?? [];

  const quotation = await prisma.quotation.findFirst({
    where: {
      id: quotationId,
      brandProfileId: allowed.length ? { in: allowed } : undefined,
    },
    include: { items: true },
  });
  if (!quotation) throw new Error("Quotation tidak ditemukan");

  // Determine brand to use and optionally block Creative scope
  const brand = quotation.brandProfileId
    ? await prisma.brandProfile.findUnique({ where: { id: quotation.brandProfileId } })
    : await getActiveBrandProfile();
  if (!brand?.id) throw new Error("Brand aktif tidak ditemukan");
  const scope = String(brand.businessScope || "").toUpperCase();
  if (options?.blockCreativeScope && scope === "CREATIVE") {
    const err = new Error("Konversi ke Sales Order diblokir untuk scope Creative");
    (err as any).statusCode = 403;
    throw err;
  }

  // Check if SO already exists for this quotation
  const existingOrder = await prisma.salesOrder.findFirst({
    where: { quotationId },
    include: { items: true, customer: true },
  });

  const totalAmount = quotation.items.reduce(
    (acc, it) => acc + (Number(it.price) || 0) * (Number(it.quantity) || 0),
    0
  );

  // Ensure quotation Confirmed for consistency
  if (quotation.status !== QuotationStatus.Confirmed) {
    await prisma.quotation.update({ where: { id: quotationId }, data: { status: QuotationStatus.Confirmed } });
  }

  if (!existingOrder) {
    const orderNumber = await generateNextNumber("salesOrder", { brandProfileId: brand.id, date: new Date() });
    const order = await prisma.salesOrder.create({
      data: {
        orderNumber,
        date: new Date(),
        status: SalesOrderStatus.Confirmed,
        customerId: quotation.customerId,
        quotationId: quotation.id,
        brandProfileId: brand.id,
        totalAmount,
        items: {
          create: quotation.items.map((item) => ({
            product: item.product,
            description: item.description || "",
            quantity: Number(item.quantity) || 0,
            unit: item.unit || "pcs",
            price: Number(item.price) || 0,
            discount: 0,
            imageUrl: null,
            subtotal: (Number(item.quantity) || 0) * (Number(item.price) || 0),
          })),
        },
      },
      include: { items: true, customer: true },
    });
    return { action: "created" as const, order };
  }

  // If quotation hasn't changed since order update, skip
  if (new Date(quotation.updatedAt) <= new Date(existingOrder.updatedAt)) {
    return {
      action: "skipped" as const,
      reason: "Quotation sudah dikonfirmasi dan belum ada perubahan. Tidak disalin ulang.",
      order: existingOrder,
    };
  }

  // Sync items and totals to existing order
  const [_, updated] = await prisma.$transaction([
    prisma.salesOrderItem.deleteMany({ where: { salesOrderId: existingOrder.id } }),
    prisma.salesOrder.update({
      where: { id: existingOrder.id },
      data: {
        customerId: quotation.customerId,
        brandProfileId:
          existingOrder.brandProfileId ?? quotation.brandProfileId ?? brand.id,
        totalAmount,
        items: {
          create: quotation.items.map((item) => ({
            product: item.product,
            description: item.description || "",
            quantity: Number(item.quantity) || 0,
            unit: item.unit || "pcs",
            price: Number(item.price) || 0,
            discount: 0,
            imageUrl: null,
            subtotal: (Number(item.quantity) || 0) * (Number(item.price) || 0),
          })),
        },
      },
      include: { items: true, customer: true },
    }),
  ]);

  return { action: "updated" as const, order: updated };
}

export async function upsertInvoiceFromQuotation(
  quotationId: number,
  options?: {
    allowedBrandIds?: number[];
    onlyCreativeScope?: boolean; // if true, only allow when brand scope is Creative
  }
) {
  const allowed = options?.allowedBrandIds ?? [];

  const quotation = await prisma.quotation.findFirst({
    where: {
      id: quotationId,
      brandProfileId: allowed.length ? { in: allowed } : undefined,
    },
    include: { items: true },
  });
  if (!quotation) throw new Error("Quotation tidak ditemukan");

  const brand = quotation.brandProfileId
    ? await prisma.brandProfile.findUnique({ where: { id: quotation.brandProfileId } })
    : await getActiveBrandProfile();
  if (!brand?.id) throw new Error("Brand aktif tidak ditemukan");
  const scope = String(brand.businessScope || "").toUpperCase();
  if (options?.onlyCreativeScope && scope !== "CREATIVE") {
    const err = new Error("Fitur hanya aktif untuk brand dengan scope Creative");
    (err as any).statusCode = 403;
    throw err;
  }

  // existing invoice check
  const existingInvoice = await prisma.invoice.findFirst({
    where: { quotationId },
    include: { items: true },
  });

  const subtotal = quotation.items.reduce(
    (acc, it) => acc + (Number(it.price) || 0) * (Number(it.quantity) || 0),
    0
  );

  // Ensure quotation is confirmed
  if (quotation.status !== QuotationStatus.Confirmed) {
    await prisma.quotation.update({ where: { id: quotationId }, data: { status: QuotationStatus.Confirmed } });
  }

  if (!existingInvoice) {
    const now = new Date();
    const invoiceNumber = await generateNextNumber("invoice", { brandProfileId: brand.id, date: now });
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        issueDate: now,
        dueDate: now,
        status: InvoiceStatus.Draft,
        customerId: quotation.customerId,
        quotationId: quotation.id,
        brandProfileId: brand.id,
        subtotal,
        total: subtotal,
        items: {
          create: quotation.items.map((item) => ({
            name: item.product,
            description: item.description || "",
            qty: Number(item.quantity) || 0,
            unit: item.unit || "pcs",
            price: Number(item.price) || 0,
            discount: 0,
            discountType: "percent",
            subtotal: (Number(item.quantity) || 0) * (Number(item.price) || 0),
          })),
        },
      },
      include: { items: true },
    });
    return { action: "created" as const, invoice };
  }

  if (new Date(quotation.updatedAt) <= new Date(existingInvoice.updatedAt)) {
    return {
      action: "skipped" as const,
      reason: "Quotation belum berubah. Tidak disalin ulang.",
      invoice: existingInvoice,
    };
  }

  const [__, updated] = await prisma.$transaction([
    prisma.invoiceItem.deleteMany({ where: { invoiceId: existingInvoice.id } }),
    prisma.invoice.update({
      where: { id: existingInvoice.id },
      data: {
        customerId: quotation.customerId,
        brandProfileId: existingInvoice.brandProfileId ?? quotation.brandProfileId ?? brand.id,
        subtotal,
        total: subtotal,
        items: {
          create: quotation.items.map((item) => ({
            name: item.product,
            description: item.description || "",
            qty: Number(item.quantity) || 0,
            unit: item.unit || "pcs",
            price: Number(item.price) || 0,
            discount: 0,
            discountType: "percent",
            subtotal: (Number(item.quantity) || 0) * (Number(item.price) || 0),
          })),
        },
      },
      include: { items: true },
    }),
  ]);

  return { action: "updated" as const, invoice: updated };
}

/**
 * Groups items by supplierId and creates Purchase Orders.
 * Items without supplierId are ignored.
 */
export async function createPurchaseOrdersFromSalesOrder(salesOrderId: number) {
  const so = await prisma.salesOrder.findUnique({
    where: { id: salesOrderId },
    include: { items: true },
  });

  if (!so) throw new Error("Sales Order tidak ditemukan");

  // Group items by supplierId
  const itemsBySupplier = new Map<number, any[]>();
  for (const item of so.items) {
    if (item.supplierId) {
      const list = itemsBySupplier.get(item.supplierId) || [];
      list.push(item);
      itemsBySupplier.set(item.supplierId, list);
    }
  }

  const createdPOs = [];

  for (const [supplierId, items] of itemsBySupplier.entries()) {
    // Check if PO already exists for this SO and Supplier to avoid duplicates
    const existingPO = await prisma.purchaseOrder.findFirst({
      where: { salesOrderId, supplierId },
    });
    if (existingPO) continue;

    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) continue;

    const poNumber = await generateNextNumber("purchaseOrder", {
      brandProfileId: so.brandProfileId || 0,
      date: new Date(),
    });

    const subtotal = items.reduce((acc, it) => acc + (it.quantity * (it.supplierCost || 0)), 0);

    const po = await prisma.purchaseOrder.create({
      data: {
        orderNumber: poNumber,
        date: new Date(),
        status: PurchaseStatus.Draft,
        salesOrderId,
        supplierId,
        supplierName: supplier.name,
        brandProfileId: so.brandProfileId,
        subtotal,
        totalAmount: subtotal, // Simplification for now
        items: {
          create: items.map((it) => ({
            product: it.product,
            description: it.description,
            quantity: it.quantity,
            unit: it.unit,
            price: it.supplierCost || 0,
            subtotal: it.quantity * (it.supplierCost || 0),
          })),
        },
      },
    });
    createdPOs.push(po);
  }

  return createdPOs;
}


