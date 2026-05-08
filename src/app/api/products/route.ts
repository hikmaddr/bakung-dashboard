import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { saveFile } from "@/lib/storage";
import { productSchema, validateRequest } from "@/lib/validations";

async function saveProductImage(file: File, productName: string) {
  const safe = (productName || "product").replace(/\s+/g, "_").toLowerCase();
  const { url } = await saveFile(file, {
    prefix: `products/${safe}/`,
    allowedContentTypes: [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
    ],
    maxSizeBytes: 10 * 1024 * 1024,
  });
  return url;
}

export async function GET(_req: NextRequest) {
  try {
    const rows = await prisma.product.findMany({ orderBy: { createdAt: "desc" }, include: { category: true } });
    return NextResponse.json(rows);
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || 'Gagal mengambil data' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    let inputData: any;
    const contentType = req.headers.get('content-type') || '';
    let file: File | null = null;

    if (contentType.includes('multipart/form-data')) {
      const fd = await req.formData();
      inputData = {
        sku: fd.get('sku') ? String(fd.get('sku')) : undefined,
        name: String(fd.get('name') || ''),
        description: fd.get('description') ? String(fd.get('description')) : undefined,
        categoryId: fd.get('categoryId') ? Number(fd.get('categoryId')) : undefined,
        unit: fd.get('unit') ? String(fd.get('unit')) : undefined,
        buyPrice: fd.get('buyPrice') ? Number(fd.get('buyPrice')) : undefined,
        sellPrice: fd.get('sellPrice') ? Number(fd.get('sellPrice')) : undefined,
        qty: fd.get('qty') ? Number(fd.get('qty')) : undefined,
      };
      file = fd.get('photo') as File | null;
    } else {
      inputData = await req.json();
    }

    const validation = validateRequest(productSchema, inputData);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.errors }, { status: 400 });
    }

    const data = validation.data!;
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
        brandProfileId: data.brandProfileId || null,
      }
    });

    return NextResponse.json(row, { status: 201 });
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || 'Gagal menyimpan' }, { status: 500 });
  }
}
