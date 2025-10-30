"use server";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type PDFImage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "fs/promises";
import path from "path";
import { resolveTheme, toRgb255, resolveThankYou, resolvePaymentLines, type InvoiceTemplateTheme, DEFAULT_TERMS } from "@/lib/quotationTheme";
import { toRgb, isLightHex, splitTextToSize } from "@/lib/pdfCommon";
import { getActiveBrandProfile } from "@/lib/brand";
import { getAuth } from "@/lib/auth";

const toRGB = ({ r, g, b }: { r:number; g:number; b:number }) => rgb(r/255,g/255,b/255);

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

// Rounded rectangle util (meniru Quotation)
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
  const path = `M ${x + r} ${y} L ${x + width - r} ${y} Q ${x + width} ${y} ${x + width} ${y + r} L ${x + width} ${y + height - r} Q ${x + width} ${y + height} ${x + width - r} ${y + height} L ${x + r} ${y + height} Q ${x} ${y + height} ${x} ${y + height - r} L ${x} ${y + r} Q ${x} ${y} ${x + r} ${y} Z`;
  page.drawSvgPath(path, {
    color: options.color,
    borderColor: options.borderColor,
    borderWidth: options.borderWidth ?? (options.borderColor ? 1 : 0),
    opacity: options.opacity ?? 1,
  });
}

// ==== Paritas dengan Quotation: util gambar item & angka ====
const itemImageCache = new Map<string, { image: PDFImage; width: number; height: number }>();
const PUBLIC_DIR = path.join(process.cwd(), "public");

