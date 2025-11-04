"use client";

import { Badge } from "@/components/ui/badge";

export type DocStatus = "Draft" | "Final" | "Approved" | "Declined" | "Canceled" | "Sent";

type DocumentStatusBadgeProps = {
  status: DocStatus;
  className?: string;
};

const styles: Record<DocStatus, string> = {
  Draft: "bg-gray-100 text-gray-700",
  Final: "bg-indigo-100 text-indigo-700",
  Approved: "bg-emerald-100 text-emerald-700",
  Declined: "bg-rose-100 text-rose-700",
  Canceled: "bg-neutral-200 text-neutral-700",
  Sent: "bg-blue-100 text-blue-700",
};

export function DocumentStatusBadge({ status, className }: DocumentStatusBadgeProps) {
  const style = styles[status] || styles.Draft;
  return (
    <Badge variant="secondary" className={`px-3 py-1 text-xs font-medium ${style} ${className || ""}`}>
      {status}
    </Badge>
  );
}
