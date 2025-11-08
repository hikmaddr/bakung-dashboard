import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { saveFile } from "@/lib/storage";

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
    const rows = await prisma.product.findMany({
      orderBy: { createdAt: "desc" },
      include: { category: true },
    });
    return NextResponse.json(rows);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Gagal mengambil data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const fd = await req.formData();
      const sku = String(fd.get("sku") || "");
      const name = String(fd.get("name") || "");
      const description = String(fd.get("description") || "");
      const categoryId = fd.get("categoryId")
        ? Number(fd.get("categoryId"))
        : null;
      const unit = String(fd.get("unit") || "pcs");
      const buyPrice = Number(fd.get("buyPrice") || 0);
      const sellPrice = Number(fd.get("sellPrice") || 0);
      const qty = Number(fd.get("qty") || 0);
      const file = fd.get("photo") as File | null;
      let imageUrl: string | undefined = undefined;
      if (file && file.size > 0) {
        imageUrl = await saveProductImage(file, name || sku || "product");
      }
      const row = await prisma.product.create({
        data: {
          sku,
          name,
          description: description || null,
          categoryId: categoryId || undefined,
          unit,
          buyPrice,
          sellPrice,
          qty,
          imageUrl,
        },
      });
      return NextResponse.json(row, { status: 201 });
    } else {
      const body = await req.json();
      const {
        sku,
        name,
        description,
        categoryId,
        unit = "pcs",
        buyPrice = 0,
        sellPrice = 0,
        qty = 0,
        imageUrl,
      } = body;
      const row = await prisma.product.create({
        data: {
          sku,
          name,
          description,
          categoryId,
          unit,
          buyPrice,
          sellPrice,
          qty,
          imageUrl,
        },
      });
      return NextResponse.json(row, { status: 201 });
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Gagal menyimpan";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
