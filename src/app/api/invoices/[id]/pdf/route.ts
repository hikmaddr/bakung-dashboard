"use server";

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveBrandProfile } from "@/lib/brand";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "fs/promises";
import path from "path";
import {
  resolveTheme,
  resolveThankYou,
  resolvePaymentLines,
  DEFAULT_TERMS,
  toRgb255,
  type InvoiceTemplateTheme,
} from "@/lib/quotationTheme";
import { toRgb, splitTextToSize } from "@/lib/pdfCommon";
import { getAuth } from "@/lib/auth";

const toRGB = ({ r, g, b }: { r: number; g: number; b: number }) => rgb(r / 255, g / 255, b / 255);

interface BrandProfile {
  id: number;
  name: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  overview?: string | null;
  website?: string | null;
  email?: string | null;
  address?: string | null;
  phone?: string | null;
  footerText?: string | null;
  isActive?: boolean;
  templateDefaults?: Record<string, unknown> | null;
  paymentInfo?: string | null;
  termsConditions?: string | null;
  showBrandName?: boolean | null;
  showBrandDescription?: boolean | null;
  showBrandEmail?: boolean | null;
  showBrandWebsite?: boolean | null;
  showBrandAddress?: boolean | null;
}

function drawRoundedRect(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  options: { color?: ReturnType<typeof rgb>; borderColor?: ReturnType<typeof rgb>; borderWidth?: number; opacity?: number } = {}
) {
  const r = Math.max(0, Math.min(radius, Math.min(width / 2, height / 2)));
  const pathData = `M ${x + r} ${y} L ${x + width - r} ${y} Q ${x + width} ${y} ${x + width} ${y + r} L ${x + width} ${y + height - r} Q ${x + width} ${y + height} ${x + width - r} ${y + height} L ${x + r} ${y + height} Q ${x} ${y + height} ${x} ${y + height - r} L ${x} ${y + r} Q ${x} ${y} ${x + r} ${y} Z`;
  page.drawSvgPath(pathData, {
    color: options.color,
    borderColor: options.borderColor,
    borderWidth: options.borderWidth ?? (options.borderColor ? 1 : 0),
    opacity: options.opacity ?? 1,
  });
}

const itemImageCache = new Map<string, { image: PDFImage; width: number; height: number }>();
const PUBLIC_DIR = path.join(process.cwd(), "public");

const loadImageBytes = async (source: string): Promise<Uint8Array | null> => {
  try {
    if (!source) return null;
    if (source.startsWith("http")) {
      const res = await fetch(source);
      if (!res.ok) return null;
      const buf = await res.arrayBuffer();
      return new Uint8Array(buf);
    }
    const localPath = source.startsWith("/") ? path.join(PUBLIC_DIR, source) : path.join(PUBLIC_DIR, source);
    const exists = await fs.stat(localPath).then(() => true).catch(() => false);
    if (!exists) return null;
    const bytes = await fs.readFile(localPath);
    return new Uint8Array(bytes);
  } catch {
    return null;
  }
};

const embedItemImage = async (
  pdfDoc: PDFDocument,
  imageUrl?: string | null
): Promise<{ image: PDFImage; width: number; height: number } | null> => {
  try {
    if (!imageUrl) return null;
    const cached = itemImageCache.get(imageUrl);
    if (cached) return cached;
    const bytes = await loadImageBytes(imageUrl);
    if (!bytes) return null;
    let image: PDFImage | null = null;
    if (imageUrl.toLowerCase().endsWith(".png")) image = await pdfDoc.embedPng(bytes);
    else image = await pdfDoc.embedJpg(bytes);
    if (!image) return null;
    const payload = { image, width: image.width, height: image.height };
    itemImageCache.set(imageUrl, payload);
    return payload;
  } catch {
    return null;
  }
};

const toNumber = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const formatCurrency = (value: number) => `Rp ${Math.round(Math.abs(value)).toLocaleString("id-ID")}`;
const formatSignedCurrency = (value: number) => (value < 0 ? `- ${formatCurrency(value)}` : formatCurrency(value));

type TableOptions = {
  showImage?: boolean;
  showDescription?: boolean;
  scale?: number;
};

