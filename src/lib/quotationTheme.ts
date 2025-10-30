export type InvoiceTemplateTheme = {
  primaryColor: string;
  secondaryColor: string;
  headerBandColor: string;
  headerTextColor: string;
  headerAccentColor: string;
  headerOverlayColor: string;
  badgeBackground: string;
  badgeTextColor: string;
  tableHeaderBackground: string;
  tableHeaderTextColor: string;
  zebraRowColor: string;
  tableBorderColor: string;
  totalBackground: string;
  totalTextColor: string;
  footerBackground: string | null;
  footerTextColor: string;
  noteBackground: string;
  noteBorderColor: string;
  mutedText: string;
};

export interface ThemeBrandProfile {
  primaryColor?: string | null;
  secondaryColor?: string | null;
  footerText?: string | null;
  termsConditions?: string | null;
  paymentInfo?: string | null;
  templateDefaults?: Record<string, unknown> | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
}

export const DEFAULT_TERMS = [
  "Payment due within 30 days of invoice date",
  "Prices are valid for 30 days from quotation date",
  "All goods remain property of seller until paid in full",
];

const templateThemes: Record<string, Partial<InvoiceTemplateTheme>> = {
  "invoice-modern-warm": {
    primaryColor: "#E85C57",
    secondaryColor: "#FFEAE5",
    headerBandColor: "#FDE8E3",
    headerTextColor: "#2F1412",
    headerAccentColor: "#2F1412",
    headerOverlayColor: "#F3B5AE",
    badgeBackground: "#FFE3DC",
    badgeTextColor: "#7A231D",
    tableHeaderBackground: "#F9D1C9",
    tableHeaderTextColor: "#651B16",
    zebraRowColor: "#FFF4F1",
    tableBorderColor: "#F3B5AE",
    totalBackground: "#2F1412",
    totalTextColor: "#FFFFFF",
    footerBackground: "#FDE8E3",
    footerTextColor: "#4C1D18",
    noteBackground: "#FFEDE7",
    noteBorderColor: "#E9B0A7",
    mutedText: "#70433B",
  },
  "invoice-modern-indigo": {
    primaryColor: "#4C1D95",
    secondaryColor: "#EDE9FE",
    headerBandColor: "#DCD7FE",
    headerTextColor: "#1E1B4B",
    headerAccentColor: "#1E1B4B",
    headerOverlayColor: "#7360D8",
    badgeBackground: "#E4DDFE",
    badgeTextColor: "#2C1F6B",
    tableHeaderBackground: "#DDD6FE",
    tableHeaderTextColor: "#1E1B4B",
    zebraRowColor: "#F5F3FF",
    tableBorderColor: "#C7BDFB",
    totalBackground: "#1E1B4B",
    totalTextColor: "#FFFFFF",
    footerBackground: "#E0E7FF",
    footerTextColor: "#312E81",
    noteBackground: "#E9E5FF",
    noteBorderColor: "#C7BDFB",
    mutedText: "#43348F",
  },
};

export const toRgb255 = (hex?: string) => {
  if (!hex) return { r: 0, g: 0, b: 0 };
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
};

export const adjustHex = (hex: string, amount: number) => {
  const { r, g, b } = toRgb255(hex);
  const adjust = (channel: number) => {
    const val = channel + (amount >= 0 ? (255 - channel) * amount : channel * amount);
    return Math.max(0, Math.min(255, Math.round(val)));
  };
  const rr = adjust(r).toString(16).padStart(2, "0");
  const gg = adjust(g).toString(16).padStart(2, "0");
  const bb = adjust(b).toString(16).padStart(2, "0");
  return `#${rr}${gg}${bb}`;
};

export const resolveTheme = (brand: ThemeBrandProfile, templateId?: string | null): InvoiceTemplateTheme => {
  const base: InvoiceTemplateTheme = {
    primaryColor: brand.primaryColor || "#1E3A8A",
    secondaryColor: brand.secondaryColor || "#EEF2FF",
    headerBandColor: adjustHex(brand.secondaryColor || "#EEF2FF", 0.15),
    headerTextColor: "#1F2937",
    headerAccentColor: adjustHex(brand.primaryColor || "#1E3A8A", -0.5),
    headerOverlayColor: adjustHex(brand.primaryColor || "#1E3A8A", 0.2),
    badgeBackground: adjustHex(brand.secondaryColor || "#EEF2FF", 0.05),
    badgeTextColor: adjustHex(brand.primaryColor || "#1E3A8A", -0.4),
    tableHeaderBackground: adjustHex(brand.primaryColor || "#1E3A8A", 0.25),
    tableHeaderTextColor: "#1F2937",
    zebraRowColor: adjustHex(brand.secondaryColor || "#EEF2FF", 0.4),
    tableBorderColor: adjustHex(brand.primaryColor || "#1E3A8A", -0.1),
    totalBackground: adjustHex(brand.primaryColor || "#1E3A8A", -0.35),
    totalTextColor: "#FFFFFF",
    footerBackground: adjustHex(brand.secondaryColor || "#EEF2FF", 0.2),
    footerTextColor: "#4B5563",
    noteBackground: adjustHex(brand.secondaryColor || "#EEF2FF", 0.1),
    noteBorderColor: adjustHex(brand.primaryColor || "#1E3A8A", -0.2),
    mutedText: "#4B5563",
  };

  const overrides = templateId ? templateThemes[templateId] : undefined;
  if (!overrides) {
    return base;
  }

  return {
    ...base,
    ...overrides,
    primaryColor: overrides.primaryColor || base.primaryColor,
    secondaryColor: overrides.secondaryColor || base.secondaryColor,
    headerBandColor: overrides.headerBandColor || overrides.secondaryColor || base.headerBandColor,
    tableHeaderBackground: overrides.tableHeaderBackground || base.tableHeaderBackground,
    tableHeaderTextColor: overrides.tableHeaderTextColor || base.tableHeaderTextColor,
    zebraRowColor: overrides.zebraRowColor || base.zebraRowColor,
    totalBackground: overrides.totalBackground || base.totalBackground,
    totalTextColor: overrides.totalTextColor || base.totalTextColor,
    footerBackground: overrides.footerBackground ?? base.footerBackground,
    footerTextColor: overrides.footerTextColor || base.footerTextColor,
    headerTextColor: overrides.headerTextColor || base.headerTextColor,
    headerAccentColor: overrides.headerAccentColor || base.headerAccentColor,
    headerOverlayColor: overrides.headerOverlayColor || base.headerOverlayColor,
    badgeBackground: overrides.badgeBackground || base.badgeBackground,
    badgeTextColor: overrides.badgeTextColor || base.badgeTextColor,
  };
};

export const extractLines = (value?: string | null) =>
  (value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

export const resolveThankYou = (brand: ThemeBrandProfile) => {
  const footerLines = extractLines(brand.footerText);
  const message = footerLines.length > 0 ? footerLines[0] : "Thank you for your business";
  const footerTerms = footerLines.length > 1 ? footerLines.slice(1) : [];
  const customTerms = extractLines(brand.termsConditions);
  const terms = customTerms.length > 0 ? customTerms : footerTerms.length > 0 ? footerTerms : DEFAULT_TERMS;
  return { message, terms };
};

export const resolvePaymentLines = (brand: ThemeBrandProfile) => {
  const paymentLines = extractLines(brand.paymentInfo);
  if (paymentLines.length) return paymentLines;

  const fallback = [brand.address, brand.phone, brand.email, brand.website].filter(
    (value): value is string => Boolean(value && value.trim())
  );
  return fallback.length ? fallback : ["Please contact us for payment instructions."];
};

