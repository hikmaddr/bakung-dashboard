import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createApiHandler } from "@/lib/api-handler";

export const GET = createApiHandler({
  handler: async (req, _, { activeBrand }) => {
    const count = await prisma.productCategory.count({ where: { brandProfileId: activeBrand.id, isDeleted: false } });
    if (count === 0) {
      await prisma.productCategory.createMany({ 
        data: [
          { name: 'Elektronik', code: 'ELK', description: 'Perangkat elektronik', brandProfileId: activeBrand.id },
          { name: 'Fashion', code: 'FSH', description: 'Pakaian dan aksesoris', brandProfileId: activeBrand.id },
          { name: 'Furnitur', code: 'FRN', description: 'Perabot rumah', brandProfileId: activeBrand.id },
        ]
      });
    }
    const rows = await prisma.productCategory.findMany({ 
      where: { brandProfileId: activeBrand.id, isDeleted: false },
      orderBy: { name: 'asc' } 
    });
    return NextResponse.json({ success: true, data: rows });
  }
});

export const POST = createApiHandler({
  actionName: "CATEGORY_CREATE",
  entityType: "product_category",
  handler: async (req, body: any, { activeBrand }) => {
    const { name, code, description, parentId } = body;
    if (!name || !code) return NextResponse.json({ success: false, message: 'Nama dan kode wajib' }, { status: 400 });
    
    const row = await prisma.productCategory.create({ 
      data: { 
        name, 
        code: String(code).toUpperCase().slice(0, 3), 
        description: description || null, 
        parentId: parentId || null,
        brandProfileId: activeBrand.id
      } 
    });
    return NextResponse.json({ success: true, data: row }, { status: 201 });
  }
});

