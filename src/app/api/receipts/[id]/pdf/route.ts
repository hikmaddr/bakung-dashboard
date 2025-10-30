"use server";

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveBrandProfile } from "@/lib/brand";
import { initPdfWithBrandFonts, drawHeaderCommon, drawInfoSectionCommon, drawSignatureSectionCommon } from "@/lib/pdfCommon";
import { resolveTheme, resolveThankYou, resolvePaymentLines, DEFAULT_TERMS, toRgb255, type InvoiceTemplateTheme } from "@/lib/quotationTheme";
import { getAuth } from "@/lib/auth";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";

const toRGB = ({ r, g, b }: { r: number; g: number; b: number }) => rgb(r / 255, g / 255, b / 255);
const isLightHex = (hex?: string | null) => {
  if (!hex) return true;
  const { r, g, b } = toRgb255(hex);
  const luminance = 0.2126 * (r / 255) + 0.7152 * (g / 255) + 0.0722 * (b / 255);
  return luminance > 0.6;
};

const drawItemsTable = (
  page: PDFPage,
  font: PDFFont,
  bold: PDFFont,
  theme: InvoiceTemplateTheme,
  startY: number,
  items: Array<{ name: string; description?: string | null; qty: number; unit?: string | null; price: number; subtotal: number }>
) => {
  const { width } = page.getSize();
  const margin = 48;
  const tableWidth = width - margin * 2;
  const headerHeight = 26;
  const zebraColor = toRGB(toRgb255(theme.zebraRowColor));
  const borderColor = toRGB(toRgb255(theme.tableBorderColor));
  const headerBg = toRGB(toRgb255(theme.totalBackground));
  const headerTextColor = isLightHex(theme.totalBackground)
    ? toRGB(toRgb255(theme.headerTextColor))
    : toRGB(toRgb255(theme.totalTextColor));

  const columns = [
    { key: "description", width: 0.5, align: "left" as const },
    { key: "qty", width: 0.12, align: "center" as const },
    { key: "unit", width: 0.12, align: "center" as const },
    { key: "price", width: 0.13, align: "right" as const },
    { key: "amount", width: 0.13, align: "right" as const },
  ];

  const columnWidths = columns.map((column) => tableWidth * column.width);

  let y = startY;

  page.drawRectangle({ x: margin, y: y - headerHeight, width: tableWidth, height: headerHeight, color: headerBg });
  let columnX = margin;
  const headerLabels = ["Description", "Qty", "Unit", "Price", "Amount"];
  headerLabels.forEach((label, index) => {
    const column = columns[index];
    const colWidth = columnWidths[index];
    const textWidth = bold.widthOfTextAtSize(label, 10);
    let textX = columnX + 12;
    if (column.align === "center") textX = columnX + colWidth / 2 - textWidth / 2;
    else if (column.align === "right") textX = columnX + colWidth - textWidth - 12;
    page.drawText(label, {
      x: textX,
      y: y - headerHeight / 2 - 4,
      font: bold,
      size: 10,
      color: headerTextColor,
    });
    columnX += colWidth;
  });

  y -= headerHeight + 4;

  items.forEach((item, index) => {
    const rowHeight = Math.max(26, item.description ? 38 : 26);
    if (index % 2 === 0) {
      page.drawRectangle({ x: margin, y: y - rowHeight + 4, width: tableWidth, height: rowHeight, color: zebraColor });
    }

    let cellX = margin;
    columns.forEach((column, columnIndex) => {
      const colWidth = columnWidths[columnIndex];
      let value = "";
      let align = column.align;
      switch (column.key) {
        case "description":
          value = item.name || "-";
          align = "left";
          break;
        case "qty":
          value = normalizeNumber(item.qty).toLocaleString("id-ID");
          break;
        case "unit":
          value = item.unit || "pcs";
          break;
        case "price":
          value = formatCurrency(item.price);
          break;
        case "amount":
          value = formatCurrency(item.subtotal);
          break;
      }
      const fontToUse = column.key === "amount" ? bold : font;
      const size = column.key === "description" ? 11 : 10;
      const textWidth = fontToUse.widthOfTextAtSize(value, size);
      let textX = cellX + 12;
      if (align === "center") textX = cellX + colWidth / 2 - textWidth / 2;
      else if (align === "right") textX = cellX + colWidth - textWidth - 12;
      const textY = y - (rowHeight + size) / 2 + size;
      page.drawText(value, { x: textX, y: textY, font: fontToUse, size, color: toRGB(toRgb255(theme.headerTextColor)) });
      if (column.key === "description" && item.description) {
        const descriptionSize = 9;
        const descY = textY - descriptionSize - 4;
        page.drawText(item.description, {
          x: cellX + 12,
          y: descY,
          font,
          size: descriptionSize,
          color: toRGB(toRgb255(theme.mutedText)),
        });
      }
      cellX += colWidth;
    });

    y -= rowHeight;
  });

  return y - 8;
};

