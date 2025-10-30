import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage, type PDFImage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "fs/promises";
import path from "path";
import { toRgb255, type InvoiceTemplateTheme } from "./quotationTheme";

export type BrandProfile = {
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
  // Optional signature fields (can also live in templateDefaults)
  signatureName?: string | null;
  signatureTitle?: string | null;
  signatureImageUrl?: string | null;
};

export const toRgb = (hex?: string) => {
  const { r, g, b } = toRgb255(hex);
  return rgb(r / 255, g / 255, b / 255);
};

export const isLightHex = (hex?: string) => {
  if (!hex) return true;
  const { r, g, b } = toRgb255(hex);
  const lum = 0.2126 * (r / 255) + 0.7152 * (g / 255) + 0.0722 * (b / 255);
  return lum > 0.7;
};

export const splitTextToSize = (
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

// Fonts (fallback ke PlusJakartaSans dari public/fonts)
const FONT_REGULAR_PATH = path.join(process.cwd(), "public", "fonts", "PlusJakartaSans-Medium.ttf");
const FONT_SEMIBOLD_PATH = path.join(process.cwd(), "public", "fonts", "PlusJakartaSans-Bold.ttf");
const FONT_EXTRABOLD_PATH = path.join(process.cwd(), "public", "fonts", "PlusJakartaSans-Bold.ttf");

const fontCache: { regular?: Uint8Array; semibold?: Uint8Array; extrabold?: Uint8Array } = {};

export const loadFontBytes = async (weight: "regular" | "semibold" | "extrabold") => {
  try {
    if (fontCache[weight]) return fontCache[weight]!;
    const filePath = weight === "regular" ? FONT_REGULAR_PATH : weight === "semibold" ? FONT_SEMIBOLD_PATH : FONT_EXTRABOLD_PATH;
    const file = await fs.readFile(filePath);
    fontCache[weight] = file;
    return file;
  } catch (err) {
    console.error(`[pdfCommon] Failed to read font file for ${weight}`, err);
    return null;
  }
};

export const safeEmbedFont = async (pdfDoc: PDFDocument, bytes: Uint8Array | null | undefined, fallback: StandardFonts): Promise<PDFFont> => {
  try {
    if (bytes && bytes.length) {
      return await pdfDoc.embedFont(bytes, { subset: true });
    }
    return await pdfDoc.embedStandardFont(fallback);
  } catch (err) {
    console.error("[pdfCommon] embedFont failed, using standard font fallback", err);
    return await pdfDoc.embedStandardFont(fallback);
  }
};

// Logo
const PUBLIC_DIR = path.join(process.cwd(), "public");

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
    console.error("[pdfCommon] Failed to load image bytes:", source, error);
    return null;
  }
};

export const embedBrandLogo = async (pdfDoc: PDFDocument, brand: BrandProfile): Promise<{ image: PDFImage; width: number; height: number } | null> => {
  if (!brand.logoUrl) return null;
  try {
    const logoUrl = brand.logoUrl.startsWith("http")
      ? brand.logoUrl
      : `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}${brand.logoUrl}`;
    const response = await fetch(logoUrl);
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let image: PDFImage;
    try {
      image = await pdfDoc.embedPng(bytes);
    } catch {
      image = await pdfDoc.embedJpg(bytes);
    }
    const { width, height } = image.scale(1);
    const maxWidth = 90;
    const maxHeight = 50;
    const scale = Math.min(maxWidth / width, maxHeight / height, 1);
    return { image, width: width * scale, height: height * scale };
  } catch (error) {
    console.error("[pdfCommon] Failed to embed brand logo:", error);
    return null;
  }
};

// Signature helpers
export const resolveSignatureMeta = (brand: BrandProfile): { imageUrl?: string; name?: string; title?: string } => {
  const td = (brand.templateDefaults ?? {}) as Record<string, unknown>;
  const imageUrl = (brand.signatureImageUrl as string | undefined) || (td["signatureImageUrl"] as string | undefined);
  const name = (brand.signatureName as string | undefined) || (td["signatureName"] as string | undefined) || brand.name;
  const title = (brand.signatureTitle as string | undefined) || (td["signatureTitle"] as string | undefined);
  return { imageUrl, name, title };
};

