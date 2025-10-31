"use client";

import React from "react";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <html>
      <body>
        <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-800">
          <div className="max-w-lg w-full rounded-xl border bg-white p-6 shadow-sm">
            <div className="mb-4">
              <h1 className="text-xl font-semibold">Terjadi Kesalahan</h1>
              <p className="text-sm text-gray-600 mt-1">
                Aplikasi mengalami error tak terduga. Anda bisa mencoba memuat ulang.
              </p>
            </div>
            <div className="rounded bg-gray-100 p-3 text-xs text-gray-700 whitespace-pre-wrap">
              {error?.message || String(error)}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => reset()}
                className="rounded px-3 py-2 bg-blue-600 text-white text-sm hover:bg-blue-700"
              >
                Muat Ulang
              </button>
              <button
                type="button"
                onClick={() => (window.location.href = "/")}
                className="rounded px-3 py-2 bg-gray-200 text-gray-800 text-sm hover:bg-gray-300"
              >
                Kembali ke Dashboard
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}