const drawItemsTable = async (
  pdf: PDFDocument,
  currentPage: PDFPage,
  items: Array<{
    product?: string | null;
    description?: string | null;
    quantity?: number | null;
    unit?: string | null;
    price?: number | null;
    subtotal?: number | null;
    imageUrl?: string | null;
  }>,
  theme: InvoiceTemplateTheme,
  font: PDFFont,
  bold: PDFFont,
  margin: number,
  startY: number,
  options: TableOptions = {}
): Promise<{ page: PDFPage; finalY: number; total: number }> => {
  const s = Math.max(0.6, Math.min(1, options.scale ?? 0.85));
  const safeBottom = margin + Math.max(100, Math.floor(120 * s));
  const baseWidth = currentPage.getSize().width - margin * 2;
  const tableWidth = Math.round(baseWidth);
  const tableLeft = margin;
  const baseColumns =
    options.showImage
      ? [
          { key: "description" as const, label: "Description", ratio: 0.34, align: "left" as const },
          { key: "image" as const, label: "Image", ratio: 0.16, align: "center" as const },
          { key: "qty" as const, label: "Qty", ratio: 0.1, align: "center" as const },
          { key: "unit" as const, label: "Unit", ratio: 0.12, align: "center" as const },
          { key: "price" as const, label: "Price", ratio: 0.14, align: "right" as const },
          { key: "amount" as const, label: "Amount", ratio: 0.14, align: "right" as const },
        ]
      : [
          { key: "description" as const, label: "Description", ratio: 0.5, align: "left" as const },
          { key: "qty" as const, label: "Qty", ratio: 0.1, align: "center" as const },
          { key: "unit" as const, label: "Unit", ratio: 0.12, align: "center" as const },
          { key: "price" as const, label: "Price", ratio: 0.14, align: "right" as const },
          { key: "amount" as const, label: "Amount", ratio: 0.14, align: "right" as const },
        ];

  let widthTracker = 0;
  const columns = baseColumns.map((column, index) => {
    const isLast = index === baseColumns.length - 1;
    const rawWidth = isLast ? tableWidth - widthTracker : Math.round(column.ratio * tableWidth);
    widthTracker += rawWidth;
    return { ...column, width: rawWidth };
  });

  const imageIndex = columns.findIndex((c) => c.key === "image");
  const descriptionIndex = columns.findIndex((c) => c.key === "description");
  const descriptionWidth = columns[descriptionIndex]?.width ?? Math.max(200, Math.floor(260 * s));
  const paddingX = Math.max(12, Math.floor(14 * s));
  const paddingY = Math.max(6, Math.floor(8 * s));
  const headerHeight = Math.max(26, Math.floor(30 * s));
  const minRowHeight = Math.max(32, Math.floor(36 * s));
  const descriptionGap = Math.max(8, Math.floor(10 * s));
  const descriptionLineGap = Math.max(2, Math.floor(3 * s));
  const zebra = toRgb(theme.zebraRowColor);
  const border = toRgb(theme.tableBorderColor);
  const headerTextColor = rgb(1, 1, 1);
  const primaryText = toRgb(theme.textColor);
  const mutedText = toRgb(theme.mutedText);

  let page = currentPage;
  let y = startY;
  const columnWidths = columns.map((column) => column.width);

  const goToNextPage = () => {
    page = pdf.addPage();
    y = page.getSize().height - margin;
    drawHeaderRow();
    y -= headerHeight;
    y -= Math.max(6, Math.floor(8 * s));
  };

  const drawHeaderRow = () => {
    page.drawRectangle({
      x: tableLeft,
      y: y - headerHeight,
      width: tableWidth,
      height: headerHeight,
      color: toRGB(toRgb255(theme.tableHeaderColor)),
    });
    let currentX = tableLeft;
    const headerSize = Math.max(9, Math.floor(10 * s));
    columns.forEach((column, columnIndex) => {
      const label = column.label;
      if (!label) return;
      const textWidth = bold.widthOfTextAtSize(label, headerSize);
      let textX = currentX + paddingX;
      if (column.align === "center") {
        textX = currentX + (columnWidths[columnIndex] - textWidth) / 2;
      } else if (column.align === "right") {
        textX = currentX + columnWidths[columnIndex] - paddingX - textWidth;
      }
      page.drawText(label, {
        x: textX,
        y: y - headerHeight / 2 - headerSize / 2 + 2,
        font: bold,
        size: headerSize,
        color: headerTextColor,
      });
      currentX += columnWidths[columnIndex];
    });
  };

  drawHeaderRow();
  y -= headerHeight;
  y -= Math.max(6, Math.floor(8 * s));

  let total = 0;

  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    const quantity = toNumber(item.quantity ?? 0);
    const price = toNumber(item.price ?? 0);
    const amount = toNumber(item.subtotal ?? quantity * price);

    const bodySize = Math.max(8, Math.floor(9 * s));
    const productSize = Math.max(9, Math.floor(11 * s));
    const rawDescriptionLines =
      options.showDescription && item.description
        ? splitTextToSize(String(item.description), descriptionWidth - paddingX * 2, font, bodySize)
        : [];
    const descriptionLines = rawDescriptionLines.slice(0, 3);
    const descriptionBlockHeight = descriptionLines.length
      ? descriptionLines.length * bodySize + (descriptionLines.length - 1) * descriptionLineGap
      : 0;
    let contentHeight = productSize;
    if (descriptionLines.length) {
      contentHeight += descriptionGap + descriptionBlockHeight;
    }
    let rowHeight = Math.max(minRowHeight, contentHeight + paddingY * 2);

    const embeddedImage = options.showImage ? await embedItemImage(pdf, item.imageUrl) : null;
    if (embeddedImage && imageIndex >= 0) {
      const imageColumnWidth = columnWidths[imageIndex];
      const maxImageWidth = Math.max(24, imageColumnWidth - paddingX * 2);
      const maxImageHeight = Math.max(24, rowHeight - paddingY * 2);
      const scale = Math.min(maxImageWidth / embeddedImage.width, maxImageHeight / embeddedImage.height, 1);
      const scaledHeight = embeddedImage.height * scale;
      rowHeight = Math.max(rowHeight, scaledHeight + paddingY * 2);
    }

    if (y - rowHeight < safeBottom) {
      goToNextPage();
      rowHeight = Math.max(rowHeight, minRowHeight);
    }

    const rowTop = y;
    const rowBottom = y - rowHeight;
    const rowInnerHeight = rowHeight - paddingY * 2;
    const blockHeight = contentHeight;
    const blockOffset = Math.max(0, (rowInnerHeight - blockHeight) / 2);

    if (index % 2 === 0) {
      page.drawRectangle({
        x: tableLeft,
        y: rowBottom,
        width: tableWidth,
        height: rowHeight,
        color: zebra,
      });
    }

    let colX = tableLeft;
    columns.forEach((column, columnIndex) => {
      const colWidth = columnWidths[columnIndex];
      if (column.key === "image") {
        if (embeddedImage) {
          const maxWidth = Math.max(24, colWidth - paddingX * 2);
          const maxHeight = Math.max(24, rowHeight - paddingY * 2);
          const scale = Math.min(maxWidth / embeddedImage.width, maxHeight / embeddedImage.height, 1);
          const imgWidth = embeddedImage.width * scale;
          const imgHeight = embeddedImage.height * scale;
          const imgX = colX + (colWidth - imgWidth) / 2;
          const imgY = rowBottom + (rowHeight - imgHeight) / 2;
          page.drawImage(embeddedImage.image, {
            x: imgX,
            y: imgY,
            width: imgWidth,
            height: imgHeight,
          });
        }
      } else if (column.key === "description") {
        const textX = colX + paddingX;
        let textY = rowTop - paddingY - blockOffset - productSize;
        const productText = item.product ? String(item.product) : "-";
        page.drawText(productText, {
          x: textX,
          y: textY,
          font: bold,
          size: productSize,
          color: primaryText,
          maxWidth: colWidth - paddingX * 2,
        });
        if (descriptionLines.length) {
          textY -= descriptionGap;
        }
        descriptionLines.forEach((line) => {
          page.drawText(line, {
            x: textX,
            y: textY,
            font,
            size: bodySize,
            color: mutedText,
            maxWidth: colWidth - paddingX * 2,
          });
          textY -= bodySize + descriptionLineGap;
        });
      } else {
        let display = "";
        let valueFont: PDFFont = font;
        let valueSize = bodySize;

        switch (column.key) {
          case "qty":
            display = quantity ? quantity.toLocaleString("id-ID") : "0";
            break;
          case "unit":
            display = item.unit ? String(item.unit) : "-";
            break;
          case "price":
            display = `Rp ${price.toLocaleString("id-ID")}`;
            break;
          case "amount":
            display = `Rp ${amount.toLocaleString("id-ID")}`;
            valueFont = bold;
            valueSize = bodySize + 1;
            break;
        }

        const textWidth = valueFont.widthOfTextAtSize(display, valueSize);
        let textX = colX + paddingX;
        if (column.align === "center") {
          textX = colX + (colWidth - textWidth) / 2;
        } else if (column.align === "right") {
          textX = colX + colWidth - paddingX - textWidth;
        }
        const textY = rowBottom + (rowHeight - valueSize) / 2;
        page.drawText(display, {
          x: textX,
          y: textY,
          font: valueFont,
          size: valueSize,
          color: column.key === "amount" ? primaryText : mutedText,
        });
      }

      colX += colWidth;
    });

    page.drawRectangle({
      x: margin,
      y: rowBottom,
      width: tableWidth,
      height: 0.8,
      color: border,
    });

    total += amount;
    y -= rowHeight;
  }

  return { finalY: y - Math.max(8, Math.floor(10 * s)), total, page };
};