export const embedSignatureImage = async (
  pdfDoc: PDFDocument,
  imageUrl?: string,
  maxWidth = 260,
  maxHeight = 80
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
    console.error("[pdfCommon] Failed to embed signature image:", error);
    return null;
  }
};

// Init helper: register fontkit & embed brand fonts consistently
export const initPdfWithBrandFonts = async () => {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit as any);
  const regularBytes = await loadFontBytes("regular");
  const semiBoldBytes = await loadFontBytes("semibold");
  const extraBoldBytes = await loadFontBytes("extrabold");
  const font = await safeEmbedFont(pdf, regularBytes, StandardFonts.Helvetica);
  const bold = await safeEmbedFont(pdf, semiBoldBytes, StandardFonts.HelveticaBold);
  const extraBold = await safeEmbedFont(pdf, extraBoldBytes, StandardFonts.HelveticaBold);
  return { pdf, font, bold, extraBold };
};

// Common header: brand on left, title & meta on right, separator line below
export const drawHeaderCommon = async (
  pdf: PDFDocument,
  page: PDFPage,
  brand: BrandProfile,
  theme: InvoiceTemplateTheme,
  title: string,
  metaLines: Array<{ label: string; value: string }>,
  font: PDFFont,
  bold: PDFFont,
  extraBold: PDFFont,
  margin: number
): Promise<number> => {
  const { width, height } = page.getSize();
  const topY = height - margin;
  const leftX = margin;
  let currentY = topY - 12;
  let logoWidth = 0;
  let logoHeight = 0;
  const logo = await embedBrandLogo(pdf, brand);

  if (logo) {
    page.drawImage(logo.image, { x: leftX, y: currentY - logo.height, width: logo.width, height: logo.height });
    logoWidth = logo.width;
    logoHeight = logo.height;
  }

  const nameX = logoWidth ? leftX + logoWidth + 12 : leftX;
  const brandNameSize = 22;
  const brandAscent = Math.floor(brandNameSize * 0.78);
  const brandOffsetDown = 3;
  let nameY = currentY - brandAscent - brandOffsetDown;

  if ((brand.showBrandName ?? true) && brand.name) {
    page.drawText(brand.name, { x: nameX, y: nameY, size: brandNameSize, font: bold, color: toRgb(theme.primaryColor) });
    nameY -= 16;
  }

  if ((brand.showBrandDescription ?? true) && brand.overview) {
    page.drawText(brand.overview, { x: nameX, y: nameY, size: 11, font, color: toRgb(theme.mutedText), maxWidth: width * 0.45 });
    nameY -= 14;
  }

  const brandContactLines: string[] = [];
  // Tampilkan website terlebih dahulu, lalu email
  if ((brand.showBrandWebsite ?? true) && brand.website && brand.website.trim()) {
    brandContactLines.push(brand.website.trim());
  }
  if ((brand.showBrandEmail ?? true) && brand.email && brand.email.trim()) {
    brandContactLines.push(brand.email.trim());
  }
  const contactStartY = logoHeight ? currentY - logoHeight - 16 : nameY - 12;
  let contactY = contactStartY;
  brandContactLines.forEach((line) => {
    page.drawText(line, { x: leftX, y: contactY, size: 9, font, color: toRgb(theme.mutedText), maxWidth: Math.max(logoWidth, width * 0.25) });
    contactY -= 12;
  });
  // Alamat perusahaan di bawah email (jika diizinkan)
  if ((brand.showBrandAddress ?? true) && brand.address && String(brand.address).trim().length > 0) {
    const addrLines = splitTextToSize(String(brand.address), Math.max(logoWidth, width * 0.25) - 2, font, 8);
    addrLines.forEach((line) => {
      page.drawText(line, { x: leftX, y: contactY, size: 8, font, color: toRgb(theme.mutedText) });
      contactY -= 11;
    });
  }
  const brandBottom = (brandContactLines.length || ((brand.showBrandAddress ?? true) && brand.address)) ? contactY : topY - logoHeight - 20;

  const rightX = width - margin;
  const titleWidth = extraBold.widthOfTextAtSize(title.toUpperCase(), 26);
  page.drawText(title.toUpperCase(), { x: rightX - titleWidth, y: topY - 18, size: 26, font: extraBold, color: toRgb(theme.primaryColor) });

  let metaY = topY - 48;
  metaLines.forEach(({ label, value }) => {
    const labelWidth = font.widthOfTextAtSize(label, 9);
    page.drawText(label, { x: rightX - labelWidth, y: metaY, size: 9, font, color: toRgb(theme.mutedText) });
    const valueWidth = bold.widthOfTextAtSize(value, 11);
    page.drawText(value, { x: rightX - valueWidth, y: metaY - 14, size: 11, font: bold, color: toRgb(theme.headerTextColor) });
    metaY -= 24;
  });

  const contentBottom = Math.min(brandBottom, nameY, metaY);
  const separatorY = contentBottom - 18;
  page.drawRectangle({ x: margin, y: separatorY, width: width - margin * 2, height: 0.8, color: toRgb(theme.tableBorderColor) });
  return separatorY - 24;
};

