export const runtime = "nodejs";

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveAllowedBrandIds } from "@/lib/brand";
import { rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { type InvoiceTemplateTheme, resolveTheme, resolveThankYou, resolvePaymentLines, toRgb255 } from "@/lib/quotationTheme";
import { initPdfWithBrandFonts, drawHeaderCommon, drawInfoSectionCommon, drawSignatureColumnsCommon, formatPdfFileName } from "@/lib/pdfCommon";
import { createApiHandler } from "@/lib/api-handler";

type CreatePdfBody = {
  number?: string;
  date?: string;
  refInvoice?: string;
  receiverName?: string;
  receiverAddress?: string;
  receiverPhone?: string;
  items?: Array<{ name: string; qty: number; unit: string }>;
  senderName?: string;
  expedition?: string;
  shipDate?: string;
  etaDate?: string;
  note?: string;
  driverName?: string;
  vehicleNumber?: string;
  brandSlug?: string;
  templateId?: string;
  brandOverrides?: Record<string, any>;
};

function drawItemsTable(
  page: PDFPage,
  fontRegular: PDFFont,
  fontBold: PDFFont,
  theme: InvoiceTemplateTheme,
  items: Array<{ name: string; qty: number; unit: string }>,
  startYOverride?: number,
) {
  const startY = typeof startYOverride === "number" ? startYOverride : page.getHeight() - 200;
  const x = 40;
  const tableWidth = page.getWidth() - 80;
  const rowHeight = 22;
  const headerBg = toRgb255(theme.tableHeaderBackground);
  const headerText = toRgb255(theme.tableHeaderTextColor);

  // Header background
  page.drawRectangle({ x, y: startY, width: tableWidth, height: rowHeight, color: rgb(headerBg.r / 255, headerBg.g / 255, headerBg.b / 255) });
  // Columns: Name (60%), Qty (20%), Unit (20%)
  const colNameW = tableWidth * 0.6;
  const colQtyW = tableWidth * 0.2;
  const colUnitW = tableWidth * 0.2;

  page.drawText("Item", { x: x + 8, y: startY + 6, size: 11, font: fontBold, color: rgb(headerText.r / 255, headerText.g / 255, headerText.b / 255) });
  page.drawText("Qty", { x: x + colNameW + 8, y: startY + 6, size: 11, font: fontBold, color: rgb(headerText.r / 255, headerText.g / 255, headerText.b / 255) });
  page.drawText("Unit", { x: x + colNameW + colQtyW + 8, y: startY + 6, size: 11, font: fontBold, color: rgb(headerText.r / 255, headerText.g / 255, headerText.b / 255) });

  let y = startY - rowHeight;
  if (!items || items.length === 0) {
    page.drawText("No items", { x: x + 8, y: y + 6, size: 10, font: fontRegular, color: rgb(0.5, 0.5, 0.5) });
    return y;
  }

  items.forEach((it) => {
    // Row line
    page.drawLine({ start: { x, y }, end: { x: x + tableWidth, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
    page.drawText(String(it.name || "-"), { x: x + 8, y: y + 6, size: 10, font: fontRegular });
    page.drawText(String(it.qty ?? 0), { x: x + colNameW + 8, y: y + 6, size: 10, font: fontRegular });
    page.drawText(String(it.unit || "pcs"), { x: x + colNameW + colQtyW + 8, y: y + 6, size: 10, font: fontRegular });
    y -= rowHeight;
  });

  return y;
}

function drawShipmentInfo(page: PDFPage, fontRegular: PDFFont, fontBold: PDFFont, theme: InvoiceTemplateTheme, info: { senderName?: string; expedition?: string; shipDate?: string; etaDate?: string; note?: string; driverName?: string; vehicleNumber?: string }, yStart: number) {
  const x = 40;
  const labelSize = 10;
  const valueSize = 11;
  const titleY = yStart - 12;
  page.drawText("Shipment Info", { x, y: titleY, size: 12, font: fontBold });

  const lines = [
    { label: "Sender", value: info.senderName || "-" },
    { label: "Expedition", value: info.expedition || "-" },
    { label: "Ship Date", value: info.shipDate || "-" },
    { label: "ETA", value: info.etaDate || "-" },
    { label: "Driver", value: info.driverName ? `${info.driverName} (${info.vehicleNumber || '-'})` : "-" },
    { label: "Note", value: info.note || "-" },
  ];

  let y = titleY - 18;
  lines.forEach((ln) => {
    page.drawText(`${ln.label}:`, { x, y, size: labelSize, font: fontRegular, color: rgb(0.3, 0.3, 0.3) });
    page.drawText(String(ln.value), { x: x + 70, y, size: valueSize, font: fontBold });
    y -= 16;
  });
  return y;
}

export const POST = createApiHandler({
  handler: async (req, body: CreatePdfBody, { activeBrand, user }) => {
    const {
      number = "",
      date = "",
      refInvoice = "",
      receiverName = "",
      receiverAddress = "",
      receiverPhone = "",
      items = [],
      senderName = "",
      expedition = "",
      shipDate = "",
      etaDate = "",
      note = "",
      driverName = "",
      vehicleNumber = "",
      brandSlug = "",
      templateId,
      brandOverrides,
    } = body || {};

    let brand = activeBrand;
    if (brandSlug && brandSlug !== activeBrand.slug) {
      const other = await prisma.brandProfile.findUnique({ where: { slug: brandSlug } });
      if (other) {
        const allowed = await resolveAllowedBrandIds(user.userId, user.roles || [], []);
        if (allowed.length && !allowed.includes(other.id)) {
          return NextResponse.json({ success: false, message: "Forbidden: brand scope" }, { status: 403 });
        }
        brand = other as any;
      }
    }

    if (brandOverrides && typeof brandOverrides === "object") {
      const overrides = brandOverrides as Record<string, unknown>;
      if (overrides.primaryColor) (brand as any).primaryColor = overrides.primaryColor;
      if (overrides.secondaryColor) (brand as any).secondaryColor = overrides.secondaryColor;
      if (overrides.footerText) (brand as any).footerText = overrides.footerText;
      if (overrides.paymentInfo) (brand as any).paymentInfo = overrides.paymentInfo;
    }

    const theme: InvoiceTemplateTheme = resolveTheme(brand as any, templateId ?? ((brand as any)?.templateDefaults?.deliveryNote as string | undefined));

    // Build PDF
    const { pdf, font: fontRegular, bold: fontBold, extraBold } = await initPdfWithBrandFonts();
    const page = pdf.addPage([595.28, 841.89]); // A4
    const margin = 48;

    const headerBottomY = await drawHeaderCommon(
      pdf,
      page,
      brand as any,
      theme,
      "DELIVERY NOTE",
      [
        { label: "Delivery No", value: number || "-" },
        { label: "Date", value: date || "-" },
        { label: "Ref Invoice", value: refInvoice || "-" },
      ],
      fontRegular,
      fontBold,
      extraBold,
      margin
    );

    const actor = { name: senderName || ((brand as any).name || "Sender"), email: (brand as any).email || null, phone: (brand as any).phone || null };
    const pseudoCustomer = { company: receiverName || "Receiver", address: receiverAddress || "", phone: receiverPhone || "" };
    const infoBottomY = drawInfoSectionCommon(
      page,
      theme,
      brand as any,
      actor,
      pseudoCustomer,
      fontRegular,
      fontBold,
      margin,
      headerBottomY
    );
    const tableStartY = Math.min(infoBottomY - 24, page.getHeight() - 220);
    const itemsEndY = drawItemsTable(
      page,
      fontRegular,
      fontBold,
      theme,
      Array.isArray(items) ? items.map((i: any) => ({ name: i?.name || "", qty: Number(i?.qty || 0), unit: i?.unit || "pcs" })) : [],
      tableStartY
    );
    const shipEndY = drawShipmentInfo(page, fontRegular, fontBold, theme, { senderName, expedition, shipDate, etaDate, note, driverName, vehicleNumber }, itemsEndY - 20);

    const signatureResult = await drawSignatureColumnsCommon(
      pdf,
      page,
      theme,
      fontRegular,
      fontBold,
      margin,
      shipEndY - 10,
      [
        { title: "Receiver", caption: receiverName ? String(receiverName) : "(Sign & Name)" },
        { title: "Sender", caption: senderName ? String(senderName) : "(Sign & Name)" },
        { title: "Acknowledged By", caption: "(Sign & Name)" },
      ],
      64,
      [
        { index: 1, imageUrl: (brand as any).signatureImageUrl || ((brand as any).templateDefaults?.signatureImageUrl as string | undefined) }
      ]
    );

    // Footer: thank you & payments, standardized under signature
    const thank = resolveThankYou(theme);
    const payLines = resolvePaymentLines(brand as any);
    let yFooter = signatureResult.finalY - 6;
    page.drawText(thank.message, { x: margin, y: yFooter, size: 11, font: fontBold });
    yFooter -= 16;
    payLines.forEach((ln: string) => {
      if (!ln) return;
      page.drawText(ln, { x: margin, y: yFooter, size: 10, font: fontRegular, color: rgb(0.3, 0.3, 0.3) });
      yFooter -= 14;
    });

    const bytes = await pdf.save();
    const fileName = formatPdfFileName(number, receiverName, number || "Delivery", receiverName || "Receiver");
    const ab = (bytes.buffer as ArrayBuffer).slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    return new Response(ab, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${fileName}"` } });
  }
});
