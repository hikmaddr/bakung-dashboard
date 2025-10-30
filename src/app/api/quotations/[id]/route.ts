import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client"; // untuk tangani error
import { writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";

// Helper upload file
async function saveUpload(file: File, baseName: string) {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const unique = `${baseName}_${crypto.randomUUID()}.${ext}`;
  const uploadPath = path.join(process.cwd(), "public", "uploads", unique);
  await writeFile(uploadPath, buffer);
  return `/uploads/${unique}`;
}

// ===================================================================
// GET HANDLER (Mengambil data Quotation)
// ===================================================================
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const id = Number(idParam);
    if (Number.isNaN(id)) {
      return NextResponse.json(
        { success: false, message: "ID tidak valid" },
        { status: 400 }
      );
    }

    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: {
        customer: true,
        items: true,
      },
    });

    if (!quotation) {
      return NextResponse.json(
        { success: false, message: "Quotation tidak ditemukan" },
        { status: 404 }
      );
    }

    // Transformasi data untuk frontend
    const transformed = {
      ...quotation,
      projectDescription: quotation.projectDesc,
      customer: quotation.customer
        ? {
            id: quotation.customer.id,
            pic: quotation.customer.pic,
            company: quotation.customer.company,
            address: quotation.customer.address,
            phone: quotation.customer.phone,
            email: quotation.customer.email,
          }
        : null,
      items: quotation.items.map((item: any) => {
        const raw = item.imageUrl as string | null | undefined;
        let imageUrl: string | null = null;
        if (raw && raw.trim()) {
          const val = raw.trim();
          const isAbsolute = /^https?:\/\//i.test(val) || /^data:/i.test(val);
          imageUrl = val.startsWith("/") || isAbsolute ? val : `/uploads/${val}`;
        }
        return { ...item, imageUrl };
      }),
    };

    return NextResponse.json({
      success: true,
      data: transformed,
    });
  } catch (err: any) {
    console.error("❌ ERROR GET /api/quotations/[id]:", err);
    return NextResponse.json(
      { success: false, message: `Kesalahan server: ${err.message}` },
      { status: 500 }
    );
  }
}

// ===================================================================
// PUT HANDLER (Memperbarui data Quotation)
// ===================================================================
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idParam } = await params;
  const id = Number(idParam);

  if (Number.isNaN(id)) {
    return NextResponse.json(
      { success: false, message: "ID Quotation tidak valid" },
      { status: 400 }
    );
  }

  try {
    const formData = await req.formData();

    const quotationNumber = formData.get("quotationNumber") as string;
    const dateStr = formData.get("date") as string;
    const validUntilStr = formData.get("validUntil") as string;
    const isDraft = formData.get("isDraft") === "true";
    const customerId = Number(formData.get("customerId"));
    const projectDescription = formData.get("projectDescription") as string;
    const itemsJson = formData.get("items") as string;
    const rawNotes = formData.get("notes");
    const notes =
      typeof rawNotes === "string"
        ? rawNotes.trim()
        : "";

    const _projectFilePreview = formData.get("projectFilePreview");
    const projectFilePreviewUrl =
      _projectFilePreview === undefined
        ? undefined
        : (String(_projectFilePreview) || null);

    if (isNaN(customerId) || !itemsJson || !dateStr || !validUntilStr) {
      return NextResponse.json(
        { success: false, message: "Data utama Quotation tidak valid." },
        { status: 400 }
      );
    }

    const incomingItems: any[] = JSON.parse(itemsJson);
    const newDate = new Date(dateStr);
    const newValidUntil = new Date(validUntilStr);

    // ========== Upload File Project ==========
    const projectFile = formData.get("projectFile") as File | null;
    let projectFileUrl: string | null | undefined = undefined;

    if (projectFile && projectFile.size > 0) {
      projectFileUrl = await saveUpload(projectFile, `project-${id}`);
    } else if (projectFilePreviewUrl === null) {
      projectFileUrl = null;
    } else if (projectFilePreviewUrl) {
      projectFileUrl = projectFilePreviewUrl;
    }

    // ========== Proses Item ==========
    const itemUpdates: any[] = [];
    const itemCreates: any[] = [];
    const existingItemIds: number[] = [];

    for (const it of incomingItems) {
      const quantity = Number(it.quantity);
      const price = Number(it.price);
      const subtotal = quantity * price;
      const unit = it.unit || "pcs";
      const description = it.description ?? "";

      const itemImageFile = formData.get(`itemImage_${it.index}`) as File | null;
      let imageUrl: string | null = it.imagePreview ?? it.imageUrl ?? null;
      if (imageUrl === "") imageUrl = null;

      if (itemImageFile && itemImageFile.size > 0) {
        imageUrl = await saveUpload(itemImageFile, `item-${id}-${it.index}`);
      } else if (it.imagePreview === "null" || it.imagePreview === "") {
        imageUrl = null;
      }

      const itemData = {
        product: String(it.product || "").trim(),
        description,
        quantity,
        unit,
        price,
        subtotal,
        imageUrl,
      };

      if (it.id) {
        itemUpdates.push({ id: it.id, ...itemData });
        existingItemIds.push(it.id);
      } else {
        itemCreates.push(itemData);
      }
    }

    const updateItemPromises = itemUpdates.map((item) =>
      prisma.quotationItem.update({
        where: { id: item.id },
        data: ({
          product: item.product,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          price: item.price,
          subtotal: item.subtotal,
          imageUrl: item.imageUrl,
        } as any),
      })
    );

    const transactionOperations: Prisma.PrismaPromise<any>[] = [
      // DELETE item yang sudah tidak ada
      prisma.quotationItem.deleteMany({
        where: {
          quotationId: id,
          id: { notIn: existingItemIds },
        },
      }),

      ...updateItemPromises,

      prisma.quotation.update({
        where: { id },
        data: {
          quotationNumber,
          customerId,
          date: newDate,
          validUntil: newValidUntil,
          projectDesc: projectDescription,
          projectFileUrl: projectFileUrl,
          notes: notes ? notes : null,
          ...(isDraft ? { status: "Draft" } : {}),
          totalAmount: incomingItems.reduce(
            (sum, item) => sum + item.quantity * item.price,
            0
          ),
          items: {
            create: itemCreates,
          },
        },
        include: { customer: true, items: true },
      }),
    ];

    const transactionResult = await prisma.$transaction(transactionOperations);
    const updatedQuotation = transactionResult[transactionResult.length - 1];

    return NextResponse.json({
      success: true,
      message: "Quotation berhasil diperbarui",
      data: updatedQuotation,
    });
  } catch (error: any) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error(`❌ Prisma Error Code: ${error.code} - ${error.message}`);
    }
    console.error("❌ ERROR PUT /api/quotations/[id]:", error);
    return NextResponse.json(
      { success: false, message: `Gagal menyimpan perubahan: ${error.message}` },
      { status: 500 }
    );
  }
}

// ===================================================================
// DELETE HANDLER (Menghapus data Quotation)
// ===================================================================
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const id = Number(idParam);

    if (Number.isNaN(id)) {
      return NextResponse.json(
        { success: false, message: "ID tidak valid" },
        { status: 400 }
      );
    }

    // Hapus semua item terkait quotation
    await prisma.quotationItem.deleteMany({
      where: { quotationId: id },
    });

    // Hapus quotation utama
    await prisma.quotation.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Quotation berhasil dihapus",
    });
  } catch (err: any) {
    console.error("❌ ERROR DELETE /api/quotations/[id]:", err);
    return NextResponse.json(
      { success: false, message: `Gagal menghapus quotation: ${err.message}` },
      { status: 500 }
    );
  }
}
