import { NextResponse, type NextRequest } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";

type ShareRequest = {
  type: "quotation" | "invoice" | "sales-order" | "receipt" | "delivery";
  id?: number;
  data?: any;
};

function filenameFromDisposition(dispo: string | null | undefined, fallback: string): string {
  if (!dispo) return fallback;
  const m = /filename="?([^";]+)"?/i.exec(dispo);
  return m?.[1] || fallback;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ShareRequest;
    const origin = req.nextUrl.origin || process.env.APP_BASE_URL || "http://localhost:3000";
    const cookie = req.headers.get("cookie") || "";

    let pdfBytes: ArrayBuffer;
    let fileName = "document.pdf";

    const toBuffer = async (res: Response) => {
      const dispo = res.headers.get("Content-Disposition");
      const arrBuf = await res.arrayBuffer();
      const ct = res.headers.get("Content-Type") || "application/pdf";
      fileName = filenameFromDisposition(dispo, fileName);
      if (!ct.includes("pdf")) {
        // still proceed; some endpoints set inline with no explicit type
      }
      return arrBuf;
    };

    const numericId = Number(body.id);

    if (body.type === "quotation") {
      if (!Number.isFinite(numericId)) return NextResponse.json({ success: false, message: "ID quotation tidak valid" }, { status: 400 });
      const res = await fetch(`${origin}/api/quotations/${numericId}/pdf`, { headers: { cookie } });
      if (!res.ok) throw new Error("Gagal mengambil PDF quotation");
      pdfBytes = await toBuffer(res);
    } else if (body.type === "invoice") {
      if (!Number.isFinite(numericId)) return NextResponse.json({ success: false, message: "ID invoice tidak valid" }, { status: 400 });
      const res = await fetch(`${origin}/api/invoices/${numericId}/pdf`, { headers: { cookie } });
      if (!res.ok) throw new Error("Gagal mengambil PDF invoice");
      pdfBytes = await toBuffer(res);
    } else if (body.type === "sales-order") {
      if (!Number.isFinite(numericId)) return NextResponse.json({ success: false, message: "ID sales order tidak valid" }, { status: 400 });
      const res = await fetch(`${origin}/api/sales-orders/${numericId}/pdf`, { headers: { cookie } });
      if (!res.ok) throw new Error("Gagal mengambil PDF sales order");
      pdfBytes = await toBuffer(res);
    } else if (body.type === "receipt") {
      if (!Number.isFinite(numericId)) return NextResponse.json({ success: false, message: "ID kwitansi tidak valid" }, { status: 400 });
      const res = await fetch(`${origin}/api/receipts/${numericId}/pdf`, { headers: { cookie } });
      if (!res.ok) throw new Error("Gagal mengambil PDF kwitansi");
      pdfBytes = await toBuffer(res);
    } else if (body.type === "delivery") {
      const raw = (body.data || {}) as any;
      const payload = {
        number: raw.number,
        date: raw.date,
        refInvoice: raw.refInvoice,
        receiverName: raw.receiverName ?? raw.recvName ?? "",
        receiverAddress: raw.receiverAddress ?? raw.recvAddress ?? "",
        receiverPhone: raw.receiverPhone ?? raw.recvPhone ?? "",
        items: Array.isArray(raw.items) ? raw.items.map((i: any) => ({ name: i?.name, qty: Number(i?.qty || 0), unit: i?.unit || "pcs" })) : [],
        senderName: raw.senderName,
        expedition: raw.expedition,
        shipDate: raw.shipDate,
        etaDate: raw.etaDate,
        note: raw.note,
        brandSlug: raw.brandSlug,
        templateId: raw.templateId,
        brandOverrides: raw.brandOverrides,
      };
      const res = await fetch(`${origin}/api/deliveries/pdf`, {
        method: "POST",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Gagal mengambil PDF surat jalan");
      pdfBytes = await toBuffer(res);
    } else {
      return NextResponse.json({ success: false, message: "Tipe dokumen tidak didukung" }, { status: 400 });
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({ success: false, message: "Blob token belum dikonfigurasi" }, { status: 500 });
    }

    const buffer = Buffer.from(pdfBytes);
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const blob = await put(
      `${body.type || "document"}/${Date.now()}-${safeName}`,
      buffer,
      {
        access: "public",
        addRandomSuffix: true,
        token: process.env.BLOB_READ_WRITE_TOKEN,
        contentType: "application/pdf",
      }
    );

    const responsePayload = {
      success: true,
      fileId: blob.pathname,
      webViewLink: blob.url,
      webContentLink: blob.url,
      fileName: safeName,
      url: blob.url,
    };

    if (Number.isFinite(numericId)) {
      try {
        if (body.type === "invoice") {
          await prisma.invoice.update({
            where: { id: numericId },
            data: { shareUrl: blob.url },
          });
        } else if (body.type === "quotation") {
          await prisma.quotation.update({
            where: { id: numericId },
            data: { shareUrl: blob.url },
          });
        } else if (body.type === "sales-order") {
          await prisma.salesOrder.update({
            where: { id: numericId },
            data: { shareUrl: blob.url },
          });
        } else if (body.type === "receipt") {
          await prisma.receipt.update({
            where: { id: numericId },
            data: { shareUrl: blob.url },
          });
        }
      } catch (err) {
        console.error("[share/drive-upload] failed to persist shareUrl", err);
      }
    }

    return NextResponse.json(responsePayload);
  } catch (e: any) {
    console.error("[share/drive-upload] error:", e);
    return NextResponse.json({ success: false, message: e?.message || "Gagal membuat tautan" }, { status: 500 });
  }
}