const loadImageBytes = async (source: string): Promise<Uint8Array | null> => {
  try {
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
    const width = image.width;
    const height = image.height;
    const payload = { image, width, height };
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

// ==== Section: Project Overview (identik dengan Quotation) ====
const drawProjectDescription = (
  page: PDFPage,
  theme: InvoiceTemplateTheme,
  description: string | null | undefined,
  font: PDFFont,
  bold: PDFFont,
  margin: number,
  startY: number
) => {
  if (!description || String(description).trim().length === 0) return startY;
  const s = 0.85; // mengikuti default Quotation
  const title = "PROJECT OVERVIEW";
  const titleSize = Math.max(9, Math.floor(11 * s));
  const titleColor = toRGB(toRgb255(theme.mutedTextColor));
  page.drawText(title, { x: margin, y: startY, size: titleSize, font: bold, color: titleColor });
  let y = startY - Math.max(10, Math.floor(14 * s));
  const bodySize = Math.max(8, Math.floor(10 * s));
  const contentWidth = page.getSize().width - margin * 2;
  const lines = splitTextToSize(String(description), contentWidth, font, bodySize);
  const bodyColor = toRGB(toRgb255(theme.textColor));
  for (const line of lines) {
    page.drawText(line, { x: margin, y, size: bodySize, font, color: bodyColor });
    y -= bodySize + Math.max(4, Math.floor(6 * s));
  }
  return y - Math.max(4, Math.floor(6 * s));
};

// ==== Section: Items Table (identik dengan Quotation) ====
const drawItemsTable = async (
  pdf: PDFDocument,
  initialPage: PDFPage,
  items: any[],
  theme: InvoiceTemplateTheme,
  font: PDFFont,
  bold: PDFFont,
  margin: number,
  startY: number,
  options: { showImage: boolean; showDescription: boolean; scale?: number }
): Promise<{ finalY: number; total: number; page: PDFPage }> => {
  const s = Math.max(0.6, Math.min(1, options.scale ?? 0.85));

  type ColumnKey = "description" | "image" | "qty" | "unit" | "price" | "amount";
  const columns: Array<{ key: ColumnKey; label: string; width: number; align: "left" | "center" | "right" }> = [
    { key: "description", label: "Description", width: options.showImage ? 0.34 : 0.5, align: "left" },
    ...(options.showImage ? [{ key: "image" as const, label: "Image", width: 0.16, align: "center" }] : []),
    { key: "qty", label: "Qty", width: 0.1, align: "center" },
    { key: "unit", label: "Unit", width: 0.12, align: "center" },
    { key: "price", label: "Price", width: options.showImage ? 0.14 : 0.14, align: "right" },
    { key: "amount", label: "Amount", width: options.showImage ? 0.14 : 0.14, align: "right" },
  ];

  let page = initialPage;
  const headerHeight = Math.max(26, Math.floor(30 * s));
  const minRowHeight = Math.max(32, Math.floor(36 * s));
  const paddingX = Math.max(12, Math.floor(14 * s));
  const paddingY = Math.max(6, Math.floor(8 * s));
  const descriptionGap = Math.max(8, Math.floor(10 * s));
  const descriptionLineGap = Math.max(2, Math.floor(3 * s));
  const safeBottom = margin + Math.max(160, Math.floor(180 * s));

  const headerBg = toRgb(theme.totalBackground);
  const headerText = rgb(1, 1, 1);
  const zebra = toRgb(theme.zebraRowColor);
  const border = toRgb(theme.tableBorderColor);
  const primaryText = toRgb(theme.textColor);
  const mutedText = toRgb(theme.mutedText);

  const descriptionIndex = columns.findIndex((column) => column.key === "description");
  const imageIndex = columns.findIndex((column) => column.key === "image");

  let tableWidth = 0;
  let columnWidths: number[] = [];
  let descriptionWidth = 0;

  const recalcLayout = () => {
    const { width } = page.getSize();
    tableWidth = width - margin * 2;
    columnWidths = columns.map((column) => tableWidth * column.width);
    descriptionWidth = descriptionIndex >= 0 ? columnWidths[descriptionIndex] : tableWidth * 0.4;
  };

  recalcLayout();

  let y = startY;

  const drawHeaderRow = () => {
    page.drawRectangle({
      x: margin,
      y: y - headerHeight,
      width: tableWidth,
      height: headerHeight,
      color: headerBg,
    });

    let colX = margin;
    columns.forEach((column, columnIndex) => {
      const colWidth = columnWidths[columnIndex];
      let labelSize = Math.max(9, Math.floor(10 * s));
      const maxLabelWidth = Math.max(24, colWidth - paddingX * 2);
      let labelWidth = bold.widthOfTextAtSize(column.label, labelSize);
      if (labelWidth > maxLabelWidth) {
        const scale = maxLabelWidth / labelWidth;
        labelSize = Math.max(7, Math.floor(labelSize * scale));
        labelWidth = bold.widthOfTextAtSize(column.label, labelSize);
      }

      let textX = colX + paddingX;
      if (column.align === "center") {
        textX = colX + (colWidth - labelWidth) / 2;
      } else if (column.align === "right") {
        textX = colX + colWidth - paddingX - labelWidth;
      }
      const textY = y - headerHeight / 2 - labelSize / 2 + 1;

      page.drawText(column.label, {
        x: textX,
        y: textY,
        font: bold,
        size: labelSize,
        color: headerText,
      });

      colX += colWidth;
    });

    page.drawRectangle({
      x: margin,
      y: y - headerHeight,
      width: tableWidth,
      height: 0.8,
      color: border,
    });
  };

  const goToNextPage = () => {
    page = pdf.addPage();
    recalcLayout();
    y = page.getSize().height - margin;
    drawHeaderRow();
    y -= headerHeight;
    y -= Math.max(6, Math.floor(8 * s));
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
        x: margin,
        y: rowBottom,
        width: tableWidth,
        height: rowHeight,
        color: zebra,
      });
    }

    let colX = margin;
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

// ==== Totals & Notes (identik dengan Quotation) ====
const drawTotalsAndNotes = (
  page: PDFPage,
  theme: InvoiceTemplateTheme,
  total: number,
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
  const startYLocal = startY;

  // total card
  const totalCardHeight = Math.max(64, Math.floor(90 * s));
  page.drawRectangle({ x: rightX, y: startYLocal - totalCardHeight, width: rightWidth, height: totalCardHeight, color: toRgb(theme.totalBackground) });
  drawRoundedRect(page, rightX, startYLocal - totalCardHeight, rightWidth, totalCardHeight, 10, { color: toRgb(theme.totalBackground), borderColor: toRgb(theme.tableBorderColor), borderWidth: 1, opacity: 1 });

  const paddingX = Math.max(12, Math.floor(18 * s));
  const availableWidth = rightWidth - paddingX * 2;
  const totalText = `Rp ${total.toLocaleString("id-ID")}`;
  const labelSize = Math.max(8, Math.floor(9 * s));
  const messageSize = Math.max(7, Math.floor(8 * s));
  const labelToAmountGap = Math.max(8, Math.floor(10 * s));
  const amountToMessageGap = thankYouMessage ? Math.max(8, Math.floor(12 * s)) : 0;
  let amountSize = Math.max(16, Math.floor(20 * s));
  let amountWidth = bold.widthOfTextAtSize(totalText, amountSize);
  if (amountWidth > availableWidth) {
    const scale2 = availableWidth / amountWidth;
    amountSize = Math.max(14, Math.floor(amountSize * scale2));
    amountWidth = bold.widthOfTextAtSize(totalText, amountSize);
  }
  const messageHeight = thankYouMessage ? messageSize : 0;
  const contentHeight = labelSize + labelToAmountGap + amountSize + (thankYouMessage ? amountToMessageGap + messageHeight : 0);
  const verticalOffset = (totalCardHeight - contentHeight) / 2;
  const cardTop = startYLocal;
  const labelY = cardTop - verticalOffset - labelSize;
  const amountY = labelY - labelToAmountGap - amountSize;
  const messageY = amountY - amountToMessageGap - messageSize;
  const totalLabel = "TOTAL DUE";
  const labelWidth = bold.widthOfTextAtSize(totalLabel, labelSize);
  const effectiveTextColor = isLightHex(theme.totalBackground) ? theme.headerTextColor : theme.totalTextColor;
  page.drawText(totalLabel, { x: rightX + rightWidth - paddingX - labelWidth, y: labelY, size: labelSize, font: bold, color: toRgb(effectiveTextColor) });
  page.drawText(totalText, { x: rightX + rightWidth - paddingX - amountWidth, y: amountY, size: amountSize, font: bold, color: toRgb(effectiveTextColor) });
  if (thankYouMessage) {
    const msgWidth = font.widthOfTextAtSize(thankYouMessage, messageSize);
    page.drawText(thankYouMessage, { x: rightX + rightWidth - paddingX - msgWidth, y: messageY, size: messageSize, font, color: toRgb(effectiveTextColor) });
  }

  // left column: NOTES -> PAYMENT INFO -> TERMS & CONDITIONS
  const colTitleColor = toRGB(toRgb255(theme.mutedTextColor));
  const textColorBody = toRGB(toRgb255(theme.textColor));
  const bodySize = Math.max(8, Math.floor(9 * s));
  const titleSize = Math.max(9, Math.floor(10 * s));
  const leftX = margin;
  let py = labelY;
  const sectionSpacing = Math.max(16, Math.floor(20 * s)); // Increased spacing between sections
  
  // Notes
  page.drawText("NOTES", { x: leftX, y: py, font: bold, size: titleSize, color: colTitleColor });
  py -= Math.max(14, Math.floor(16 * s));
  if (notes && String(notes).trim().length > 0) {
    const wrappedNotes = splitTextToSize(String(notes), leftWidth, font, bodySize);
    for (const w of wrappedNotes.slice(0, 12)) { 
      page.drawText(w, { x: leftX, y: py, font, size: bodySize, color: textColorBody }); 
      py -= bodySize + Math.max(4, Math.floor(5 * s)); 
    }
  }
  py -= sectionSpacing; // Increased spacing before next section
  
  // Payment Info
  page.drawText("PAYMENT INFO", { x: leftX, y: py, font: bold, size: titleSize, color: colTitleColor });
  py -= Math.max(14, Math.floor(16 * s));
  for (const line of paymentLines.slice(0, 6)) {
    const wrapped = splitTextToSize(line, leftWidth, font, bodySize);
    for (const w of wrapped) { 
      page.drawText(w, { x: leftX, y: py, font, size: bodySize, color: textColorBody }); 
      py -= bodySize + Math.max(4, Math.floor(5 * s)); 
    }
  }
  py -= sectionSpacing; // Increased spacing before next section
  
  // Terms & Conditions
  page.drawText("TERMS & CONDITIONS", { x: leftX, y: py, font: bold, size: titleSize, color: colTitleColor });
  py -= Math.max(14, Math.floor(16 * s));
  for (const line of termsLines.slice(0, 10)) {
    const wrapped = splitTextToSize(line, leftWidth, font, bodySize);
    for (const w of wrapped) { 
      page.drawText(w, { x: leftX, y: py, font, size: bodySize, color: textColorBody }); 
      py -= bodySize + Math.max(4, Math.floor(5 * s)); 
    }
  }
  return Math.min(py, startYLocal - Math.floor(90 * s));
};

// ==== Signature (identik dengan Quotation) ====
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

  page.drawText(title, { x: x + (sectionWidth - titleWidth) / 2, y: titleY, size: titleSize, font: bold, color: toRgb(theme.headerTextColor) });

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
  page.drawRectangle({ x: x + lineInset, y: lineY, width: sectionWidth - lineInset * 2, height: 0.8, color: toRgb(theme.tableBorderColor) });

  const signatureName = actor.name || brand.name || "Authorized Signature";
  const nameSize = Math.max(8, Math.floor(10 * s));
  const nameWidth = bold.widthOfTextAtSize(signatureName, nameSize);
  page.drawText(signatureName, { x: x + (sectionWidth - nameWidth) / 2, y: lineY - 12, size: nameSize, font: bold, color: toRgb(theme.headerTextColor) });

  return { page, finalY: lineY - 24 };
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const idParam = id;
  const numericId = Number(idParam);

  try {
    let order = await prisma.salesOrder.findUnique({
      where: { id: Number.isFinite(numericId) ? numericId : -1 },
      include: {
        customer: true,
        items: true,
        quotation: true,
      },
    });

    if (!order && idParam && !Number.isFinite(numericId)) {
      order = await prisma.salesOrder.findFirst({
        where: { orderNumber: String(idParam) },
        include: { customer: true, items: true, quotation: true },
      });
    }

    if (!order) {
      return NextResponse.json(
        { success: false, message: "Sales order tidak ditemukan" },
        { status: 404 }
      );
    }

    // Theme and actor
    let brand = null as any;
    try {
      if ((order as any).brandProfileId) {
        brand = await prisma.brandProfile.findUnique({ where: { id: (order as any).brandProfileId } });
      }
      if (!brand) brand = await getActiveBrandProfile();
    } catch {}
    const templateDefaults = (brand?.templateDefaults ?? {}) as Record<string, string>;
    const theme = resolveTheme(brand as any, templateDefaults?.invoice);
    const auth = await getAuth();
    let actor = { name: (auth?.user?.name as string) || brand?.name || "Sales", email: brand?.email || null, phone: brand?.phone || null } as { name: string; email?: string|null; phone?: string|null };
    if (auth?.userId) {
      try {
        const user = await prisma.user.findUnique({ where: { id: auth.userId }, select: { name:true, firstName:true, lastName:true, email:true, phone:true, company:true } });
        if (user) {
          const fullName = user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : (user.name || "Sales");
          actor = { name: user.company ? `${fullName} - ${user.company}` : fullName, email: user.email, phone: user.phone };
        }
      } catch {}
    }

    // === INIT PDF identik dengan Quotation ===
    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);
    const regularFontBytes = await fs.readFile(path.join(process.cwd(), "public", "fonts", "PlusJakartaSans-Medium.ttf")).catch(() => null);
    const semiBoldFontBytes = await fs.readFile(path.join(process.cwd(), "public", "fonts", "PlusJakartaSans-Bold.ttf")).catch(() => null);
    const extraBoldFontBytes = semiBoldFontBytes; // gunakan bold sebagai extraBold jika satu file
    const font = regularFontBytes ? await pdf.embedFont(new Uint8Array(regularFontBytes)) : await pdf.embedStandardFont(StandardFonts.Helvetica);
    const bold = semiBoldFontBytes ? await pdf.embedFont(new Uint8Array(semiBoldFontBytes)) : await pdf.embedStandardFont(StandardFonts.HelveticaBold);
    const extraBold = extraBoldFontBytes ? await pdf.embedFont(new Uint8Array(extraBoldFontBytes)) : await pdf.embedStandardFont(StandardFonts.HelveticaBold);
    let page = pdf.addPage();

    const searchParams = req.nextUrl.searchParams;
    const showImage = searchParams.get("showImage") !== "false";
    const showDescription = searchParams.get("showDescription") !== "false";
    const showProjectDesc = searchParams.get("showProjectDesc") !== "false";
    const showSignature = searchParams.get("showSignature") !== "false";
    const scaleParam = Number(searchParams.get("scale"));
    const s = Number.isFinite(scaleParam) ? Math.max(0.6, Math.min(1, scaleParam)) : 0.85;
    const margin = Math.max(28, Math.floor(48 * s));

    // Header & Info (gunakan common agar identik style, dengan judul SALES ORDER)
    const { drawHeaderCommon, drawInfoSectionCommon } = await import("@/lib/pdfCommon");
    const headerInfo: Array<{ label: string; value: string }> = [
      { label: "Number", value: String(order.orderNumber || `SO-${order.id}`) },
      { label: "Date", value: new Date(order.date).toLocaleDateString("id-ID") },
    ];
    if (order.quotation?.quotationNumber) {
      headerInfo.push({ label: "Ref Quotation", value: String(order.quotation.quotationNumber) });
    }
    const headerBottomY = await drawHeaderCommon(
      pdf,
      page,
      brand as any,
      theme,
      "SALES ORDER",
      headerInfo,
      font,
      bold,
      extraBold,
      margin
    );

    let cursorY = drawInfoSectionCommon(
      page,
      theme,
      brand as any,
      actor,
      order.customer,
      font,
      bold,
      margin,
      headerBottomY
    );

    // Project overview dari quotation jika ada
    if (showProjectDesc && order.quotation?.projectDesc) {
      cursorY = drawProjectDescription(page, theme, order.quotation.projectDesc, font, bold, margin, cursorY);
    }

    // Items table identik
    const tableResult = await drawItemsTable(
      pdf,
      page,
      order.items,
      theme,
      font,
      bold,
      margin,
      cursorY,
      { showImage, showDescription, scale: s }
    );
    page = tableResult.page;
    let finalY = tableResult.finalY;
    if (finalY < margin + Math.floor(160 * s)) {
      page = pdf.addPage();
      finalY = page.getSize().height - margin - Math.floor(160 * s);
    }

    // Totals & Notes identik
    const thankYouAndTerms = resolveThankYou(brand as any);
    const paymentLines = resolvePaymentLines(brand as any);
    const termsLines = thankYouAndTerms.terms?.length ? thankYouAndTerms.terms : (brand?.termsConditions ? String(brand.termsConditions).split("\n") : DEFAULT_TERMS);
    const notesText = typeof order.notes === "string" ? order.notes : "";
    let footerAnchor = drawTotalsAndNotes(
      page,
      theme,
      tableResult.total,
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

    // Signature identik
    if (showSignature) {
      const sig = await drawSignatureSection(
        pdf,
        page,
        theme,
        brand as any,
        { name: actor.name || brand?.name || "Authorized" },
        bold,
        margin,
        footerAnchor,
        s
      );
      page = sig.page;
    }

    const pdfBytes = Buffer.from(await pdf.save());
    const safeOrderNumber = (order.orderNumber || `SO-${order.id}`).replace(/[^\w\-]+/g, "_");
    const safeCustomer = (order.customer?.company || order.customer?.pic || "Customer").replace(/[^\w\-]+/g, "_");
    const fileName = `SalesOrder-${safeOrderNumber}-${safeCustomer}.pdf`;
    return new Response(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal membuat PDF" },
      { status: 500 }
    );
  }
}
