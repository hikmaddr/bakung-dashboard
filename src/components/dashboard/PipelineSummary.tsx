"use client";
import React from "react";

type PipelineStatus = {
  status: string;
  label: string;
  count: number;
  percentage: number;
};

export type PipelineGroup = {
  key: string;
  title: string;
  total: number;
  statuses: PipelineStatus[];
};

interface PipelineStatusProps {
  pipeline: PipelineGroup[];
}

const STATUS_COLOR_MAP: Record<string, string> = {
  draft: "bg-slate-400",
  sent: "bg-blue-500",
  confirmed: "bg-emerald-500",
  approved: "bg-emerald-500",
  rejected: "bg-rose-500",
  cancelled: "bg-rose-400",
  canceled: "bg-rose-400",
  pending: "bg-amber-500",
  processing: "bg-indigo-500",
  completed: "bg-green-500",
  paid: "bg-emerald-600",
  overdue: "bg-orange-500",
  partially_paid: "bg-sky-500",
  issued: "bg-blue-600",
};

const FALLBACK_COLORS = [
  "bg-indigo-500",
  "bg-sky-500",
  "bg-teal-500",
  "bg-fuchsia-500",
  "bg-amber-500",
  "bg-purple-500",
];

function normalizeStatus(status: string) {
  return (status ?? "unknown").toLowerCase().replace(/\s+/g, "_");
}

function getStatusColorClass(status: string, index: number) {
  const normalized = normalizeStatus(status);
  return STATUS_COLOR_MAP[normalized] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

export const PipelineSummary: React.FC<PipelineStatusProps> = ({ pipeline }) => {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">Status Pipeline</h2>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Distribusi status dokumen transaksi</p>

      <div className="mt-8 space-y-8">
        {pipeline.map((group) => (
          <div key={group.key}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">{group.title}</h3>
              <span className="text-xs text-gray-500">{group.total} total</span>
            </div>
            <div className="h-2 w-full flex overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
              {group.statuses.map((item, idx) => (
                <div
                  key={item.status}
                  className={`h-full transition-all ${getStatusColorClass(item.status, idx)}`}
                  style={{ width: `${item.percentage}%` }}
                  title={`${item.label}: ${item.count} (${item.percentage}%)`}
                />
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
              {group.statuses.slice(0, 4).map((item, idx) => (
                <div key={item.status} className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${getStatusColorClass(item.status, idx)}`} />
                  <span className="text-xs text-gray-600 dark:text-gray-400 truncate">
                    {item.label} ({item.count})
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
