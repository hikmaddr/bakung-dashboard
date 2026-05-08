import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getAuth } from "@/lib/auth";
import { resolveAllowedBrandIds } from "@/lib/brand";
import { createOrUpdateShortLink } from "@/lib/shortlink";

export const runtime = "nodejs";

const sanitizeFileName = (value: string, fallback: string) => {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;
  return trimmed.replace(/[^a-zA-Z0-9._-]/g, "_");
};

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await params;
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { success: false, message: "Blob token belum dikonfigurasi" },
        { status: 500 }
      );
    }

    const invoiceId = rawId;
    const numericId = Number(invoiceId);
    if (!invoiceId || Number.isNaN(numericId)) {
      return NextResponse.json(
        { success: false, message: "ID invoice tidak valid" },
        { status: 400 }
      );
    }

    const auth = await getAuth();
    const allowedBrandIds = await resolveAllowedBrandIds(
      auth?.userId ?? null,
      (auth?.roles as string[]) ?? [],
      []
    );

    const invoice = await prisma.invoice.findFirst({
      where: {
        id: numericId,
        brandProfileId: allowedBrandIds.length ? { in: allowedBrandIds } : undefined,
      },
      select: { id: true, invoiceNumber: true, brandProfileId: true },
    });

    if (!invoice) {
      return NextResponse.json(
        { success: false, message: "Invoice tidak ditemukan" },
        { status: 404 }
      );
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, message: "File PDF belum disertakan" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const originalName = sanitizeFileName(
      file.name || `${invoice.invoiceNumber || `INV-${invoice.id}`}.pdf`,
      `invoice-${invoice.id}.pdf`
    );

    const blob = await put(`invoices/${invoice.id}-${originalName}`, buffer, {
      access: "public",
      addRandomSuffix: true,
      token: process.env.BLOB_READ_WRITE_TOKEN,
      contentType: file.type || "application/pdf",
    });

    try {
      const { shortUrl } = await createOrUpdateShortLink({
        type: "invoice",
        entityId: invoice.id,
        brandProfileId: invoice.brandProfileId ?? null,
        targetUrl: blob.url,
        hint: invoice.invoiceNumber || `INV-${invoice.id}`,
        origin: req.headers.get("origin") || undefined,
      });
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { shareUrl: shortUrl },
      });
    } catch (updateErr) {
      console.error("[invoice/upload] failed to persist shareUrl", updateErr);
    }

    return NextResponse.json(
      {
        success: true,
        url: blob.url,
        message: "Invoice berhasil diunggah",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[invoice/upload] error", error);
    return NextResponse.json(
      { success: false, message: "Gagal mengunggah invoice" },
      { status: 500 }
    );
  }
}
