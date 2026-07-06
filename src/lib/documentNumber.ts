import { prisma } from "@/lib/prisma";
type BrandProfile = { id: number; name?: string | null; numberFormats?: unknown; [key: string]: unknown };

export type DocumentType = "quotation" | "salesOrder" | "invoice" | "deliveryNote" | "deliveryOrder" | "purchaseInvoice" | "purchaseOrder";

const DEFAULT_FORMAT: Record<DocumentType, string> = {
  quotation: "QUO-{YYYY}-{MM}-{SEQ4}",
  salesOrder: "SO-{YYYY}-{MM}-{SEQ4}",
  invoice: "INV-{YYYY}-{MM}-{SEQ4}",
  deliveryNote: "DN-{YYYY}-{MM}-{SEQ4}",
  deliveryOrder: "DO-{YYYY}-{MM}-{SEQ4}",
  purchaseInvoice: "PINV-{YYYY}-{MM}-{SEQ4}",
  purchaseOrder: "PO-{YYYY}-{MM}-{SEQ4}",
};

export function toRoman(month: number): string {
  const romans = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"];
  const idx = Math.max(1, Math.min(12, month)) - 1;
  return romans[idx];
}

export function brandCodeFromProfile(brand: { name?: string|null; slug?: string|null }): string {
  const base = (brand.slug || brand.name || "BRD").replace(/[^A-Za-z]/g, "");
  return (base.toUpperCase().slice(0,3) || "BRD");
}

function getFormatForType(brand: BrandProfile | null, type: DocumentType): string {
  const nf = brand?.numberFormats as any | undefined;
  const fmt = nf?.[type] as string | undefined;
  return fmt && fmt.trim().length ? fmt : DEFAULT_FORMAT[type];
}

function hasBrandPlaceholder(fmt: string): boolean {
  return /\{BRAND\d*\}/.test(fmt) || /\(BRAND\d*\)/i.test(fmt);
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

function buildPrefix(fmt: string, brand: BrandProfile | null, date: Date): string {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const roman = toRoman(date.getMonth() + 1);
  const fullName = (brand?.name || "BRD").toUpperCase();
  const defaultCode = fullName.replace(/[^A-Za-z0-9]/g, "").slice(0, 3) || "BRD";

  // Replace variables except sequence, keep separators as-is
  let prefix = fmt
    .replace(/\{BRAND(\d+)\}/g, (_, n) => fullName.replace(/[^A-Za-z0-9]/g, "").slice(0, parseInt(n)))
    .replace(/\{BRAND\}/g, fullName.replace(/[^A-Za-z0-9]/g, ""))
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
    prefix = `${defaultCode}-${prefix}`;
  }
  return prefix;
}

export async function generateNextNumber(
  type: DocumentType,
  opts: { brandProfileId?: number|null; date?: Date }
): Promise<string> {
  const date = opts.date ?? new Date();
  const brand = opts.brandProfileId ? await prisma.brandProfile.findUnique({ where: { id: opts.brandProfileId } }) : null;
  const fmt = getFormatForType(brand as any, type);
  const seqLen = seqLengthFromFormat(fmt);
  
  // Robust matching: Split format by sequence placeholder to get static prefix and suffix
  const seqRegex = /\{SEQ\d+\}|\{0{2,}\}|\(SEQ\d+\)|\(0{2,}\)/;
  const parts = fmt.split(seqRegex);
  const rawPrefix = parts[0] || "";
  const rawSuffix = parts[1] || "";

  // Resolve variables in prefix and suffix
  const resolve = (s: string) => {
    const yyyy = String(date.getFullYear());
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const roman = toRoman(date.getMonth() + 1);
    const fullName = (brand?.name || "BRD").toUpperCase();
    const brandPrefix = fullName.replace(/[^A-Za-z0-9]/g, "");
    
    return s
      .replace(/\{BRAND(\d+)\}/g, (_, n) => brandPrefix.slice(0, parseInt(n)))
      .replace(/\{BRAND\}/g, brandPrefix)
      .replace(/\{YYYY\}/g, yyyy)
      .replace(/\{MM\}/g, mm)
      .replace(/\{ROMAN\}/g, roman);
  };

  const resolvedPrefix = resolve(rawPrefix);
  const resolvedSuffix = resolve(rawSuffix);

  // Fallback for default brand prefixing if no brand placeholder is used
  let finalPrefix = resolvedPrefix;
  if (brand && !hasBrandPlaceholder(fmt) && !resolvedPrefix.includes(brandCodeFromProfile({ name: brand.name }))) {
    // This is a bit complex, but usually if no placeholder, we prepend.
    // If we already have a prefix, we'll keep it.
  }

  const whereClause: any = {
    ...(opts.brandProfileId ? { brandProfileId: opts.brandProfileId } : {}),
  };

  // Add numbering match
  const fieldMap: Record<DocumentType, string> = {
    quotation: "quotationNumber",
    salesOrder: "orderNumber",
    invoice: "invoiceNumber",
    deliveryNote: "deliveryNumber",
    deliveryOrder: "doNumber",
    purchaseInvoice: "invoiceNumber",
    purchaseOrder: "orderNumber"
  };
  const field = fieldMap[type];

  if (field) {
    whereClause[field] = {
      startsWith: resolvedPrefix,
      endsWith: resolvedSuffix
    };
  }

  let count = 0;
  try {
    if (type === "deliveryNote") {
       count = await (prisma as any).delivery.count({ where: whereClause });
    } else {
       count = await (prisma as any)[type].count({ where: whereClause });
    }
  } catch (e) {
    console.error(`Error counting ${type}:`, e);
    count = 0;
  }

  const seq = String(count + 1).padStart(seqLen, "0");
  // Compose final replacing sequence placeholder
  const fullName = (brand?.name || "BRD").toUpperCase();
  const base = fmt
    .replace(/\{BRAND(\d+)\}/g, (_, n) => fullName.replace(/[^A-Za-z0-9]/g, "").slice(0, parseInt(n)))
    .replace(/\{BRAND\}/g, fullName.replace(/[^A-Za-z0-9]/g, ""))
    .replace(/\{YYYY\}/g, String(date.getFullYear()))
    .replace(/\{MM\}/g, String(date.getMonth() + 1).padStart(2, "0"))
    .replace(/\{ROMAN\}/g, toRoman(date.getMonth() + 1))
    .replace(/\{SEQ\d+\}/g, seq)
    .replace(/\{0{2,}\}/g, seq)
    // Support parenthesis-style placeholders as well
    .replace(/\(SEQ\d+\)/g, seq)
    .replace(/\(0{2,}\)/g, seq);
  if (brand && !hasBrandPlaceholder(fmt)) {
    const defaultCode = fullName.replace(/[^A-Za-z0-9]/g, "").slice(0, 3) || "BRD";
    return `${defaultCode}-${base}`;
  }
  return base;
}
