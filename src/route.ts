import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import fs from "fs/promises";
import path from "path";

// ==================================================
// GET — Ambil semua quotation beserta total harga
// ==================================================
export async function GET(_req: NextRequest, _ctx: { params: Promise<{}> }) {
  try {
    const quotations = await prisma.quotation.findMany({
      include: {
        items: true, // Ambil relasi item dari QuotationItem
        customer: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const data = quotations.map((q: any) => {
      const total = Array.isArray(q.items)
        ? q.items.reduce(
            (acc: number, item: any) =>
              acc + (Number(item.quantity) || 0) * (Number(item.price) || 0),
            0
          )
        : 0;

      return {
        id: q.id,
        quotationNumber: q.quotationNumber ?? "-",
        status: q.status ?? "Draft",
        date: q.date ? format(new Date(q.date), "dd/MM/yyyy") : "-",
        total,
       customer: q.customer? `${q.customer.pic} - ${q.customer.company}` 
  : "Tidak diketahui",
        projectFileUrl: q.projectFileUrl ?? null,
      };
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error("❌ Gagal ambil quotation:", error);
    return NextResponse.json(
      { message: "Gagal mengambil quotation" },
      { status: 500 }
    );
  }
}

// ==================================================
// POST — Simpan quotation beserta item dan file
// ==================================================
export async function POST(req: NextRequest, _ctx: { params: Promise<{}> }) {
  try {
    const formData = await req.formData();

    const quotationNumber = formData.get("quotationNumber") as string;
    const date = formData.get("date") as string;
    const status = formData.get("status") as string;
    const customerId = Number(formData.get("customerId"));
    const projectDesc = formData.get("projectDescription") as string | null;
    const projectFile = formData.get("projectFile") as File | null;
    const items = JSON.parse(formData.get("items") as string);

    let projectFileUrl: string | null = null;

    // Simpan file lampiran jika ada
    if (projectFile) {
      const bytes = await projectFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const fileName = `${Date.now()}-${projectFile.name}`;
      const uploadDir = path.join(process.cwd(), "public", "uploads");
      await fs.mkdir(uploadDir, { recursive: true });
      const filePath = path.join(uploadDir, fileName);
      await fs.writeFile(filePath, buffer);
      projectFileUrl = `/uploads/${fileName}`;
    }

    // Simpan quotation + items
    // hitung subtotal per item dan totalAmount
    const itemsForCreate = items.map((item: any) => ({
      product: item.product,
      description: item.description,
      quantity: Number(item.quantity),
      unit: item.unit,
      price: Number(item.price),
      subtotal: Number(item.quantity) * Number(item.price),
    }));
    const totalAmount = itemsForCreate.reduce((acc: number, it: any) => acc + it.subtotal, 0);

    const quotation = await prisma.quotation.create({
      data: {
        quotationNumber,
        date: new Date(date),
        // validUntil is required by the Prisma type; use provided value or fall back to the main date
        validUntil: new Date(String(formData.get("validUntil") ?? date)),
        status,
        customerId,
        projectDesc: projectDesc ?? "",
        projectFileUrl,
        totalAmount,
        items: {
          create: itemsForCreate,
        },
      },
      include: { items: true, customer: true },
    });

    return NextResponse.json(quotation);
  } catch (error) {
    console.error("❌ Gagal simpan quotation:", error);
    return NextResponse.json(
      { message: "Gagal menyimpan quotation" },
      { status: 500 }
    );
  }
}
