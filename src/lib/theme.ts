export const brandColors = {
  primary: "#4F46E5", // Indigo-600
  secondary: "#10B981", // Emerald-500
  accent: "#F59E0B", // Amber-500
};

export const statusColors: Record<string, string> = {
  // General Statuses
  draft: "bg-slate-400",
  pending: "bg-amber-500",
  processing: "bg-indigo-500",
  completed: "bg-green-500",
  confirmed: "bg-emerald-500",
  approved: "bg-emerald-500",
  issued: "bg-blue-600",

  // Payment Statuses
  paid: "bg-emerald-600",
  unpaid: "bg-gray-400",
  partially_paid: "bg-sky-500",
  overdue: "bg-orange-500",

  // Action/Negative Statuses
  rejected: "bg-rose-500",
  cancelled: "bg-rose-400", // Alias
  canceled: "bg-rose-400",
  void: "bg-neutral-600",

  // Informational
  info: "bg-blue-500",
  sent: "bg-blue-500",
};

export const statusBadgeColors: Record<string, string> = {
  draft:
    "bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-300",
  pending:
    "bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300",
  processing:
    "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300",
  completed:
    "bg-green-100 text-green-600 dark:bg-green-500/10 dark:text-green-300",
  confirmed:
    "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300",
  approved:
    "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300",
  issued:
    "bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300",
  sent: "bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300",
  paid: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300",
  partially_paid:
    "bg-sky-100 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300",
  overdue:
    "bg-orange-100 text-orange-600 dark:bg-orange-500/10 dark:text-orange-300",
  rejected:
    "bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300",
  cancelled:
    "bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300",
  canceled:
    "bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300",
  void: "bg-neutral-100 text-neutral-600 dark:bg-neutral-500/10 dark:text-neutral-300",
};

export const fonts = {
  sans: '"Outfit", sans-serif',
  serif: '"Merriweather", serif',
  mono: '"Fira Code", monospace',
};

export const spacing = {
  responsiveContainer: "max-w-[--breakpoint-2xl] mx-auto w-full",
  section: "p-4 md:p-6",
};

export const theme = {
  colors: brandColors,
  status: statusColors,
  badges: statusBadgeColors,
  fonts,
  spacing,
};

export default theme;
