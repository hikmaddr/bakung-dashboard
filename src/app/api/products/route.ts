import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { saveFile } from "@/lib/storage";
import { productSchema } from "@/lib/validations";
import { createApiHandler } from "@/lib/api-handler";

async function saveProductImage(file: File, productName: string) {
  const safe = (productName || "product").replace(/\s+/g, "_").toLowerCase();
  const { url } = await saveFile(file, {
    prefix: `products/${safe}/`,
    allowedContentTypes: [
      "image/png", "image/jpeg", "image/jpg", "image/webp",
    ],
    maxSizeBytes: 10 * 1024 * 1024,
  });
  return url;
}

export const GET = createApiHandler({
  handler: async (req, _, { activeBrand }) => {
    const rows = await prisma.product.findMany({ 
      where: { brandProfileId: activeBrand.id },
      orderBy: { createdAt: "desc" }, 
      include: { category: true } 
    });
    return NextResponse.json(rows);
  }
});

export const POST = createApiHandler({
  actionName: "PRODUCT_CREATE",
  entityType: "product",
  handler: async (req, body: any, { activeBrand }) => {
    let inputData: any;
    let file: File | null = null;

    if (body instanceof FormData) {
      inputData = {
        sku: body.get('sku') ? String(body.get('sku')) : undefined,
        name: String(body.get('name') || ''),
        description: body.get('description') ? String(body.get('description')) : undefined,
        categoryId: body.get('categoryId') ? Number(body.get('categoryId')) : undefined,
        unit: body.get('unit') ? String(body.get('unit')) : undefined,
        buyPrice: body.get('buyPrice') ? Number(body.get('buyPrice')) : undefined,
        sellPrice: body.get('sellPrice') ? Number(body.get('sellPrice')) : undefined,
        qty: body.get('qty') ? Number(body.get('qty')) : undefined,
      };
      file = body.get('photo') as File | null;
    } else {
      inputData = body;
    }

    const validation = productSchema.safeParse(inputData);
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        errors: validation.error.flatten().fieldErrors,
      }, { status: 400 });
    }

    const data = validation.data;
    let imageUrl = data.imageUrl;

    if (file && (file as any).size) {
      imageUrl = await saveProductImage(file, data.name || data.sku || 'product');
    }

    const row = await prisma.product.create({
      data: {
        sku: data.sku || `SKU-${Date.now()}`,
        name: data.name,
        description: data.description,
        categoryId: data.categoryId,
        unit: data.unit,
        buyPrice: data.buyPrice,
        sellPrice: data.sellPrice,
        qty: data.qty,
        imageUrl: imageUrl || null,
        brandProfileId: activeBrand.id,
      }
    });

    return NextResponse.json(row, { status: 201 });
  }
});

