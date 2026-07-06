import { z } from "zod";

export const productSchema = z.object({
  sku: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional().nullable(),
  categoryId: z.number().int().positive().optional().nullable(),
  unit: z.string().default("pcs"),
  buyPrice: z.number().nonnegative().default(0),
  sellPrice: z.number().nonnegative().default(0),
  qty: z.number().int().default(0),
  imageUrl: z.string().url().optional().nullable(),
  brandProfileId: z.number().int().positive().optional().nullable(),
});

export const customerSchema = z.object({
  pic: z.string().min(1, "PIC name is required"),
  company: z.string().min(1, "Company name is required"),
  email: z.string().email().optional().nullable().or(z.literal("")),
  phone: z.string().min(1, "Phone number is required"),
  address: z.string().default(""),
  brandProfileId: z.number().int().positive().optional().nullable(),
});

export const quotationSchema = z.object({
  quotationNumber: z.string().min(1, "Quotation number is required"),
  date: z.coerce.date(),
  validUntil: z.coerce.date(),
  projectDescription: z.string().min(1, "Project description is required"),
  customerId: z.coerce.number().int().positive("Customer is required"),
  status: z.enum(["Draft", "Sent", "Viewed", "Approved", "Rejected", "Expired", "Converted", "Canceled"]).default("Draft"),
  notes: z.string().optional().nullable(),
  isNegotiated: z.boolean().optional().default(false),
  originalAmount: z.coerce.number().optional().nullable(),
  negotiatedAmount: z.coerce.number().optional().nullable(),
  marginChange: z.coerce.number().optional().nullable(),
  negotiationNotes: z.string().optional().nullable(),
  clientPoUrl: z.string().optional().nullable(),
  clientSoUrl: z.string().optional().nullable(),
  clientOtherFiles: z.any().optional(),
  items: z.array(z.object({
    product: z.string().min(1, "Product name is required"),
    description: z.string().optional().nullable(),
    quantity: z.coerce.number().positive("Quantity must be positive"),
    unit: z.string().default("pcs"),
    price: z.coerce.number().nonnegative("Price cannot be negative"),
    imageUrl: z.string().optional().nullable(),
    imageKey: z.string().optional().nullable(),
    supplierCost: z.coerce.number().nonnegative().optional().nullable(),
    titipanCostAdjustment: z.coerce.number().optional().nullable(),
    hiddenMargin: z.coerce.number().optional().nullable(),
    taxAdjustment: z.coerce.number().optional().nullable(),
  })).min(1, "At least one item is required"),
});

export const salesOrderSchema = z.object({
  orderNumber: z.string().optional().nullable(),
  customerId: z.coerce.number().int().positive("Customer is required"),
  quotationId: z.coerce.number().int().positive().optional().nullable(),
  status: z.enum(["Draft", "Confirmed", "Processing", "Shipping", "Delivered", "Completed", "Canceled"]).default("Draft"),
  notes: z.string().optional().nullable(),
  date: z.coerce.date().optional(),
  extraDiscount: z.coerce.number().nonnegative().default(0),
  taxMode: z.enum(["none", "ppn", "inclusive", "ppn_11_inclusive", "ppn_11_exclusive", "ppn_12_inclusive", "ppn_12_exclusive"]).default("none"),
  isNonInventory: z.boolean().optional().default(false),
  items: z.array(z.object({
    product: z.string().min(1, "Product name is required"),
    description: z.string().optional().nullable(),
    quantity: z.coerce.number().positive("Quantity must be positive"),
    unit: z.string().default("pcs"),
    price: z.coerce.number().nonnegative("Price cannot be negative"),
    supplierCost: z.coerce.number().nonnegative().optional().nullable(),
    titipanCostAdjustment: z.coerce.number().optional().nullable(),
    hiddenMargin: z.coerce.number().optional().nullable(),
    taxAdjustment: z.coerce.number().optional().nullable(),
  })).min(1, "At least one item is required"),
});

export const purchaseOrderSchema = z.object({
  orderNumber: z.string().optional().nullable(),
  supplierName: z.string().min(1, "Supplier name is required"),
  status: z.enum(["Draft", "Ordered", "Received", "Canceled"]).default("Draft"),
  notes: z.string().optional().nullable(),
  date: z.coerce.date().optional(),
  extraDiscount: z.coerce.number().nonnegative().default(0),
  taxMode: z.string().default("none"),
  items: z.array(z.object({
    productId: z.coerce.number().int().positive().optional().nullable(),
    product: z.string().min(1, "Product name is required"),
    description: z.string().optional().nullable(),
    quantity: z.coerce.number().positive("Quantity must be positive"),
    unit: z.string().default("pcs"),
    price: z.coerce.number().nonnegative("Price cannot be negative"),
    discount: z.coerce.number().nonnegative().default(0),
  })).min(1, "At least one item is required"),
});

export const invoiceSchema = z.object({
  invoiceNumber: z.string().optional().nullable(),
  invoiceDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
  customerId: z.coerce.number().int().positive("Customer is required"),
  salesOrderId: z.coerce.number().int().positive().optional().nullable(),
  quotationId: z.coerce.number().int().positive().optional().nullable(),
  status: z.enum(["Draft", "Issued", "Paid", "Void", "Canceled"]).default("Draft"),
  paymentStatus: z.enum(["UNPAID", "PARTIAL", "PAID", "VOID"]).default("UNPAID"),
  notes: z.string().optional().nullable(),
  terms: z.string().optional().nullable(),
  extraDiscountType: z.enum(["amount", "percent"]).default("amount"),
  extraDiscountValue: z.coerce.number().nonnegative().default(0),
  shippingCost: z.coerce.number().nonnegative().default(0),
  taxMode: z.string().default("none"),
  downPayment: z.coerce.number().nonnegative().default(0),
  items: z.array(z.object({
    name: z.string().min(1, "Item name is required"),
    description: z.string().optional().nullable(),
    qty: z.coerce.number().positive("Quantity must be positive"),
    unit: z.string().default("pcs"),
    price: z.coerce.number().nonnegative("Price cannot be negative"),
    discount: z.coerce.number().nonnegative().default(0),
    discountType: z.enum(["amount", "percent"]).default("percent"),
  })).min(1, "At least one item is required"),
});

// Helper to validate and return errors as JSON response
export function validateRequest<T>(schema: z.Schema<T>, data: unknown) {
  const result = schema.safeParse(data);
  if (!result.success) {
    return {
      success: false,
      errors: result.error.flatten().fieldErrors,
    };
  }
  return {
    success: true,
    data: result.data,
  };
}