export const drawInfoSectionCommon = (
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

  const combinedName = customer && (customer.pic || customer.company)
    ? [customer.pic, customer.company].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(" | ")
    : "Customer";

  const fromRows: Array<{ text: string; size?: number; font?: PDFFont; color?: ReturnType<typeof rgb> }> = [];
  const fromHeading = actor.name || brand.name || "Our Company";
  fromRows.push({ text: fromHeading, size: 10, font: bold, color: toRgb(theme.headerTextColor) });
  const contactValues = [
    actor.email || ((brand.showBrandEmail ?? true) ? brand.email : null),
    actor.phone || brand.phone,
  ].filter((v): v is string => Boolean(v && v.trim())).filter((v, i, a) => a.indexOf(v) === i);
  contactValues.forEach((value) => fromRows.push({ text: value, size: 9, font, color: toRgb(theme.mutedText) }));
  if ((brand.showBrandAddress ?? true) && brand.address)
    splitTextToSize(String(brand.address), columnWidth - 4, font, 8).forEach((line) => fromRows.push({ text: line, size: 8, font, color: toRgb(theme.mutedText) }));

  const billRows: Array<{ text: string; size?: number; font?: PDFFont; color?: ReturnType<typeof rgb> }> = [];
  billRows.push({ text: combinedName, size: 10, font: bold, color: toRgb(theme.headerTextColor) });
  if (customer?.address) splitTextToSize(String(customer.address), columnWidth - 4, font, 8).forEach((line) => billRows.push({ text: line, size: 8, font, color: toRgb(theme.mutedText) }));
  [customer?.email, customer?.phone].filter((v): v is string => Boolean(v && v.trim())).filter((v, i, a) => a.indexOf(v) === i).forEach((value) => billRows.push({ text: value, size: 9, font, color: toRgb(theme.mutedText) }));

  const columns = [
    { title: "From", rows: fromRows.length ? fromRows : [{ text: "-", size: 9, font, color: toRgb(theme.mutedText) }] },
    { title: "Bill To", rows: billRows.length ? billRows : [{ text: "-", size: 9, font, color: toRgb(theme.mutedText) }] },
  ];

  let lowestY = baseY;
  columns.forEach(({ title, rows }, index) => {
    const x = margin + index * (columnWidth + gap);
    page.drawText(title.toUpperCase(), { x, y: baseY, size: 10, font: bold, color: toRgb(theme.headerAccentColor) });
    page.drawRectangle({ x, y: baseY - 12, width: columnWidth, height: 0.6, color: toRgb(theme.tableBorderColor) });
    let lineY = baseY - 24;
    rows.slice(0, 10).forEach((row, rowIndex) => {
      const size = row.size ?? (rowIndex === 0 ? 10 : 9);
      const rowFont = row.font ?? (rowIndex === 0 ? bold : font);
      const rowColor = row.color ?? toRgb(rowIndex === 0 ? theme.headerTextColor : theme.mutedText);
      page.drawText(row.text, { x, y: lineY, size, font: rowFont, color: rowColor, maxWidth: columnWidth - 4 });
      const gapY = rowIndex === 0 ? 16 : size && size <= 8 ? 11 : 12;
      lineY -= gapY;
    });
    lowestY = Math.min(lowestY, lineY);
  });
  return lowestY - 18;
};