type SummaryLine = { label: string; amount: number };

const drawTotalsAndNotesInvoice = (
  page: PDFPage,
  theme: InvoiceTemplateTheme,
  summaryLines: SummaryLine[],
  totalDue: number,
  notes: string | null | undefined,
  thankYouMessage: string,
  paymentLines: string[],
  termsLines: string[],
  font: PDFFont,
  bold: PDFFont,
  margin: number,
  startY: number,
  scale?: number
) => {
  const s = Math.max(0.6, Math.min(1, scale ?? 0.85));
  const contentWidth = page.getSize().width - margin * 2;
  const rightWidth = Math.max(180, Math.floor(contentWidth * 0.32));
  const gap = Math.max(18, Math.floor(24 * s));
  const leftWidth = contentWidth - rightWidth - gap;
  const rightX = margin + leftWidth + gap;

  const paddingX = Math.max(12, Math.floor(18 * s));
  const paddingY = Math.max(16, Math.floor(20 * s));
  const summarySize = Math.max(8, Math.floor(9 * s));
  const summarySpacing = Math.max(6, Math.floor(8 * s));
  const labelSize = Math.max(9, Math.floor(10 * s));
  const labelToAmountGap = Math.max(6, Math.floor(10 * s));
  let amountSize = Math.max(16, Math.floor(20 * s));
  const messageSize = Math.max(7, Math.floor(8 * s));
  const messageGap = thankYouMessage ? Math.max(8, Math.floor(12 * s)) : 0;
  const preTotalGap = summaryLines.length ? Math.max(12, Math.floor(16 * s)) : Math.max(10, Math.floor(14 * s));
  // Card hanya berisi label TOTAL DUE, jumlah, dan pesan footer
  let totalCardHeight = paddingY * 2 + labelSize + labelToAmountGap + amountSize + (thankYouMessage ? messageGap + messageSize : 0);
  
  // Pertama gambar baris ringkasan DI LUAR box (di atas box)
  let summaryCursor = startY; // mulai dari anchor startY
  const labelColor = toRGB(toRgb255(theme.mutedTextColor));
  const bodyColor = toRGB(toRgb255(theme.textColor));
  const highlightColor = toRGB(toRgb255(theme.headerTextColor));
  if (summaryLines.length) {
    summaryLines.forEach((line) => {
      summaryCursor -= summarySize;
      const valueText = formatSignedCurrency(line.amount);
      page.drawText(line.label, {
        x: rightX + paddingX,
        y: summaryCursor,
        font,
        size: summarySize,
        color: labelColor,
      });
      const valueWidth = bold.widthOfTextAtSize(valueText, summarySize);
      page.drawText(valueText, {
        x: rightX + rightWidth - paddingX - valueWidth,
        y: summaryCursor,
        font: bold,
        size: summarySize,
        color: highlightColor,
      });
      summaryCursor -= summarySpacing;
    });
    summaryCursor += summarySpacing; // pulihkan 1 langkah terakhir
    summaryCursor -= preTotalGap; // jarak sebelum box total
  }
  
  // Tentukan posisi box total berdasarkan summaryCursor
  const cardTop = summaryCursor;
  const cardBottom = cardTop - totalCardHeight;

  // Background fill and rounded border to match SO total card styling
  page.drawRectangle({ x: rightX, y: cardBottom, width: rightWidth, height: totalCardHeight, color: toRgb(theme.totalBackground) });
  drawRoundedRect(page, rightX, cardBottom, rightWidth, totalCardHeight, 10, {
    color: toRgb(theme.totalBackground),
    borderColor: toRgb(theme.tableBorderColor),
    borderWidth: 1,
    opacity: 1,
  });

  // Isi dalam box: label TOTAL DUE, jumlah, dan pesan
  let cursor = cardTop - paddingY;
  cursor -= labelSize;
  const totalLabel = "TOTAL DUE";
  const totalLabelWidth = bold.widthOfTextAtSize(totalLabel, labelSize);
  page.drawText(totalLabel, {
    x: rightX + rightWidth - paddingX - totalLabelWidth,
    y: cursor,
    font: bold,
    size: labelSize,
    color: toRgb(theme.totalTextColor ?? theme.headerTextColor),
  });

  cursor -= labelToAmountGap;
  cursor -= amountSize;
  const totalText = formatCurrency(totalDue);
  let amountWidth = bold.widthOfTextAtSize(totalText, amountSize);
  const availableWidth = rightWidth - paddingX * 2;
  if (amountWidth > availableWidth) {
    const scaleDown = availableWidth / amountWidth;
    amountSize = Math.max(14, Math.floor(amountSize * scaleDown));
    amountWidth = bold.widthOfTextAtSize(totalText, amountSize);
  }
  page.drawText(totalText, {
    x: rightX + rightWidth - paddingX - amountWidth,
    y: cursor,
    font: bold,
    size: amountSize,
    color: toRgb(theme.totalTextColor ?? theme.headerTextColor),
  });

  if (thankYouMessage) {
    cursor -= messageGap;
    cursor -= messageSize;
    const msgWidth = font.widthOfTextAtSize(thankYouMessage, messageSize);
    page.drawText(thankYouMessage, {
      x: rightX + rightWidth - paddingX - msgWidth,
      y: cursor,
      font,
      size: messageSize,
      color: toRgb(theme.totalTextColor ?? theme.headerTextColor),
    });
  }

  const leftX = margin;
  let py = startY - Math.max(14, Math.floor(16 * s));
  const titleSize = Math.max(9, Math.floor(10 * s));
  const bodySize = Math.max(8, Math.floor(9 * s));
  const sectionSpacing = Math.max(16, Math.floor(20 * s));

  page.drawText("NOTES", { x: leftX, y: py, font: bold, size: titleSize, color: labelColor });
  py -= Math.max(14, Math.floor(16 * s));
  const noteLines = notes && String(notes).trim().length > 0 ? splitTextToSize(String(notes), leftWidth, font, bodySize) : ["-"];
  for (const line of noteLines.slice(0, 12)) {
    page.drawText(line, { x: leftX, y: py, font, size: bodySize, color: bodyColor });
    py -= bodySize + Math.max(4, Math.floor(5 * s));
  }
  py -= sectionSpacing;

  page.drawText("PAYMENT INFO", { x: leftX, y: py, font: bold, size: titleSize, color: labelColor });
  py -= Math.max(14, Math.floor(16 * s));
  for (const line of paymentLines.slice(0, 6)) {
    const wrapped = splitTextToSize(line, leftWidth, font, bodySize);
    for (const w of wrapped) {
      page.drawText(w, { x: leftX, y: py, font, size: bodySize, color: bodyColor });
      py -= bodySize + Math.max(4, Math.floor(5 * s));
    }
  }
  py -= sectionSpacing;

  page.drawText("TERMS & CONDITIONS", { x: leftX, y: py, font: bold, size: titleSize, color: labelColor });
  py -= Math.max(14, Math.floor(16 * s));
  for (const line of termsLines.slice(0, 10)) {
    const wrapped = splitTextToSize(line, leftWidth, font, bodySize);
    for (const w of wrapped) {
      page.drawText(w, { x: leftX, y: py, font, size: bodySize, color: bodyColor });
      py -= bodySize + Math.max(4, Math.floor(5 * s));
    }
  }

  return Math.min(py, cardBottom - Math.max(24, Math.floor(32 * s)));
};

