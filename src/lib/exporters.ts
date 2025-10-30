// Simple client-side export helpers for CSV and XLSX
// These functions expect to be called from client components only.

export type ColumnDef<T = any> = { key: keyof T | string; label: string };

function toCSVRow(fields: string[]): string {
  return fields
    .map((f) => {
      const s = f ?? "";
      // Escape quotes and wrap if contains comma, quote, or newline
      const needsWrap = /[",\n\r]/.test(s);
      const escaped = String(s).replace(/"/g, '""');
      return needsWrap ? `"${escaped}"` : escaped;
    })
    .join(",");
}

export function downloadCSV<T = any>(
  rows: T[],
  filename = "export.csv",
  columns?: ColumnDef<T>[]
) {
  if (!Array.isArray(rows) || rows.length === 0) {
    // No-op if nothing to export
    return;
  }

  const cols: ColumnDef<T>[] = columns ||
    Object.keys(rows[0] as any).map((k) => ({ key: k, label: String(k) }));

  const header = toCSVRow(cols.map((c) => c.label));
  const body = rows
    .map((r) => toCSVRow(cols.map((c) => {
      const key = c.key as string;
      const v = (r as any)?.[key];
      if (v == null) return "";
      if (typeof v === "number") return String(v);
      if (v instanceof Date) return v.toISOString();
      if (typeof v === "object") return JSON.stringify(v);
      return String(v);
    })))
    .join("\n");

  const csv = `${header}\n${body}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function downloadXLSX<T = any>(
  rows: T[],
  filename = "export.xlsx",
  sheetName = "Data"
) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return;
  }
  const XLSXModule = await import("xlsx");
  const XLSX = XLSXModule.default ?? XLSXModule;
  const ws = XLSX.utils.json_to_sheet(rows as any);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const outName = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  XLSX.writeFile(wb, outName);
}
