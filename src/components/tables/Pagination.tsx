"use client";

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  limit: number;
  onLimitChange: (limit: number) => void;
  limitOptions?: number[];
};

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  limit,
  onLimitChange,
  limitOptions = [5, 10, 50, 100],
}: PaginationProps) {
  // ambil halaman sekitar current (max 3 button ditampilkan)
  const pagesAroundCurrent = Array.from(
    { length: Math.min(3, totalPages) },
    (_, i) => i + Math.max(currentPage - 1, 1)
  );

  return (
    <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      {/* 🔸 Dropdown limit per page */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-600 dark:text-gray-400">
          Preview
        </label>
        <select
          value={limit}
          onChange={(e) => {
            onPageChange(1);
            onLimitChange(Number(e.target.value));
          }}
          className="h-10 rounded-lg border border-gray-300 bg-transparent px-3 py-1.5 text-sm text-gray-800 shadow-sm focus:border-brand-300 focus:ring-brand-500/10 focus:ring-2 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
        >
          {limitOptions.map((opt) => (
            <option key={opt} value={opt} className="dark:bg-gray-900">
              {opt}
            </option>
          ))}
        </select>
      </div>

      {/* 🔹 Pagination buttons */}
      <div className="flex items-center gap-2">
        {/* Previous */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={`h-10 rounded-lg border px-3.5 py-2.5 text-sm shadow-sm transition-colors ${
            currentPage === 1
              ? "cursor-not-allowed border-gray-300 text-gray-400 dark:border-gray-700 dark:text-gray-600"
              : "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
          }`}
        >
          Previous
        </button>

        {/* Numbered Buttons */}
        {currentPage > 3 && <span className="px-1 text-gray-500">...</span>}
        {pagesAroundCurrent.map((page) => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`flex h-10 w-10 items-center justify-center rounded-lg border text-sm font-medium transition-colors
              ${
                page === currentPage
                  ? "border-brand-500 bg-brand-500 text-white"
                  : "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
              }`}
          >
            {page}
          </button>
        ))}
        {currentPage < totalPages - 2 && (
          <span className="px-1 text-gray-500">...</span>
        )}

        {/* Next */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={`h-10 rounded-lg border px-3.5 py-2.5 text-sm shadow-sm transition-colors ${
            currentPage === totalPages
              ? "cursor-not-allowed border-gray-300 text-gray-400 dark:border-gray-700 dark:text-gray-600"
              : "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
          }`}
        >
          Next
        </button>
      </div>
    </div>
  );
}
