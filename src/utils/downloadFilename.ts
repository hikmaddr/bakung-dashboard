const sanitizeSegment = (value: unknown) =>
  String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\\:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();

export const formatDownloadFileName = (
  numberValue: string | null | undefined,
  customerValue: string | null | undefined,
  fallbackNumber: string,
  fallbackCustomer = "Customer"
) => {
  const numberPart = sanitizeSegment(numberValue) || sanitizeSegment(fallbackNumber) || "Dokumen";
  const customerPart =
    sanitizeSegment(customerValue) || sanitizeSegment(fallbackCustomer) || "Customer";
  const normalizedNumber = numberPart.replace(/-+/g, "/").replace(/\s*\/\s*/g, "/");
  return `${normalizedNumber} - ${customerPart}.pdf`;
};
