import { prisma } from "@/lib/prisma";
import type { BrandProfile } from "@/types/brand";

export type DocumentType =
  | "quotation"
  | "salesOrder"
  | "invoice"
  | "deliveryNote";

const DEFAULT_FORMAT: Record<DocumentType, string> = {
  quotation: "QUO-{YYYY}-{MM}-{SEQ4}",
  salesOrder: "SO-{YYYY}-{MM}-{SEQ4}",
  invoice: "INV-{YYYY}-{MM}-{SEQ4}",
  deliveryNote: "DN-{YYYY}-{MM}-{SEQ4}",
};

type BrandProfileWithExtras = BrandProfile & {
  slug?: unknown;
  numberFormats?: unknown;
};

export function toRoman(month: number): string {
  const romans = [
    "I",
    "II",
    "III",
    "IV",
    "V",
    "VI",
    "VII",
    "VIII",
    "IX",
    "X",
    "XI",
    "XII",
  ];
  const idx = Math.max(1, Math.min(12, month)) - 1;
  return romans[idx];
}

export function brandCodeFromProfile(brand: {
  name?: string | null;
  slug?: string | null;
}): string {
  const base = (brand.slug || brand.name || "BRD").replace(/[^A-Za-z]/g, "");
  return base.toUpperCase().slice(0, 3) || "BRD";
}

function getFormatForType(
  brand: BrandProfileWithExtras | null,
  type: DocumentType
): string {
  const nf = brand?.numberFormats as Record<string, unknown> | undefined;
  const fmt = nf?.[type] as string | undefined;
  return fmt && fmt.trim().length ? fmt : DEFAULT_FORMAT[type];
}

function hasBrandPlaceholder(fmt: string): boolean {
  return /\{BRAND\}/.test(fmt) || /\(BRAND\)/i.test(fmt);
}

function seqLengthFromFormat(fmt: string): number {
  // Support both curly and parenthesis styles: {SEQ3} or (SEQ3)
  const m = fmt.match(/\{SEQ(\d+)\}/) || fmt.match(/\(SEQ(\d+)\)/);
  if (m) return Number(m[1]);
  // Also support {0000} or (0000) style as sequence placeholder length
  const z = fmt.match(/\{0{2,}\}/) || fmt.match(/\(0{2,}\)/);
  if (z) {
    const digits = z[0].match(/0+/);
    return digits ? digits[0].length : 4;
  }
  return 4;
}

function buildPrefix(
  fmt: string,
  brand: BrandProfileWithExtras | null,
  date: Date
): string {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const roman = toRoman(date.getMonth() + 1);
  const code = brandCodeFromProfile({
    name: brand?.name,
    slug: typeof brand?.slug === "string" ? brand.slug : null,
  });

  // Replace variables except sequence, keep separators as-is
  let prefix = fmt
    .replace(/\{BRAND\}/g, code)
    .replace(/\{YYYY\}/g, yyyy)
    .replace(/\{MM\}/g, mm)
    .replace(/\{ROMAN\}/g, roman)
    .replace(/\{SEQ\d+\}/g, "")
    .replace(/\{0{2,}\}/g, "")
    // Also strip parenthesis-style placeholders from prefix
    .replace(/\(SEQ\d+\)/g, "")
    .replace(/\(0{2,}\)/g, "");

  // Enforce brand code prefix if brand exists and format doesn't include it
  if (brand && !hasBrandPlaceholder(fmt)) {
    prefix = `${code}-${prefix}`;
  }
  return prefix;
}

export async function generateNextNumber(
  type: DocumentType,
  opts: { brandProfileId?: number | null; date?: Date }
): Promise<string> {
  const date = opts.date ?? new Date();
  const brand = opts.brandProfileId
    ? await prisma.brandProfile.findUnique({
        where: { id: opts.brandProfileId },
      })
    : null;
  const fmt = getFormatForType(brand, type);
  const seqLen = seqLengthFromFormat(fmt);
  const prefix = buildPrefix(fmt, brand, date);

  let count = 0;
  if (type === "invoice") {
    count = await prisma.invoice.count({
      where: {
        invoiceNumber: { startsWith: prefix },
        ...(opts.brandProfileId
          ? { brandProfileId: opts.brandProfileId }
          : {}),
      },
    });
  } else if (type === "quotation") {
    count = await prisma.quotation.count({
      where: {
        quotationNumber: { startsWith: prefix },
        ...(opts.brandProfileId
          ? { brandProfileId: opts.brandProfileId }
          : {}),
      },
    });
  } else if (type === "salesOrder") {
    count = await prisma.salesOrder.count({
      where: {
        orderNumber: { startsWith: prefix },
        ...(opts.brandProfileId
          ? { brandProfileId: opts.brandProfileId }
          : {}),
      },
    });
  } else if (type === "deliveryNote") {
    // Be defensive: some deployments may not have Delivery model/table yet.
    try {
      if (
        "delivery" in prisma &&
        typeof (prisma as { delivery?: { count: () => Promise<number> } })
          .delivery?.count === "function"
      ) {
        // @ts-expect-error: model may not exist in some schemas
        count = await prisma.delivery.count({
          where: {
            deliveryNumber: { startsWith: prefix },
            ...(opts.brandProfileId
              ? { brandProfileId: opts.brandProfileId }
              : {}),
          },
        });
      }
    } catch {
      count = 0;
    }
  }

  const seq = String(count + 1).padStart(seqLen, "0");
  const brandCode = brandCodeFromProfile({
    name: brand?.name,
    slug: typeof (brand as BrandProfileWithExtras)?.slug === "string" ? (brand as BrandProfileWithExtras).slug as string : null,
  });

  // Compose final replacing sequence placeholder
  const base = fmt
    .replace(/\{BRAND\}/g, brandCode)
    .replace(/\{YYYY\}/g, String(date.getFullYear()))
    .replace(/\{MM\}/g, String(date.getMonth() + 1).padStart(2, "0"))
    .replace(/\{ROMAN\}/g, toRoman(date.getMonth() + 1))
    .replace(/\{SEQ\d+\}/g, seq)
    .replace(/\{0{2,}\}/g, seq)
    // Support parenthesis-style placeholders as well
    .replace(/\(SEQ\d+\)/g, seq)
    .replace(/\(0{2,}\)/g, seq);

  if (brand && !hasBrandPlaceholder(fmt)) {
    return `${brandCode}-${base}`;
  }
  return base;
}
