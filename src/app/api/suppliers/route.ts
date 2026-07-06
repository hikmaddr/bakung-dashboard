import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createApiHandler } from "@/lib/api-handler";
import { z } from "zod";

export const runtime = "nodejs";

const supplierSchema = z.object({
  name: z.string().min(1, "Nama supplier wajib diisi"),
  pic: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
});

export const GET = createApiHandler({
  handler: async (req, _, { activeBrand }) => {
    const suppliers = await prisma.supplier.findMany({
      where: { 
        brandProfileId: activeBrand.id,
        isDeleted: false 
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ success: true, data: suppliers });
  }
});

export const POST = createApiHandler({
  schema: supplierSchema,
  actionName: "SUPPLIER_CREATE",
  entityType: "supplier",
  handler: async (req, validatedData, { activeBrand }) => {
    const supplier = await prisma.supplier.create({
      data: {
        ...validatedData,
        brandProfileId: activeBrand.id,
      },
    });
    return NextResponse.json({ 
      success: true, 
      message: "Supplier berhasil ditambahkan", 
      data: supplier 
    });
  }
});
