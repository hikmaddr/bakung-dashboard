"use client";

import { Badge } from "@/components/ui/badge";

type StatusKind = "Paid" | "Pending" | "Overdue" | "Draft" | "Sent" | "Canceled" | "Partial" | "Confirmed" | "Converted";

type StatusBadgeProps = {
  status: StatusKind;
  className?: string;
};

const styles: Record<StatusKind, string> = {
  Paid: "bg-emerald-100 text-emerald-700",
  Pending: "bg-amber-100 text-amber-700",
  Overdue: "bg-rose-100 text-rose-700",
  Draft: "bg-gray-100 text-gray-700",
  Sent: "bg-blue-100 text-blue-700",
  Canceled: "bg-neutral-200 text-neutral-700",
  Partial: "bg-sky-100 text-sky-700",
  Confirmed: "bg-green-100 text-green-700",
  Converted: "bg-blue-100 text-blue-700",
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const style = styles[status] || styles.Pending;
  return (
    <Badge variant="secondary" className={`px-3 py-1 text-xs font-medium ${style} ${className || ""}`}>
      {status}
    </Badge>
  );
}

export function getInvoiceStatusLabel(row: { status?: string | null; dueDate?: string | null; downPayment?: number | null; total?: number | null }) {
  const statusRaw = String(row.status || "").trim().toLowerCase();
  const paid = Number(row.downPayment || 0);
  const total = Number(row.total || 0);

  // Direct mapping for explicit statuses
  if (statusRaw === "paid") return "Paid" as const;
  if (statusRaw === "canceled" || statusRaw === "cancelled") return "Canceled" as const;
  if (statusRaw === "sent") return "Sent" as const;

  // Amount-based evaluation
  if (total > 0) {
    if (paid >= total) return "Paid" as const;
    if (paid > 0 && paid < total) return "Partial" as const;
  }

  // Time-based evaluation
  const dueDate = row.dueDate ? new Date(row.dueDate) : null;
  const now = new Date();
  if (dueDate && dueDate < now) return "Overdue" as const;

  // Default
  return "Pending" as const;
}

// Quotation: derive Paid/Pending/Overdue with simple, predictable rules
// - If explicit status is paid -> Paid
// - If converted (hasInvoice/hasSalesOrder) -> Converted
// - If validUntil is in the past -> Overdue
// - Else -> Pending
export function getQuotationStatusLabel(row: {
  status?: string | null;
  validUntil?: string | Date | null;
  hasInvoice?: boolean | null;
  hasSalesOrder?: boolean | null;
}) {
  const statusRaw = String(row.status || "").trim().toLowerCase();
  if (statusRaw === "paid") return "Paid" as const;

  const converted = Boolean(row.hasInvoice) || Boolean(row.hasSalesOrder);
  if (converted) return "Converted" as const;

  const vu = row.validUntil ? new Date(row.validUntil as any) : null;
  const now = new Date();
  if (vu && !Number.isNaN(vu.getTime()) && vu < now) return "Overdue" as const;

  return "Pending" as const;
}

