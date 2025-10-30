"use server";

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage, type PDFImage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "fs/promises";
import path from "path";
import { getAuth } from "@/lib/auth";
import { getActiveBrandProfile } from "@/lib/brand";
import {
  DEFAULT_TERMS,
  type InvoiceTemplateTheme,
  resolvePaymentLines,
  resolveThankYou,
  resolveTheme,
  toRgb255,
} from "@/lib/quotationTheme";

interface BrandProfile {
  id: number;
  name: string;
  logoUrl?: string | null;
  primaryColor: string;
  secondaryColor: string;
  overview?: string | null;
  website?: string | null;
  email?: string | null;
  address?: string | null;
  phone?: string | null;
  footerText?: string | null;
  isActive: boolean;
  templateDefaults?: Record<string, unknown> | null;
  paymentInfo?: string | null;
  termsConditions?: string | null;
  showBrandName?: boolean | null;
  showBrandDescription?: boolean | null;
  showBrandEmail?: boolean | null;
  showBrandWebsite?: boolean | null;
  showBrandAddress?: boolean | null;
}

const toRgb = (hex?: string) => {
  const { r, g, b } = toRgb255(hex);
  return rgb(r / 255, g / 255, b / 255);
};

// Util: check perceived lightness of a hex color to choose readable text
const isLightHex = (hex?: string) => {
  if (!hex) return true;
  const { r, g, b } = toRgb255(hex);
  // relative luminance
  const lum = 0.2126 * (r / 255) + 0.7152 * (g / 255) + 0.0722 * (b / 255);
  return lum > 0.7; // treat very light backgrounds as light
};

// Helper: draw rounded rectangle using SVG path
const drawRoundedRect = (
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  options: { color?: ReturnType<typeof rgb>; borderColor?: ReturnType<typeof rgb>; borderWidth?: number; opacity?: number } = {}
) => {
  const r = Math.max(0, Math.min(radius, Math.min(width / 2, height / 2)));
  const path = `M ${x + r} ${y} L ${x + width - r} ${y} Q ${x + width} ${y} ${x + width} ${y + r} L ${x + width} ${y + height - r} Q ${x + width} ${y + height} ${x + width - r} ${y + height} L ${x + r} ${y + height} Q ${x} ${y + height} ${x} ${y + height - r} L ${x} ${y + r} Q ${x} ${y} ${x + r} ${y} Z`;
  page.drawSvgPath(path, {
    color: options.color,
    borderColor: options.borderColor,
    borderWidth: options.borderWidth ?? (options.borderColor ? 1 : 0),
    opacity: options.opacity ?? 1,
  });
};

// Gunakan font yang tersedia di public/fonts sebagai fallback
// Regular -> Medium, SemiBold -> Bold, ExtraBold -> Bold
const FONT_REGULAR_PATH = path.join(process.cwd(), "public", "fonts", "PlusJakartaSans-Medium.ttf");
const FONT_SEMIBOLD_PATH = path.join(process.cwd(), "public", "fonts", "PlusJakartaSans-Bold.ttf");
const FONT_EXTRABOLD_PATH = path.join(process.cwd(), "public", "fonts", "PlusJakartaSans-Bold.ttf");

const fontCache: { regular?: Uint8Array; semibold?: Uint8Array; extrabold?: Uint8Array } = {};
const itemImageCache = new Map<
  string,
  { image: PDFImage; width: number; height: number }
>();
const PUBLIC_DIR = path.join(process.cwd(), "public");

