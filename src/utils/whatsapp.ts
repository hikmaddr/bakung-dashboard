export function normalizeIndoPhone(phoneRaw: string | null | undefined): string {
  if (!phoneRaw) return "";
  const digits = String(phoneRaw).replace(/[^0-9+]/g, "");
  if (digits.startsWith("+")) return digits.replace(/^\+/, "");
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  return digits;
}

export function buildWhatsAppLink(message: string, phone?: string | null): string {
  const encoded = encodeURIComponent(message);
  const normalized = normalizeIndoPhone(phone || "");
  return normalized ? `https://wa.me/${normalized}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}

