import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { customerSchema } from "@/lib/validations";
import { createApiHandler } from "@/lib/api-handler";

export const GET = createApiHandler({
  handler: async (req, _, { activeBrand }) => {
    const includeDeleted = req.nextUrl.searchParams.get("includeDeleted") === "true";
    const customers = await prisma.customer.findMany({
      where: {
        brandProfileId: activeBrand.id,
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
      orderBy: { id: "desc" },
    });
    const fmt = req.nextUrl.searchParams.get("format");
    if (fmt === "std") return NextResponse.json({ success: true, data: customers });
    return NextResponse.json(customers);
  }
});

export const POST = createApiHandler({
  schema: customerSchema,
  actionName: "CUSTOMER_CREATE",
  entityType: "customer",
  handler: async (req, validatedData, { activeBrand }) => {
    const { pic, company, address, phone, email } = validatedData;
    
    const newCustomer = await prisma.customer.create({
      data: {
        pic,
        company,
        address,
        phone,
        email: email || null,
        brandProfileId: activeBrand.id,
      },
    });

    return NextResponse.json(newCustomer, { status: 201 });
  }
});