const formatCurrency = (value: number | null | undefined) =>
  `Rp ${normalizeNumber(value ?? 0).toLocaleString("id-ID")}`;

const normalizeNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const receiptId = Number(id);
    if (Number.isNaN(receiptId)) {
      return NextResponse.json({ success: false, message: "ID tidak valid" }, { status: 400 });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: receiptId },
      include: { customer: true, items: true },
    });
    if (!invoice) {
      return NextResponse.json({ success: false, message: "Invoice tidak ditemukan" }, { status: 404 });
    }

    let brand = null as any;
    try {
      if ((invoice as any).brandProfileId) {
        brand = await prisma.brandProfile.findUnique({ where: { id: (invoice as any).brandProfileId } });
      }
      if (!brand) brand = await getActiveBrandProfile();
    } catch {}

    if (!brand) {
      return NextResponse.json({ success: false, message: "Brand aktif tidak ditemukan" }, { status: 404 });
    }

    const auth = await getAuth();
    const actorName = auth?.user?.name || brand.name || "Kasir";
    const theme = resolveTheme(brand as any);

    const { pdf, font, bold, extraBold } = await initPdfWithBrandFonts();
    const page = pdf.addPage([595, 842]);
    const margin = 48;

    const headerBottomY = await drawHeaderCommon(
      pdf,
      page,
      brand as any,
      theme,
      "RECEIPT",
      [
        { label: "Number", value: String(invoice.invoiceNumber || `INV-${invoice.id}`) },
        { label: "Date", value: new Date(invoice.issueDate || invoice.createdAt).toLocaleDateString("id-ID") },
      ],
      font,
      bold,
      extraBold,
      margin
    );

    const infoBottomY = drawInfoSectionCommon(
      page,
      theme,
      brand as any,
      { name: actorName, email: brand.email || null, phone: brand.phone || null },
      invoice.customer,
      font,
      bold,
      margin,
      headerBottomY
    );

    const withSubtotals = (invoice.items || []).map((item) => ({
      name: item.name,
      description: item.description,
      qty: normalizeNumber(item.qty),
      unit: item.unit || "pcs",
      price: normalizeNumber(item.price),
      subtotal: normalizeNumber(item.qty) * normalizeNumber(item.price),
    }));

    const tableBottomY = drawItemsTable(page, font, bold, theme, infoBottomY - 12, withSubtotals);

    const totalsStartY = tableBottomY - 20;
    const totals = [
      { label: "Subtotal", value: formatCurrency(invoice.subtotal ?? withSubtotals.reduce((acc, item) => acc + item.subtotal, 0)) },
      ...(normalizeNumber(invoice.lineDiscount) > 0
        ? [{ label: "Line Discount", value: `- ${formatCurrency(invoice.lineDiscount)}` }]
        : []),
      ...(normalizeNumber(invoice.shippingCost) > 0
        ? [{ label: "Shipping", value: formatCurrency(invoice.shippingCost) }]
        : []),
      ...(normalizeNumber(invoice.taxAmount) > 0
        ? [{ label: "Tax", value: formatCurrency(invoice.taxAmount) }]
        : []),
      ...(normalizeNumber(invoice.downPayment) > 0
        ? [{ label: "Down Payment", value: `- ${formatCurrency(invoice.downPayment)}` }]
        : []),
    ];

    totals.forEach((total, index) => {
      page.drawText(total.label, {
        x: margin,
        y: totalsStartY - index * 14,
        font,
        size: 10,
        color: toRGB(toRgb255(theme.mutedText)),
      });
      page.drawText(total.value, {
        x: margin + 160,
        y: totalsStartY - index * 14,
        font,
        size: 10,
        color: toRGB(toRgb255(theme.headerTextColor)),
      });
    });

    const cardWidth = 220;
    const cardHeight = 64;
    const cardX = page.getWidth() - margin - cardWidth;
    const cardY = totalsStartY + 10;
    const cardBg = toRGB(toRgb255(theme.totalBackground));
    const cardFg = isLightHex(theme.totalBackground)
      ? toRGB(toRgb255(theme.headerTextColor))
      : toRGB(toRgb255(theme.totalTextColor));

    page.drawRectangle({ x: cardX, y: cardY - cardHeight, width: cardWidth, height: cardHeight, color: cardBg });
    page.drawText("TOTAL", { x: cardX + 14, y: cardY - 18, font: bold, size: 11, color: cardFg });
    page.drawText(formatCurrency(invoice.total), {
      x: cardX + 14,
      y: cardY - 38,
      font: bold,
      size: 18,
      color: cardFg,
    });

    const thankYou = resolveThankYou(brand as any);
    const paymentText = resolvePaymentLines(brand as any);

    let notesY = cardY - cardHeight - 24;
    page.drawText("NOTES", { x: margin, y: notesY, font: bold, size: 10, color: toRGB(toRgb255(theme.headerAccentColor)) });
    notesY -= 14;
    const notes = (receipt.notes || "").trim();
    if (notes) {
      const lines = notes.split(/\r?\n/);
      lines.forEach((line) => {
        page.drawText(line, { x: margin, y: notesY, font, size: 9, color: toRGB(toRgb255(theme.mutedText)) });
        notesY -= 12;
      });
    } else {
      page.drawText("Tidak ada catatan tambahan.", {
        x: margin,
        y: notesY,
        font,
        size: 9,
        color: toRGB(toRgb255(theme.mutedText)),
      });
      notesY -= 12;
    }

    page.drawText("PAYMENT INFO", {
      x: margin,
      y: notesY,
      font: bold,
      size: 10,
      color: toRGB(toRgb255(theme.headerAccentColor)),
    });
    notesY -= 14;
    (paymentText.length ? paymentText : ["Silakan hubungi kami untuk informasi pembayaran."])
      .slice(0, 6)
      .forEach((line) => {
        page.drawText(line, { x: margin, y: notesY, font, size: 9, color: toRGB(toRgb255(theme.mutedText)) });
        notesY -= 12;
      });

    page.drawText("TERMS & CONDITIONS", {
      x: margin,
      y: notesY,
      font: bold,
      size: 10,
      color: toRGB(toRgb255(theme.headerAccentColor)),
    });
    notesY -= 14;
    const terms = (receipt.terms || brand.termsConditions || DEFAULT_TERMS.join("\n"))
      .split(/\r?\n/)
      .filter((line) => line.trim().length)
      .slice(0, 8);
    terms.forEach((line) => {
      page.drawText(`- ${line}`, {
        x: margin,
        y: notesY,
        font,
        size: 9,
        color: toRGB(toRgb255(theme.mutedText)),
      });
      notesY -= 12;
    });

    notesY -= 18;
    await drawSignatureSectionCommon(
      pdf,
      page,
      theme,
      brand as any,
      { name: actorName },
      bold,
      margin,
      notesY,
      1
    );

    const bytes = await pdf.save();
    const fileName = `Receipt-${String(invoice.invoiceNumber || "INV").replace(/[^a-zA-Z0-9-_]/g, "_")}.pdf`;
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

    return new Response(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("[receipts/pdf] error", error);
    return NextResponse.json({ success: false, message: "Gagal membuat PDF" }, { status: 500 });
  }
}