const splitTextToSize = (
  text: string,
  maxWidth: number,
  font: PDFFont,
  fontSize = 9
): string[] => {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    const width = font.widthOfTextAtSize(candidate, fontSize);
    if (width <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [text];
};

const loadFontBytes = async (weight: "regular" | "semibold" | "extrabold") => {
  try {
    if (fontCache[weight]) {
      return fontCache[weight]!;
    }
    const filePath =
      weight === "regular"
        ? FONT_REGULAR_PATH
        : weight === "semibold"
        ? FONT_SEMIBOLD_PATH
        : FONT_EXTRABOLD_PATH;
    const file = await fs.readFile(filePath);
    fontCache[weight] = file;
    return file;
  } catch (err) {
    console.error(`[quotations/pdf] Failed to read font file for ${weight}`, err);
    return null;
  }
};

const safeEmbedFont = async (
  pdfDoc: PDFDocument,
  bytes: Uint8Array | null | undefined,
  fallback: StandardFonts
): Promise<PDFFont> => {
  try {
    if (bytes && bytes.length) {
      return await pdfDoc.embedFont(bytes, { subset: true });
    }
    // fallthrough to standard font when bytes missing
    return await pdfDoc.embedStandardFont(fallback);
  } catch (err) {
    console.error("[quotations/pdf] embedFont failed, using standard font fallback", err);
    return await pdfDoc.embedStandardFont(fallback);
  }
};

const loadImageBytes = async (source: string): Promise<Uint8Array | null> => {
  try {
    if (!source) return null;
    if (source.startsWith("http://") || source.startsWith("https://")) {
      const response = await fetch(source);
      if (!response.ok) return null;
      const buffer = await response.arrayBuffer();
      return new Uint8Array(buffer);
    }
    const normalized = source.startsWith("/") ? source.slice(1) : source;
    const filePath = path.join(PUBLIC_DIR, normalized);
    const file = await fs.readFile(filePath);
    return file;
  } catch (error) {
    console.error("Failed to load image bytes:", source, error);
    return null;
  }
};

const embedItemImage = async (
  pdfDoc: PDFDocument,
  imageUrl?: string | null
): Promise<{ image: PDFImage; width: number; height: number } | null> => {
  if (!imageUrl) return null;
  if (itemImageCache.has(imageUrl)) {
    return itemImageCache.get(imageUrl)!;
  }
  const bytes = await loadImageBytes(imageUrl);
  if (!bytes) return null;
  try {
    let image: PDFImage;
    try {
      image = await pdfDoc.embedPng(bytes);
    } catch {
      image = await pdfDoc.embedJpg(bytes);
    }
    const { width, height } = image.scale(1);
    const payload = { image, width, height };
    itemImageCache.set(imageUrl, payload);
    return payload;
  } catch (error) {
    console.error("Failed to embed item image:", imageUrl, error);
    return null;
  }
};

const embedSignatureImage = async (
  pdfDoc: PDFDocument,
  imageUrl?: string | null,
  maxWidth = 220,
  maxHeight = 64
): Promise<{ image: PDFImage; width: number; height: number } | null> => {
  try {
    if (!imageUrl) return null;
    const absoluteUrl = imageUrl.startsWith("http")
      ? imageUrl
      : `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}${imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`}`;
    const bytes = await loadImageBytes(absoluteUrl);
    if (!bytes) return null;
    let image: PDFImage;
    try {
      image = await pdfDoc.embedPng(bytes);
    } catch {
      image = await pdfDoc.embedJpg(bytes);
    }
    const { width, height } = image.scale(1);
    const scale = Math.min(maxWidth / width, maxHeight / height, 1);
    return { image, width: width * scale, height: height * scale };
  } catch (error) {
    console.error("[quotations/pdf] Failed to embed signature image:", error);
    return null;
  }
};

const toNumber = (value: unknown): number => {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (!value) return 0;
  if (typeof value === "object" && "toNumber" in (value as Record<string, unknown>)) {
    try {
      // Prisma Decimal exposes toNumber()
      const decimal = (value as { toNumber: () => number }).toNumber();
      return typeof decimal === "number" && !Number.isNaN(decimal) ? decimal : 0;
    } catch {
      // fallthrough
    }
  }
  const coerced = Number(value);
  return Number.isFinite(coerced) ? coerced : 0;
};

const embedBrandLogo = async (
  pdfDoc: PDFDocument,
  brand: BrandProfile
): Promise<{ image: PDFImage; width: number; height: number } | null> => {
  if (!brand.logoUrl) return null;
  try {
    const logoUrl = brand.logoUrl.startsWith("http")
      ? brand.logoUrl
      : `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}${brand.logoUrl}`;
    const response = await fetch(logoUrl);
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const isPng = brand.logoUrl.toLowerCase().endsWith(".png") || response.headers.get("content-type")?.includes("png");
    const isJpg =
      brand.logoUrl.toLowerCase().endsWith(".jpg") ||
      brand.logoUrl.toLowerCase().endsWith(".jpeg") ||
      response.headers.get("content-type")?.includes("jpeg");

    let image: PDFImage;
    if (isPng) {
      image = await pdfDoc.embedPng(bytes);
    } else if (isJpg) {
      image = await pdfDoc.embedJpg(bytes);
    } else {
      // attempt png first fallback to jpg
      try {
        image = await pdfDoc.embedPng(bytes);
      } catch {
        image = await pdfDoc.embedJpg(bytes);
      }
    }

    const maxWidth = 90;
    const maxHeight = 50;
    const { width, height } = image.scale(1);
    const scale = Math.min(maxWidth / width, maxHeight / height, 1);
    return {
      image,
      width: width * scale,
      height: height * scale,
    };
  } catch (error) {
    console.error("Failed to embed brand logo:", error);
    return null;
  }
};

const drawHeader = async (
  pdf: PDFDocument,
  page: PDFPage,
  brand: BrandProfile,
  theme: InvoiceTemplateTheme,
  quotationNumber: string,
  date: Date,
  validUntil: Date | null,
  font: PDFFont,
  bold: PDFFont,
  extraBold: PDFFont,
  margin: number
): Promise<number> => {
  const { width } = page.getSize();
  const topY = page.getHeight() - margin;
  const shouldShowName = brand.showBrandName ?? true;
  const shouldShowDescription = brand.showBrandDescription ?? true;
  const shouldShowEmail = brand.showBrandEmail ?? true;
  const shouldShowWebsite = brand.showBrandWebsite ?? true;
  const shouldShowAddress = brand.showBrandAddress ?? true;

  const leftX = margin;
  let currentY = topY - 12;
  let logoWidth = 0;
  let logoHeight = 0;
  const logo = await embedBrandLogo(pdf, brand);

  if (logo) {
    page.drawImage(logo.image, {
      x: leftX,
      y: currentY - logo.height,
      width: logo.width,
      height: logo.height,
    });
    logoWidth = logo.width;
    logoHeight = logo.height;
  } else {
    const placeholderWidth = 88;
    const placeholderHeight = 48;
    page.drawRectangle({
      x: leftX,
      y: currentY - placeholderHeight,
      width: placeholderWidth,
      height: placeholderHeight,
      color: toRgb(theme.primaryColor),
    });
    page.drawText("LOGO", {
      x: leftX + 22,
      y: currentY - placeholderHeight + 18,
      size: 12,
      font: bold,
      color: rgb(1, 1, 1),
    });
    logoWidth = placeholderWidth;
    logoHeight = placeholderHeight;
  }

  // Geser teks brand lebih dekat ke logo dan sejajarkan dengan bagian atas logo
  const nameX = logoWidth ? leftX + logoWidth + 12 : leftX;
  // Ratakan bagian atas teks brand dengan bagian atas logo (perkiraan ascent ~78%)
  const brandNameSize = 22;
  const brandAscent = Math.floor(brandNameSize * 0.78);
  const brandOffsetDown = 3; // turunkan sedikit posisi brand
  let nameY = currentY - brandAscent - brandOffsetDown;

  if (shouldShowName && brand.name) {
    page.drawText(brand.name, {
      x: nameX,
      y: nameY,
      size: brandNameSize,
      font: bold,
      color: toRgb(theme.primaryColor),
    });
    // Jarak vertikal yang lebih proporsional ke deskripsi
    nameY -= 16;
  }

  if (shouldShowDescription && brand.overview) {
    page.drawText(brand.overview, {
      x: nameX,
      y: nameY,
      size: 11,
      font,
      color: toRgb(theme.mutedText),
      maxWidth: width * 0.45,
    });
    // Perkecil jarak vertikal setelah deskripsi
    nameY -= 14;
  }

  // Tambahkan alamat perusahaan di bawah website pada header
  const brandContactLines: string[] = [];
  // Tampilkan website terlebih dahulu, lalu email
  if (shouldShowWebsite && brand.website && String(brand.website).trim()) {
    brandContactLines.push(String(brand.website).trim());
  }
  if (shouldShowEmail && brand.email && String(brand.email).trim()) {
    brandContactLines.push(String(brand.email).trim());
  }
  if (shouldShowAddress && brand.address && String(brand.address).trim()) {
    const maxContactWidth = Math.max(logoWidth, width * 0.25) - 4;
    const addressLines = splitTextToSize(String(brand.address), maxContactWidth, font, 9);
    brandContactLines.push(...addressLines);
  }

  const contactStartY = logoHeight ? currentY - logoHeight - 16 : nameY - 12;
  let contactY = contactStartY;
  brandContactLines.forEach((line) => {
    page.drawText(line, {
      x: leftX,
      y: contactY,
      size: 9,
      font,
      color: toRgb(theme.mutedText),
      maxWidth: Math.max(logoWidth, width * 0.25),
    });
    contactY -= 12;
  });
  const brandBottom = brandContactLines.length ? contactY : topY - logoHeight - 20;

  const rightX = width - margin;
  const title = "QUOTATION";
  const titleWidth = extraBold.widthOfTextAtSize(title, 26);
  page.drawText(title, {
    x: rightX - titleWidth,
    y: topY - 18,
    size: 26,
    font: extraBold,
    color: toRgb(theme.primaryColor),
  });

  const metaLines = [
    { label: "Number", value: quotationNumber },
    { label: "Date", value: date.toLocaleDateString("id-ID") },
    validUntil ? { label: "Valid Until", value: validUntil.toLocaleDateString("id-ID") } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  let metaY = topY - 48;
  metaLines.forEach(({ label, value }) => {
    const labelWidth = font.widthOfTextAtSize(label, 9);
    page.drawText(label, {
      x: rightX - labelWidth,
      y: metaY,
      size: 9,
      font,
      color: toRgb(theme.mutedText),
    });

    const valueWidth = bold.widthOfTextAtSize(value, 11);
    page.drawText(value, {
      x: rightX - valueWidth,
      y: metaY - 14,
      size: 11,
      font: bold,
      color: toRgb(theme.headerTextColor),
    });
    metaY -= 24;
  });

  const contentBottom = Math.min(brandBottom, nameY, metaY);
  const separatorY = contentBottom - 18;

  page.drawRectangle({
    x: margin,
    y: separatorY,
    width: width - margin * 2,
    height: 0.8,
    color: toRgb(theme.tableBorderColor),
  });

  return separatorY - 24;
};

const drawInfoSection = (
  page: PDFPage,
  theme: InvoiceTemplateTheme,
  brand: BrandProfile,
  actor: { name: string; email?: string | null; phone?: string | null },
  customer: any,
  font: PDFFont,
  bold: PDFFont,
  margin: number,
  startY: number
) => {
  const { width } = page.getSize();
  const gap = 24;
  const availableWidth = width - margin * 2 - gap;
  const columnWidth = availableWidth / 2;
  const baseY = startY - 6;

  const combinedName =
    customer && (customer.pic || customer.company)
      ? [customer.pic, customer.company]
          .filter(Boolean)
          .filter((value, idx, arr) => arr.indexOf(value) === idx)
          .join(" | ")
      : "Customer";

  type InfoRow = {
    text: string;
    size?: number;
    font?: PDFFont;
    color?: ReturnType<typeof rgb>;
  };

  const fromRows: InfoRow[] = [];
  // Gunakan nama dari brand profile untuk judul FROM
  const fromHeading = actor.name || brand.name || "Our Company";
  fromRows.push({
    text: fromHeading,
    size: 10,
    font: bold,
    color: toRgb(theme.headerTextColor),
  });

  // Gunakan kontak dari brand profile
  const contactValues = [
    actor.email || (brand.showBrandEmail === false ? null : brand.email),
    actor.phone || brand.phone,
  ]
    .filter((value): value is string => Boolean(value && value.trim()))
    .filter((value, index, array) => array.indexOf(value) === index);

  contactValues.forEach((value) => {
    fromRows.push({
      text: value,
      size: 9,
      font,
      color: toRgb(theme.mutedText),
    });
  });

  if ((brand.showBrandAddress ?? true) && brand.address) {
    const addressLines = splitTextToSize(String(brand.address), columnWidth - 4, font, 8);
    addressLines.forEach((line) => {
      fromRows.push({
        text: line,
        size: 8,
        font,
        color: toRgb(theme.mutedText),
      });
    });
  }

  const billRows: InfoRow[] = [];
  billRows.push({
    text: combinedName,
    size: 10,
    font: bold,
    color: toRgb(theme.headerTextColor),
  });

  if (customer?.address) {
    const billAddressLines = splitTextToSize(String(customer.address), columnWidth - 4, font, 8);
    billAddressLines.forEach((line) => {
      billRows.push({
        text: line,
        size: 8,
        font,
        color: toRgb(theme.mutedText),
      });
    });
  }

  const customerExtras = [customer?.email, customer?.phone]
    .filter((value): value is string => Boolean(value && value.trim()))
    .filter((value, index, array) => array.indexOf(value) === index);

  customerExtras.forEach((value) => {
    billRows.push({
      text: value,
      size: 9,
      font,
      color: toRgb(theme.mutedText),
    });
  });

  const columns = [
    {
      title: "From",
      rows: fromRows.length
        ? fromRows
        : [
            {
              text: "-",
              size: 9,
              font,
              color: toRgb(theme.mutedText),
            },
          ],
    },
    {
      title: "Bill To",
      rows: billRows.length
        ? billRows
        : [
            {
              text: "-",
              size: 9,
              font,
              color: toRgb(theme.mutedText),
            },
          ],
    },
  ];

  let lowestY = baseY;

  columns.forEach(({ title, rows }, index) => {
    const x = margin + index * (columnWidth + gap);
    page.drawText(title.toUpperCase(), {
      x,
      y: baseY,
      size: 10,
      font: bold,
      color: toRgb(theme.headerAccentColor),
    });

    page.drawRectangle({
      x,
      y: baseY - 12,
      width: columnWidth,
      height: 0.6,
      color: toRgb(theme.tableBorderColor),
    });

    let lineY = baseY - 24;
    rows.slice(0, 10).forEach((row, rowIndex) => {
      const size = row.size ?? (rowIndex === 0 ? 10 : 9);
      const rowFont = row.font ?? (rowIndex === 0 ? bold : font);
      const rowColor = row.color ?? toRgb(rowIndex === 0 ? theme.headerTextColor : theme.mutedText);

      page.drawText(row.text, {
        x,
        y: lineY,
        size,
        font: rowFont,
        color: rowColor,
        maxWidth: columnWidth - 4,
      });
      const gapY = rowIndex === 0 ? 16 : size && size <= 8 ? 11 : 12;
      lineY -= gapY;
    });
    lowestY = Math.min(lowestY, lineY);
  });

  return lowestY - 18;
};

const drawProjectDescription = (
  page: PDFPage,
  theme: InvoiceTemplateTheme,
  description: string | null | undefined,
  font: PDFFont,
  bold: PDFFont,
  margin: number,
  startY: number
) => {
  if (!description) return startY;

  const lines = description
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return startY;

  const baseY = startY - 6;
  page.drawText("PROJECT OVERVIEW", {
    x: margin,
    y: baseY,
    size: 10,
    font: bold,
    color: toRgb(theme.headerAccentColor),
  });

  let currentY = baseY - 16;
  const maxWidth = page.getSize().width - margin * 2;
  lines.forEach((line) => {
    const wrapped = splitTextToSize(line, maxWidth - 16, font, 9);
    wrapped.forEach((segment, index) => {
      const prefix = index === 0 ? "- " : "  ";
      page.drawText(`${prefix}${segment}`, {
        x: margin,
        y: currentY,
        size: 9,
        font,
        color: toRgb(theme.mutedText),
      });
      currentY -= 12;
    });
  });

  return currentY - 18;
};

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
  let page = initialPage;
  const { width } = page.getSize();
  const tableWidth = width - margin * 2;
  const s = Math.max(0.6, Math.min(1, options.scale ?? 1));
  const headerHeight = Math.max(22, Math.floor(32 * s));

  const columns = [
    {
      key: "description" as const,
      label: "Description",
      width: options.showImage ? 0.34 : options.showDescription ? 0.46 : 0.5,
      align: "left" as const,
    },
    ...(options.showImage
      ? [{ key: "image" as const, label: "Image", width: 0.18, align: "center" as const }]
      : []),
    { key: "qty" as const, label: "Qty", width: 0.1, align: "center" as const },
    { key: "unit" as const, label: "Unit", width: 0.1, align: "center" as const },
    { key: "price" as const, label: "Price", width: options.showImage ? 0.14 : 0.16, align: "right" as const },
    { key: "amount" as const, label: "Amount", width: options.showImage ? 0.14 : 0.18, align: "right" as const },
  ];
  const descriptionColumn = columns.find((column) => column.key === "description");
  const descriptionColumnWidth = descriptionColumn ? tableWidth * descriptionColumn.width : tableWidth * 0.4;

  let y = startY;

  // Table title (tanpa background sesuai permintaan)
  const titleText = "ITEMISED SUMMARY";
  page.drawText(titleText, {
    x: margin,
    y: y - 6,
    size: Math.max(8, Math.floor(10 * s)),
    font: bold,
    color: toRgb(theme.headerAccentColor),
  });

  y -= 16;

  const drawHeaderRow = () => {
    // Header full-width sejajar dengan garis bawah (tanpa rounded)
    page.drawRectangle({
      x: margin,
      y: y - headerHeight,
      width: tableWidth,
      height: headerHeight,
      color: toRgb(theme.totalBackground),
    });

    const paddingX = 14;
    let colX = margin;
    columns.forEach((column) => {
      const colWidth = tableWidth * column.width;
      let labelFontSize = Math.max(8, Math.floor(9 * s));
      let labelWidth = bold.widthOfTextAtSize(column.label, labelFontSize);
      const maxTextWidth = colWidth - paddingX * 2;
      if (labelWidth > maxTextWidth) {
        const scale = maxTextWidth / labelWidth;
        labelFontSize = Math.max(7, Math.floor(labelFontSize * scale));
        labelWidth = bold.widthOfTextAtSize(column.label, labelFontSize);
      }

      const effectiveTextColor = isLightHex(theme.totalBackground) ? theme.headerTextColor : theme.totalTextColor;
      let textX = colX + paddingX;
      if (column.align === "center") {
        textX = colX + colWidth / 2 - labelWidth / 2;
      } else if (column.align === "right") {
        textX = colX + colWidth - labelWidth - paddingX;
      }

      const textY = y - headerHeight / 2 - labelFontSize / 2 + 2; // pusatkan vertikal
      page.drawText(column.label, {
        x: textX,
        y: textY,
        size: labelFontSize,
        font: bold,
        color: toRgb(effectiveTextColor),
        maxWidth: maxTextWidth,
      });

      colX += colWidth;
    });

    // Garis bawah tipis sebagai pemisah dari body tabel (full-width, tanpa dependensi radius)
    page.drawRectangle({
      x: margin,
      y: y - headerHeight,
      width: tableWidth,
      height: 0.8,
      color: toRgb(theme.tableBorderColor),
    });
  };

  const resetForNewPage = () => {
    page = pdf.addPage();
    y = page.getSize().height - margin;
    const tText = "ITEMISED SUMMARY";
    const tWidth = bold.widthOfTextAtSize(tText, 10);
    const tPadX = 10;
    const tHeight = 18;
    // Judul tanpa background sesuai permintaan
    page.drawText(tText, { x: margin, y: y - 6, size: 10, font: bold, color: toRgb(theme.headerAccentColor) });
    y -= 16;
    drawHeaderRow();
    y -= headerHeight;
  };

  drawHeaderRow();
  y -= headerHeight;

  let total = 0;

  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    const quantity = toNumber(item.quantity ?? 0);
    const price = toNumber(item.price ?? 0);
    const lineAmount = quantity * price;

    const bodyFontSize = Math.max(7, Math.floor(9 * s));
    const productFontSize = Math.max(8, Math.floor(10 * s));
    const lineGap = Math.max(9, Math.floor(11 * s));
    const descriptionLines =
      options.showDescription && item.description
        ? splitTextToSize(String(item.description), descriptionColumnWidth - 28, font, bodyFontSize)
        : [];
    const descriptionHeight = descriptionLines.length ? descriptionLines.length * lineGap + Math.max(4, Math.floor(6 * s)) : 0;
    let rowHeight = Math.max(Math.floor(32 * s), Math.floor(24 * s) + descriptionHeight);

    const embeddedImage = options.showImage ? await embedItemImage(pdf, item.imageUrl) : null;
    if (embeddedImage) {
      rowHeight = Math.max(rowHeight, Math.floor(40 * s));
    }

    if (y - rowHeight < margin + 120) {
      resetForNewPage();
    }

    const rowTop = y;
    const rowBottom = y - rowHeight;

    if (index % 2 === 0) {
      page.drawRectangle({
        x: margin,
        y: rowBottom,
        width: tableWidth,
        height: rowHeight,
        color: toRgb(theme.zebraRowColor),
      });
    }

    let colX = margin;
    columns.forEach((column) => {
      const colWidth = tableWidth * column.width;
      if (column.key === "image") {
        if (embeddedImage) {
          const maxWidth = Math.max(Math.floor(14 * s), colWidth - 24);
          const maxHeight = Math.max(Math.floor(14 * s), rowHeight - Math.floor(12 * s));
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
        } else {
          const boxSize = Math.min(colWidth - 24, rowHeight - Math.floor(16 * s));
          const boxWidth = Math.max(Math.floor(24 * s), boxSize);
          const boxHeight = Math.max(Math.floor(24 * s), boxSize);
          const boxX = colX + (colWidth - boxWidth) / 2;
          const boxY = rowBottom + (rowHeight - boxHeight) / 2;
          page.drawRectangle({
            x: boxX,
            y: boxY,
            width: boxWidth,
            height: boxHeight,
            borderColor: toRgb(theme.tableBorderColor),
            borderWidth: 1,
            color: toRgb(theme.secondaryColor),
          });
          const placeholder = "No Img";
          const textWidth = font.widthOfTextAtSize(placeholder, Math.max(6, Math.floor(7 * s)));
          page.drawText(placeholder, {
            x: boxX + (boxWidth - textWidth) / 2,
            y: boxY + boxHeight / 2 - Math.max(3, Math.floor(4 * s)),
            size: Math.max(6, Math.floor(7 * s)),
            font,
            color: toRgb(theme.mutedText),
          });
        }
      } else if (column.key === "description") {
        const textX = colX + 14;
        let textY = rowTop - Math.max(14, Math.floor(18 * s));
        const productName = item.product || "-";
        page.drawText(productName, {
          x: textX,
          y: textY,
          size: productFontSize,
          font: bold,
          color: toRgb(theme.headerTextColor),
          maxWidth: colWidth - 28,
        });
        textY -= Math.max(10, Math.floor(13 * s));
        if (descriptionLines.length) {
          descriptionLines.forEach((line: string) => {
            page.drawText(line, {
              x: textX,
              y: textY,
              size: bodyFontSize,
              font,
              color: toRgb(theme.mutedText),
              maxWidth: colWidth - 28,
            });
            textY -= lineGap;
          });
        }
      } else {
        let value = "";
        let valueFont: PDFFont = font;
        let fontSize = bodyFontSize;
        switch (column.key) {
          case "qty":
            value = quantity ? quantity.toLocaleString("id-ID") : "";
            break;
          case "unit":
            value = item.unit || "pcs";
            break;
          case "price":
            value = price ? `Rp ${price.toLocaleString("id-ID")}` : "Rp 0";
            break;
          case "amount":
            value = `Rp ${lineAmount.toLocaleString("id-ID")}`;
            valueFont = bold;
            break;
        }

        const textWidth = valueFont.widthOfTextAtSize(value, fontSize);
        let textX = colX + 14;
        if (column.align === "center") {
          textX = colX + colWidth / 2 - textWidth / 2;
        } else if (column.align === "right") {
          textX = colX + colWidth - textWidth - 14;
        }
        const textY = rowBottom + (rowHeight - fontSize) / 2;
        page.drawText(value, {
          x: textX,
          y: textY,
          size: fontSize,
          font: valueFont,
          color: toRgb(column.key === "amount" ? theme.headerTextColor : theme.mutedText),
        });
      }
      colX += colWidth;
    });

    page.drawRectangle({
      x: margin,
      y: rowBottom,
      width: tableWidth,
      height: 0.6,
      color: toRgb(theme.tableBorderColor),
    });

    total += lineAmount;
    y -= rowHeight;
  }

  return { finalY: y - 12, total, page };
};

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
  const s = Math.max(0.6, Math.min(1, scale ?? 1));
  const { width } = page.getSize();
  const contentWidth = width - margin * 2;
  const rightWidth = contentWidth * 0.32;
  const leftWidth = contentWidth - rightWidth - Math.max(16, Math.floor(24 * s));
  const rightX = margin + leftWidth + Math.max(16, Math.floor(24 * s));

  const totalCardHeight = Math.max(64, Math.floor(90 * s));
  // Total card with rounded corners
  // Solid base fill to avoid any transparency issues
  page.drawRectangle({
    x: rightX,
    y: startY - totalCardHeight,
    width: rightWidth,
    height: totalCardHeight,
    color: toRgb(theme.totalBackground),
  });
  drawRoundedRect(
    page,
    rightX,
    startY - totalCardHeight,
    rightWidth,
    totalCardHeight,
    10,
    { color: toRgb(theme.totalBackground), borderColor: toRgb(theme.tableBorderColor), borderWidth: 1, opacity: 1 }
  );

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
    const scale = availableWidth / amountWidth;
    amountSize = Math.max(14, Math.floor(amountSize * scale));
    amountWidth = bold.widthOfTextAtSize(totalText, amountSize);
  }

  const messageHeight = thankYouMessage ? messageSize : 0;
  const contentHeight =
    labelSize + labelToAmountGap + amountSize + (thankYouMessage ? amountToMessageGap + messageHeight : 0);
  const verticalOffset = (totalCardHeight - contentHeight) / 2;

  const cardTop = startY;
  const labelY = cardTop - verticalOffset - labelSize;
  const amountY = labelY - labelToAmountGap - amountSize;
  const messageY = amountY - amountToMessageGap - messageSize;

  const totalLabel = "TOTAL DUE";
  const labelWidth = bold.widthOfTextAtSize(totalLabel, labelSize);
  const effectiveTextColor = isLightHex(theme.totalBackground) ? theme.headerTextColor : theme.totalTextColor;
  page.drawText(totalLabel, {
    x: rightX + rightWidth - paddingX - labelWidth,
    y: labelY,
    size: labelSize,
    font: bold,
    color: toRgb(effectiveTextColor),
  });
  page.drawText(totalText, {
    x: rightX + rightWidth - paddingX - amountWidth,
    y: amountY,
    size: amountSize,
    font: bold,
    color: toRgb(effectiveTextColor),
  });

  if (thankYouMessage) {
    const messageWidth = font.widthOfTextAtSize(thankYouMessage, messageSize);
    page.drawText(thankYouMessage, {
      x: rightX + rightWidth - paddingX - messageWidth,
      y: messageY,
      size: messageSize,
      font,
      color: toRgb(effectiveTextColor),
    });
  }

  const notesLines = (notes || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  page.drawText("NOTES", {
    x: margin,
    y: startY - Math.max(14, Math.floor(18 * s)),
    size: Math.max(8, Math.floor(10 * s)),
    font: bold,
    color: toRgb(theme.headerAccentColor),
  });

  // Notes box rounded to match UI
  const linesToRender = (notesLines.length ? notesLines : ["-"]).slice(0, 8);
  const notesTop = startY - Math.max(24, Math.floor(32 * s)); // just below label
  const boxPadding = Math.max(8, Math.floor(10 * s));
  const boxHeight = linesToRender.length * Math.max(11, Math.floor(13 * s)) + boxPadding * 2;
  const boxBottomY = notesTop - boxHeight;
  // Samakan warna background Notes dengan warna baris item (zebra)
  drawRoundedRect(page, margin, boxBottomY, leftWidth, boxHeight, 8, {
    borderColor: toRgb(theme.tableBorderColor),
    borderWidth: 1,
    color: toRgb(theme.zebraRowColor),
  });

  let noteY = notesTop - boxPadding;
  linesToRender.forEach((line) => {
    page.drawText(line, {
      x: margin + 8,
      y: noteY,
      size: Math.max(7, Math.floor(9 * s)),
      font,
      color: toRgb(theme.mutedText),
      maxWidth: leftWidth - 16,
    });
    noteY -= Math.max(11, Math.floor(13 * s));
  });

  const leftBottom = boxBottomY - 8;
  // Left column: Payment Info and Terms below Notes
  const leftTitleSize = Math.max(8, Math.floor(9 * s));
  const leftTextSize = Math.max(7, Math.floor(9 * s));
  const leftGap = Math.max(10, Math.floor(12 * s));
  const leftPaddingX = 8;
  const leftAvailableWidth = leftWidth - leftPaddingX * 2;
  let leftCursorY = leftBottom; // space below notes box

  // Payment Info title
  const paymentTitle = "PAYMENT INFO";
  page.drawText(paymentTitle, {
    x: margin + leftPaddingX,
    y: leftCursorY,
    size: leftTitleSize,
    font: bold,
    color: toRgb(theme.headerAccentColor),
  });
  leftCursorY -= Math.max(12, Math.floor(16 * s));
  const paymentToRender = (paymentLines.length ? paymentLines : ["Payment details available upon request."]).slice(0, 6);
  paymentToRender.forEach((line) => {
    page.drawText(line, {
      x: margin + leftPaddingX,
      y: leftCursorY,
      size: leftTextSize,
      font,
      color: toRgb(theme.mutedText),
      maxWidth: leftAvailableWidth,
    });
    leftCursorY -= leftGap;
  });

  // Terms & Conditions title
  leftCursorY -= Math.max(4, Math.floor(6 * s));
  const termsTitle = "TERMS & CONDITIONS";
  page.drawText(termsTitle, {
    x: margin + leftPaddingX,
    y: leftCursorY,
    size: leftTitleSize,
    font: bold,
    color: toRgb(theme.headerAccentColor),
  });
  leftCursorY -= Math.max(12, Math.floor(16 * s));
  const termsToRender = (termsLines.length ? termsLines : DEFAULT_TERMS).slice(0, 6);
  termsToRender.forEach((line) => {
    page.drawText(line, {
      x: margin + leftPaddingX,
      y: leftCursorY,
      size: leftTextSize,
      font,
      color: toRgb(theme.mutedText),
      maxWidth: leftAvailableWidth,
    });
    leftCursorY -= leftGap;
  });

  // Right side bottom anchor is just below the total card
  const rightBottom = startY - totalCardHeight - Math.max(12, Math.floor(16 * s));
  return Math.min(leftCursorY, rightBottom) - 24;
};

const drawFooterSummary = (
  page: PDFPage,
  theme: InvoiceTemplateTheme,
  paymentLines: string[],
  terms: string[],
  font: PDFFont,
  bold: PDFFont,
  margin: number,
  startY: number
) => {
  const { width } = page.getSize();
  const footerTop = Math.max(startY, margin + 120);
  const contentWidth = width - margin * 2;
  const columnWidth = contentWidth / 2;

  page.drawRectangle({
    x: margin,
    y: footerTop,
    width: contentWidth,
    height: 0.8,
    color: toRgb(theme.tableBorderColor),
  });

  const paymentDetails = paymentLines.length
    ? paymentLines
    : ["Payment details available upon request."];
  const termsLines = terms.length ? terms : DEFAULT_TERMS;

  const columns = [
    { title: "Payment Info", lines: paymentDetails },
    { title: "Terms & Conditions", lines: termsLines },
  ];

  const baseline = footerTop - 18;
  let lowestY = baseline - 16;

  columns.forEach(({ title, lines }, idx) => {
    const x = margin + idx * columnWidth;
    page.drawText(title.toUpperCase(), {
      x,
      y: baseline,
      size: 9.5,
      font: bold,
      color: toRgb(theme.headerAccentColor),
    });

    let lineY = baseline - 16;
    lines.slice(0, 6).forEach((line) => {
      page.drawText(line, {
        x,
        y: lineY,
        size: 9,
        font,
        color: toRgb(theme.mutedText),
        maxWidth: columnWidth - 8,
      });
      lineY -= 12;
    });
    lowestY = Math.min(lowestY, lineY);
  });

  return lowestY - 24;
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

  // Try to place signature image above the line
  const paddingTop = Math.max(8, Math.floor(10 * s));
  const maxImageH = Math.max(72, Math.floor(96 * s));
  let imageHUsed = 0;
  const sigUrl = (brand as any).signatureImageUrl || ((brand.templateDefaults || {}) as Record<string, unknown>)["signatureImageUrl"] as string | undefined;
  if (sigUrl) {
    const sig = await embedSignatureImage(pdf, sigUrl, sectionWidth - 24, maxImageH);
    if (sig) {
      const imgX = x + (sectionWidth - sig.width) / 2;
      const imgY = titleY - paddingTop - sig.height;
      page.drawImage(sig.image, { x: imgX, y: imgY, width: sig.width, height: sig.height });
      imageHUsed = sig.height;
    }
  }

  const lineY = titleY - (imageHUsed > 0 ? paddingTop + imageHUsed + Math.max(8, Math.floor(10 * s)) : Math.max(48, Math.floor(64 * s)));
  // Pendekkan garis pembatas dengan inset kiri/kanan agar tidak terlalu panjang
  const lineInset = Math.max(24, Math.floor(28 * s));
  page.drawRectangle({
    x: x + lineInset,
    y: lineY,
    width: sectionWidth - lineInset * 2,
    height: 0.8,
    color: toRgb(theme.tableBorderColor),
  });

  // Gunakan nama profil login jika ada, fallback ke brand
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

  return {
    page,
    finalY: lineY - 24,
  };
};
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const quotationId = Number(id);
    if (Number.isNaN(quotationId)) {
      return NextResponse.json(
        { success: false, message: "ID tidak valid" },
        { status: 400 }
      );
    }

    const quotation = await prisma.quotation.findUnique({
      where: { id: quotationId },
      select: {
        notes: true,
        customer: true,
        items: true,
        quotationNumber: true,
        date: true,
        validUntil: true,
        projectDesc: true,
        id: true,
      },
    });

    if (!quotation) {
      return NextResponse.json(
        { success: false, message: "Quotation tidak ditemukan" },
        { status: 404 }
      );
    }

    let brand = null as any;
    try {
      if ((quotation as any).brandProfileId) {
        brand = await prisma.brandProfile.findUnique({ where: { id: (quotation as any).brandProfileId } });
      }
      if (!brand) {
        brand = await getActiveBrandProfile();
      }
    } catch {}

    if (!brand) {
      return NextResponse.json(
        { success: false, message: "Brand aktif tidak ditemukan" },
        { status: 404 }
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const showImage = searchParams.get("showImage") !== "false";
    const showDescription = searchParams.get("showDescription") !== "false";
    const showProjectDesc = searchParams.get("showProjectDesc") !== "false";
    const showSignature = searchParams.get("showSignature") !== "false";

    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);
    const regularFontBytes = await loadFontBytes("regular");
    const semiBoldFontBytes = await loadFontBytes("semibold");
    const extraBoldFontBytes = await loadFontBytes("extrabold");
    const font = await safeEmbedFont(pdf, regularFontBytes, StandardFonts.Helvetica);
    const bold = await safeEmbedFont(pdf, semiBoldFontBytes, StandardFonts.HelveticaBold);
    const extraBold = await safeEmbedFont(pdf, extraBoldFontBytes, StandardFonts.HelveticaBold);
    let page = pdf.addPage();

    const scaleParam = Number(searchParams.get("scale"));
    const s = Number.isFinite(scaleParam) ? Math.max(0.6, Math.min(1, scaleParam)) : 0.85;
    const margin = Math.max(28, Math.floor(48 * s));
    const thankYouAndTerms = resolveThankYou(brand as BrandProfile);
    const paymentLines = resolvePaymentLines(brand as BrandProfile);
    const quotationNotes = typeof quotation.notes === "string" ? quotation.notes : "";

    const templateDefaults = (brand.templateDefaults ?? {}) as Record<string, string>;
    const theme = resolveTheme(brand as BrandProfile, templateDefaults?.invoice);

    // Gunakan profil user login untuk bagian FROM & Signature, fallback ke brand
    const auth = await getAuth();
    let actor: { name: string; email?: string | null; phone?: string | null } = {
      name: brand?.name ?? "Our Company",
      email: brand?.email ?? null,
      phone: brand?.phone ?? null,
    };
    if (auth?.userId) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: auth.userId },
          select: { name: true, firstName: true, lastName: true, email: true, phone: true, company: true },
        });
        if (user) {
          const fullName =
            user.name ||
            [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
            user.company ||
            actor.name;
          actor = {
            name: fullName,
            email: user.email || actor.email || null,
            phone: user.phone || actor.phone || null,
          };
        }
      } catch (e) {
        console.error("[quotations/pdf] Failed to load user profile for actor", e);
      }
    }

    let cursorY = await drawHeader(
      pdf,
      page,
      brand as BrandProfile,
      theme,
      quotation.quotationNumber || `QUO-${quotation.id}`,
      quotation.date,
      quotation.validUntil,
      font,
      bold,
      extraBold,
      margin
    );

    cursorY = drawInfoSection(
      page,
      theme,
      brand as BrandProfile,
      actor,
      quotation.customer,
      font,
      bold,
      margin,
      cursorY
    );

    if (showProjectDesc) {
      cursorY = drawProjectDescription(
        page,
        theme,
        quotation.projectDesc,
        font,
        bold,
        margin,
        cursorY
      );
    }

    const tableResult = await drawItemsTable(
      pdf,
      page,
      quotation.items,
      theme,
      font,
      bold,
      margin,
      cursorY,
      {
        showImage,
        showDescription,
        scale: s,
      }
    );

    page = tableResult.page;
    let finalY = tableResult.finalY;

    if (finalY < margin + Math.floor(160 * s)) {
      page = pdf.addPage();
      finalY = page.getSize().height - margin - Math.floor(160 * s);
    }

    let footerAnchor = drawTotalsAndNotes(
      page,
      theme,
      tableResult.total,
      quotationNotes,
      thankYouAndTerms.message,
      paymentLines,
      thankYouAndTerms.terms,
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
      const signatureResult = await drawSignatureSection(
        pdf,
        page,
        theme,
        brand as BrandProfile,
        actor,
        bold,
        margin,
        footerAnchor,
        s
      );
      page = signatureResult.page;
    }

    const pdfBytes = Buffer.from(await pdf.save());
    const safeQuotationNumber = (quotation.quotationNumber || `QUO-${quotation.id}`).replace(/[^\w\-]+/g, "_");
    const safeCustomer = (quotation.customer?.company || quotation.customer?.pic || "Customer").replace(/[^\w\-]+/g, "_");
    const fileName = `Quotation-${safeQuotationNumber}-${safeCustomer}.pdf`;

    return new Response(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("[quotations/pdf] error", error);
    return NextResponse.json(
      { success: false, message: "Gagal membuat PDF" },
      { status: 500 }
    );
  }
}
