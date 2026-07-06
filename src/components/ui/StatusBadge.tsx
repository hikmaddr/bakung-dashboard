"use client";

import { Badge } from "@/components/ui/badge";

type StatusKind = 
  | "Paid" | "Pending" | "Overdue" | "Draft" | "Sent" | "Canceled" | "Partial" | "Confirmed" | "Converted"
  | "Approved" | "Declined" | "Expired" | "Processing" | "Shipping" | "Delivered" | "Completed"
  | "PendingApproval" | "Ordered" | "Received"
  | "UNPAID" | "PARTIAL" | "PAID" | "VOID";

type StatusBadgeProps = {
  status: StatusKind | string;
  className?: string;
};

const styles: Record<string, string> = {
  Paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-300",
  Pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/25 dark:text-amber-300",
  Overdue: "bg-rose-100 text-rose-700 dark:bg-rose-900/25 dark:text-rose-300",
  Draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  Sent: "bg-blue-100 text-blue-700 dark:bg-blue-900/25 dark:text-blue-300",
  Canceled: "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-400",
  Partial: "bg-sky-100 text-sky-700 dark:bg-sky-900/25 dark:text-sky-300",
  Confirmed: "bg-green-100 text-green-700 dark:bg-green-900/25 dark:text-green-300",
  Converted: "bg-blue-100 text-blue-700 dark:bg-blue-900/25 dark:text-blue-300",
  Approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-300",
  Declined: "bg-rose-100 text-rose-700 dark:bg-rose-900/25 dark:text-rose-300",
  Expired: "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-400",
  Processing: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300",
  Shipping: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/25 dark:text-indigo-300",
  Delivered: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/25 dark:text-cyan-300",
  Completed: "bg-green-100 text-green-700 dark:bg-green-900/25 dark:text-green-300",
  PendingApproval: "bg-amber-100 text-amber-700 dark:bg-amber-900/25 dark:text-amber-300",
  Ordered: "bg-blue-100 text-blue-700 dark:bg-blue-900/25 dark:text-blue-300",
  Received: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-300",
  UNPAID: "bg-rose-100 text-rose-700 dark:bg-rose-900/25 dark:text-rose-300",
  PARTIAL: "bg-sky-100 text-sky-700 dark:bg-sky-900/25 dark:text-sky-300",
  PAID: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-300",
  VOID: "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-400",
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  let styleKey = status as string;
  if (typeof status === "string" && status.startsWith("Sent")) {
    styleKey = "Sent";
  }
  const style = styles[styleKey] || styles.Pending;
  return (
    <Badge variant="secondary" className={`px-3 py-1 text-xs font-medium ${style} ${className || ""}`}>
      {status}
    </Badge>
  );
}

export function getInvoiceStatusLabel(row: { status?: string | null; dueDate?: string | null; paymentStatus?: string | null }) {
  const statusRaw = String(row.status || "").trim();
  const paymentStatus = String(row.paymentStatus || "").trim();

  // If status is explicit, use it (Canceled/Draft/Paid/Sent/Overdue)
  if (["Canceled", "Draft", "Paid", "Sent", "Overdue"].includes(statusRaw)) {
    return statusRaw as any;
  }

  // Payment Status (UNPAID/PARTIAL/PAID/VOID)
  if (paymentStatus === "PAID") return "Paid";
  if (paymentStatus === "PARTIAL") return "Partial";
  if (paymentStatus === "VOID") return "Canceled";

  // Time-based evaluation for Overdue if not paid
  const dueDate = row.dueDate ? new Date(row.dueDate) : null;
  const now = new Date();
  if (dueDate && dueDate < now && paymentStatus !== "PAID") return "Overdue";

  // Fallback
  return statusRaw || "Draft";
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
  const statusRaw = String(row.status || "").trim();

  // Legacy/Derived logic
  const converted = Boolean(row.hasInvoice) || Boolean(row.hasSalesOrder);
  if (converted || statusRaw === "Converted") return "Approved";

  // Explicit status mapping
  if (["Draft", "Approved", "Declined", "Expired"].includes(statusRaw) || statusRaw.startsWith("Sent")) {
    return statusRaw as any;
  }

  const vu = row.validUntil ? new Date(row.validUntil as any) : null;
  const now = new Date();
  if (vu && !Number.isNaN(vu.getTime()) && vu < now) return "Expired";

  return statusRaw || "Draft";
}