const drawSignatureSection = async (
  pdf: PDFDocument,
  currentPage: PDFPage,
  theme: InvoiceTemplateTheme,
  brand: BrandProfile,
  actor: { name: string; email?: string | null; phone?: string | null },
  bold: PDFFont,
  margin: number,
  startY: number,
  scale?: number
): Promise<{ page: PDFPage; finalY: number }> => {
  let page = currentPage;
  let cursorY = startY;
  const s = Math.max(0.6, Math.min(1, scale ?? 1));
  const requiredHeight = Math.max(120, Math.floor(160 * s));

  if (cursorY < margin + requiredHeight) {
    page = pdf.addPage();
    cursorY = page.getSize().height - margin;
  }

  const { width } = page.getSize();
  const sectionWidth = Math.max(180, Math.floor(220 * s));
  const x = width - margin - sectionWidth;
  const title = "Hormat Kami";
  const titleSize = Math.max(8, Math.floor(10 * s));
  const titleWidth = bold.widthOfTextAtSize(title, titleSize);
  const titleY = cursorY - Math.max(14, Math.floor(18 * s));

  page.drawText(title, {
    x: x + (sectionWidth - titleWidth) / 2,
    y: titleY,
    size: titleSize,
    font: bold,
    color: toRgb(theme.headerTextColor),
  });

  // Signature image above the line (if configured)
  const paddingTop = Math.max(8, Math.floor(10 * s));
  const maxImageH = Math.max(72, Math.floor(96 * s));
  let imageHUsed = 0;
  const sigUrl = (brand as any).signatureImageUrl || ((brand.templateDefaults || {}) as Record<string, unknown>)["signatureImageUrl"] as string | undefined;
  if (sigUrl) {
    const bytes = await (async () => {
      try {
        const absoluteUrl = sigUrl.startsWith("http") ? sigUrl : `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}${sigUrl.startsWith("/") ? sigUrl : `/${sigUrl}`}`;
        return await loadImageBytes(absoluteUrl);
      } catch {
        return null;
      }
    })();
    if (bytes) {
      let image: PDFImage | null = null;
      try {
        image = await pdf.embedPng(bytes);
      } catch {
        try { image = await pdf.embedJpg(bytes); } catch { image = null; }
      }
      if (image) {
        const { width: iw, height: ih } = image.scale(1);
        const scale = Math.min((sectionWidth - 24) / iw, maxImageH / ih, 1);
        const w = iw * scale;
        const h = ih * scale;
        imageHUsed = h;
        const imgX = x + (sectionWidth - w) / 2;
        const imgY = titleY - paddingTop - h;
        page.drawImage(image, { x: imgX, y: imgY, width: w, height: h });
      }
    }
  }

  const lineY = titleY - (imageHUsed > 0 ? paddingTop + imageHUsed + Math.max(8, Math.floor(10 * s)) : Math.max(48, Math.floor(64 * s)));
  const lineInset = Math.max(24, Math.floor(28 * s));
  page.drawRectangle({
    x: x + lineInset,
    y: lineY,
    width: sectionWidth - lineInset * 2,
    height: 0.8,
    color: toRgb(theme.tableBorderColor),
  });

  const signatureName = actor.name || brand.name || "Authorized Signature";
  const nameSize = Math.max(8, Math.floor(10 * s));
  const nameWidth = bold.widthOfTextAtSize(signatureName, nameSize);
  page.drawText(signatureName, {
    x: x + (sectionWidth - nameWidth) / 2,
    y: lineY - 12,
    size: nameSize,
    font: bold,
    color: toRgb(theme.headerTextColor),
  });

  return { page, finalY: lineY - 24 };
};

