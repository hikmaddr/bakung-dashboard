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
  handler: async (req, _body, { activeBrand, params }) => {
    const id = params.id;
    const supplier = await prisma.supplier.findFirst({
      where: { 
        id: Number(id),
        brandProfileId: activeBrand.id,
        isDeleted: false 
      },
    });

    if (!supplier) {
      return NextResponse.json({ success: false, message: "Supplier tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: supplier });
  }
});

export const PUT = createApiHandler({
  schema: supplierSchema,
  actionName: "SUPPLIER_UPDATE",
  entityType: "supplier",
  handler: async (req, validatedData, { activeBrand, params }) => {
    const id = params.id;
    const supplier = await prisma.supplier.update({
      where: { 
        id: Number(id),
        brandProfileId: activeBrand.id 
      },
      data: validatedData,
    });
    return NextResponse.json({ 
      success: true, 
      message: "Supplier berhasil diperbarui", 
      data: supplier 
    });
  }
});

export const DELETE = createApiHandler({
  actionName: "SUPPLIER_DELETE",
  entityType: "supplier",
  handler: async (req, _body, { activeBrand, params }) => {
    const id = params.id;
    await prisma.supplier.update({
      where: { 
        id: Number(id),
        brandProfileId: activeBrand.id 
      },
      data: { isDeleted: true, deletedAt: new Date() },
    });
    return NextResponse.json({ success: true, message: "Supplier berhasil dihapus" });
  }
});
