// Simple Indonesian number to words (terbilang) for IDR amounts
// Covers up to triliun for common business cases

const LESS_THAN_TWENTY = [
  "",
  "Satu",
  "Dua",
  "Tiga",
  "Empat",
  "Lima",
  "Enam",
  "Tujuh",
  "Delapan",
  "Sembilan",
  "Sepuluh",
  "Sebelas",
  "Dua Belas",
  "Tiga Belas",
  "Empat Belas",
  "Lima Belas",
  "Enam Belas",
  "Tujuh Belas",
  "Delapan Belas",
  "Sembilan Belas",
];

function chunkToWords(n: number): string {
  let words = "";
  if (n >= 100) {
    const hundreds = Math.floor(n / 100);
    words += hundreds === 1 ? "Seratus" : `${LESS_THAN_TWENTY[hundreds]} Ratus`;
    n = n % 100;
    if (n) words += " ";
  }
  if (n >= 20) {
    const tens = Math.floor(n / 10);
    words += `${LESS_THAN_TWENTY[tens]} Puluh`;
    n = n % 10;
    if (n) words += " ";
  }
  if (n > 0 && n < 20) {
    if (n < LESS_THAN_TWENTY.length) words += LESS_THAN_TWENTY[n];
  }
  return words.trim();
}

export function terbilang(n: number): string {
  if (!Number.isFinite(n)) return "";
  if (n === 0) return "Nol";

  const UNITS: [number, string][] = [
    [1_000_000_000_000, "Triliun"],
    [1_000_000_000, "Miliar"],
    [1_000_000, "Juta"],
    [1_000, "Ribu"],
  ];

  let abs = Math.floor(Math.abs(n));
  let result: string[] = [];

  for (const [value, label] of UNITS) {
    if (abs >= value) {
      const count = Math.floor(abs / value);
      if (value === 1_000 && count === 1) result.push("Seribu");
      else result.push(`${terbilang(count)} ${label}`.trim());
      abs = abs % value;
    }
  }

  if (abs > 0) result.push(chunkToWords(abs));
  return (n < 0 ? "Minus " : "") + result.join(" ").replace(/\s+/g, " ").trim();
}

export function terbilangRupiah(n: number): string {
  return `${terbilang(n)} Rupiah`;
}