const buildInvoiceSummary = (invoice: any): { summary: SummaryLine[]; totalDue: number } => {
  const subtotal = Number(invoice.subtotal || 0);
  const lineDiscount = Number(invoice.lineDiscount || 0);
  const baseAfterLine = Math.max(0, subtotal - lineDiscount);
  const extraType = String(invoice.extraDiscountType || "amount");
  const extraValue = Number(invoice.extraDiscountValue || 0);
  let extraDiscountAmount = 0;
  if (extraValue > 0) {
    if (extraType === "percent") {
      extraDiscountAmount = Math.round((baseAfterLine * Math.max(0, Math.min(100, extraValue))) / 100);
    } else {
      extraDiscountAmount = Math.min(baseAfterLine, Math.max(0, extraValue));
    }
  }
  const afterExtra = Math.max(0, baseAfterLine - extraDiscountAmount);
  const shippingCost = Number(invoice.shippingCost || 0);
  const basePlusShip = Math.max(0, afterExtra + shippingCost);
  const taxMode = String(invoice.taxMode || "none");
  const taxAmount = Number(invoice.taxAmount || 0);
  const taxInclusive = taxMode.endsWith("inclusive");
  const totalBeforeDP = taxInclusive ? basePlusShip : Math.max(0, basePlusShip + taxAmount);
  const downPayment = Number(invoice.downPayment || 0);
  const totalDue = Number(invoice.total || Math.max(0, totalBeforeDP - downPayment));

  const summary: SummaryLine[] = [];
  summary.push({ label: "Subtotal", amount: subtotal });
  if (lineDiscount > 0) summary.push({ label: "Line Discount", amount: -lineDiscount });
  if (extraDiscountAmount > 0) {
    const label = extraType === "percent" ? `Extra Discount (${extraValue}%)` : "Extra Discount";
    summary.push({ label, amount: -extraDiscountAmount });
  }
  if (shippingCost > 0) summary.push({ label: "Shipping", amount: shippingCost });
  if (taxAmount > 0) {
    const label = taxMode && taxMode !== "none" ? `Tax (${taxMode.replace(/_/g, " ").toUpperCase()})` : "Tax";
    summary.push({ label, amount: taxAmount });
  }
  // Remove "Total Before DP" from summary output per request
  if (downPayment > 0) summary.push({ label: "Down Payment", amount: -downPayment });

  return { summary, totalDue };
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const numericId = Number(id);

    let invoice = await prisma.invoice.findUnique({
      where: { id: Number.isFinite(numericId) ? numericId : -1 },
      include: { customer: true, items: true },
    });

    if (!invoice && id && !Number.isFinite(numericId)) {
      invoice = await prisma.invoice.findFirst({
        where: { invoiceNumber: String(id) },
        include: { customer: true, items: true },
      });
    }

    if (!invoice) {
      return NextResponse.json({ success: false, message: "Invoice tidak ditemukan" }, { status: 404 });
    }

    let brand: BrandProfile | null = null;
    try {
      if ((invoice as any).brandProfileId) {
        brand = await prisma.brandProfile.findUnique({ where: { id: (invoice as any).brandProfileId } }) as BrandProfile | null;
      }
      if (!brand) brand = (await getActiveBrandProfile()) as BrandProfile | null;
    } catch {
      // ignore
    }
    if (!brand) {
      return NextResponse.json({ success: false, message: "Brand aktif tidak ditemukan" }, { status: 404 });
    }

    const templateDefaults = (brand.templateDefaults ?? {}) as Record<string, unknown>;
    const theme = resolveTheme(brand as any, (templateDefaults as any)?.invoice);

    const auth = await getAuth();
    let actor = {
      name: (auth?.user?.name as string) || brand.name || "Sales",
      email: brand.email || null,
      phone: brand.phone || null,
    } as { name: string; email?: string | null; phone?: string | null };
    if (auth?.userId) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: auth.userId },
          select: { name: true, firstName: true, lastName: true, email: true, phone: true, company: true },
        });
        if (user) {
          const fullName = user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.name || "Sales";
          actor = {
            name: user.company ? `${fullName} - ${user.company}` : fullName,
            email: user.email,
            phone: user.phone,
          };
        }
      } catch {
        // ignore lookup errors
      }
    }

    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);
    const regularFontBytes = await fs.readFile(path.join(process.cwd(), "public", "fonts", "PlusJakartaSans-Medium.ttf")).catch(() => null);
    const semiBoldFontBytes = await fs.readFile(path.join(process.cwd(), "public", "fonts", "PlusJakartaSans-Bold.ttf")).catch(() => null);
    const extraBoldFontBytes = semiBoldFontBytes;
    const font = regularFontBytes
      ? await pdf.embedFont(new Uint8Array(regularFontBytes))
      : await pdf.embedStandardFont(StandardFonts.Helvetica);
    const bold = semiBoldFontBytes
      ? await pdf.embedFont(new Uint8Array(semiBoldFontBytes))
      : await pdf.embedStandardFont(StandardFonts.HelveticaBold);
    const extraBold = extraBoldFontBytes
      ? await pdf.embedFont(new Uint8Array(extraBoldFontBytes))
      : await pdf.embedStandardFont(StandardFonts.HelveticaBold);
    let page = pdf.addPage();

    const searchParams = req.nextUrl.searchParams;
    // Untuk invoice, kolom image tidak ditampilkan.
    const showImage = false;
    const showDescription = searchParams.get("showDescription") !== "false";
    const showSignature = searchParams.get("showSignature") !== "false";
    const scaleParam = Number(searchParams.get("scale"));
    const s = Number.isFinite(scaleParam) ? Math.max(0.6, Math.min(1, scaleParam)) : 0.85;
    const margin = Math.max(28, Math.floor(48 * s));

    const { drawHeaderCommon, drawInfoSectionCommon } = await import("@/lib/pdfCommon");

    const headerInfo: Array<{ label: string; value: string }> = [
      { label: "Number", value: String(invoice.invoiceNumber || `INV-${invoice.id}`) },
      { label: "Date", value: new Date(invoice.issueDate).toLocaleDateString("id-ID") },
      { label: "Due Date", value: new Date(invoice.dueDate).toLocaleDateString("id-ID") },
    ];

    const headerBottomY = await drawHeaderCommon(
      pdf,
      page,
      brand as any,
      theme,
      "INVOICE",
      headerInfo,
      font,
      bold,
      extraBold,
      margin
    );

    const infoBottomY = drawInfoSectionCommon(
      page,
      theme,
      brand as any,
      actor,
      invoice.customer,
      font,
      bold,
      margin,
      headerBottomY
    );

    const invoiceItems = (invoice.items || []).map((item) => ({
      product: item.name,
      description: item.description,
      quantity: item.qty,
      unit: item.unit,
      price: item.price,
      subtotal: item.subtotal,
    }));

    const tableResult = await drawItemsTable(
      pdf,
      page,
      invoiceItems,
      theme,
      font,
      bold,
      margin,
      infoBottomY - Math.max(12, Math.floor(16 * s)),
      { showImage, showDescription, scale: s }
    );

    page = tableResult.page;
    let finalY = tableResult.finalY;
    if (finalY < margin + Math.floor(160 * s)) {
      page = pdf.addPage();
      finalY = page.getSize().height - margin - Math.floor(160 * s);
    }

    const { summary: summaryLines, totalDue } = buildInvoiceSummary(invoice);
    const thankYouAndTerms = resolveThankYou(brand as any);
    const paymentLines = resolvePaymentLines(brand as any);
    const invoiceTerms = typeof invoice.terms === "string" && invoice.terms.trim().length > 0 ? invoice.terms.split("\n") : [];
    const termsLines = invoiceTerms.length
      ? invoiceTerms
      : thankYouAndTerms.terms?.length
        ? thankYouAndTerms.terms
        : brand.termsConditions
          ? String(brand.termsConditions).split("\n")
          : DEFAULT_TERMS;
    const notesText = typeof invoice.notes === "string" ? invoice.notes : "";

    let footerAnchor = drawTotalsAndNotesInvoice(
      page,
      theme,
      summaryLines,
      totalDue,
      notesText,
      thankYouAndTerms.message,
      paymentLines,
      termsLines,
      font,
      bold,
      margin,
      finalY,
      s
    );

    if (footerAnchor < margin + Math.floor(140 * s)) {
      page = pdf.addPage();
      footerAnchor = page.getSize().height - margin - Math.floor(140 * s);
    }

    if (showSignature) {
      const sig = await drawSignatureSection(pdf, page, theme, brand, actor, bold, margin, footerAnchor, s);
      page = sig.page;
    }

    const pdfBytes = await pdf.save();
    const safeInvoiceNumber = String(invoice.invoiceNumber || `INV-${invoice.id}`).replace(/[^\w\-]+/g, "_");
    const safeCustomer = String(invoice.customer?.company || invoice.customer?.pic || "Customer").replace(/[^\w\-]+/g, "_");
    const fileName = `Invoice-${safeInvoiceNumber}-${safeCustomer}.pdf`;

    // Use ArrayBuffer slice to avoid Node Buffer and ensure Edge/Node compatibility
    const body = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength);
    const sp = req.nextUrl.searchParams;
    const previewMode = sp.get("preview") === "1" || sp.get("disposition") === "inline";
    const disposition = previewMode ? "inline" : "attachment";
    return new Response(body, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="${fileName}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": previewMode ? "no-store, max-age=0" : "private, max-age=0",
      },
    });
  } catch (error: any) {
    console.error("[invoices/pdf] error", error);
    const sp = req.nextUrl.searchParams;
    const debug = sp.get("debug") === "1";
    const message = debug
      ? String(error?.stack || error?.message || error || "Unknown error")
      : "Gagal membuat PDF";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