export const drawSignatureSectionCommon = async (
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
  const s = Math.max(0.6, Math.min(1, scale ?? 1));
  const { width } = page.getSize();
  const sectionHeight = Math.floor(160 * s);
  let y = startY - 6;

  // Title
  page.drawText("SIGNATURE", { x: margin, y, size: Math.max(8, Math.floor(10 * s)), font: bold, color: toRgb(theme.headerAccentColor) });
  y -= Math.floor(16 * s);

  // Box
  const boxX = margin;
  const boxY = y - sectionHeight;
  const boxW = width - margin * 2;
  const boxH = sectionHeight;
  page.drawRectangle({ x: boxX, y: boxY, width: boxW, height: boxH, borderColor: toRgb(theme.tableBorderColor), borderWidth: 0.8 });

  // Signature image (if available)
  const { imageUrl, name: metaName } = resolveSignatureMeta(brand);
  if (imageUrl) {
    const padding = Math.floor(12 * s);
    const maxW = boxW - padding * 2;
    const maxH = Math.floor(boxH * 0.8);
    const sig = await embedSignatureImage(pdf, imageUrl, maxW, maxH);
    if (sig) {
      const imgX = boxX + (boxW - sig.width) / 2;
      const imgY = boxY + boxH - padding - sig.height;
      page.drawImage(sig.image, { x: imgX, y: imgY, width: sig.width, height: sig.height });
    }
  }

  // Caption (printed name)
  const caption = actor?.name || metaName || brand.name || "Authorized";
  page.drawText(caption, { x: margin + 12, y: y - 16, size: Math.max(9, Math.floor(11 * s)), font: bold, color: toRgb(theme.headerTextColor) });

  return { page, finalY: y - sectionHeight - Math.floor(18 * s) };
};

// Draw multi-column signature section (e.g., 3 columns for Delivery Notes)
export const drawSignatureColumnsCommon = async (
  pdf: PDFDocument,
  page: PDFPage,
  theme: InvoiceTemplateTheme,
  regular: PDFFont,
  bold: PDFFont,
  margin: number,
  startY: number,
  columns: Array<{ title: string; caption?: string }>,
  boxHeight = 96,
  signatures?: Array<{ index: number; imageUrl?: string }>
): Promise<{ page: PDFPage; finalY: number }> => {
  const { width } = page.getSize();
  const innerWidth = width - margin * 2;
  const gap = 12;
  const colWidth = (innerWidth - gap * (columns.length - 1)) / columns.length;

  let y = startY - 6;

  // Titles
  columns.forEach((col, i) => {
    const x = margin + i * (colWidth + gap);
    page.drawText(col.title.toUpperCase(), {
      x,
      y,
      size: 10,
      font: bold,
      color: toRgb(theme.headerAccentColor),
    });
  });
  y -= 14;

  // Boxes
  columns.forEach((_, i) => {
    const x = margin + i * (colWidth + gap);
    page.drawRectangle({
      x,
      y: y - boxHeight,
      width: colWidth,
      height: boxHeight,
      borderColor: toRgb(theme.tableBorderColor),
      borderWidth: 0.8,
    });
  });

  // Optional signature images inside boxes
  if (signatures && signatures.length) {
    const padding = 8;
    for (const sigMeta of signatures) {
      const i = sigMeta.index;
      if (i < 0 || i >= columns.length) continue;
      const x = margin + i * (colWidth + gap);
      const boxX = x;
      const boxY = y - boxHeight;
      const maxW = colWidth - padding * 2;
      const maxH = boxHeight - padding * 2;
      if (sigMeta.imageUrl) {
        const sig = await embedSignatureImage(pdf, sigMeta.imageUrl, maxW, Math.floor(maxH * 0.9));
        if (sig) {
          const imgX = boxX + (colWidth - sig.width) / 2;
          const imgY = boxY + boxHeight - padding - sig.height;
          page.drawImage(sig.image, { x: imgX, y: imgY, width: sig.width, height: sig.height });
        }
      }
    }
  }
  y -= boxHeight + 6;

  // Captions
  columns.forEach((col, i) => {
    const x = margin + i * (colWidth + gap);
    if (col.caption) {
      page.drawText(col.caption, {
        x: x + 8,
        y,
        size: 9,
        font: regular,
        color: toRgb(theme.mutedText),
        maxWidth: colWidth - 16,
      });
    }
  });
  y -= 14;

  return { page, finalY: y };
};
