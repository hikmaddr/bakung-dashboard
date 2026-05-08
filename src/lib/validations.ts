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
  number: z.string().min(1),
  date: z.coerce.date(),
  validUntil: z.coerce.date().optional(),
  customerId: z.number().int().positive(),
  totalAmount: z.number().nonnegative(),
  status: z.string().default("Draft"),
  brandProfileId: z.number().int().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
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
