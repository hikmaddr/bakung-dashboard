"use client";

import Link from "next/link";

export default function Error403Page() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-xl w-full border rounded-md bg-white shadow-sm p-8 text-center">
        <div className="text-5xl mb-4">🔒</div>
        <h1 className="text-2xl font-semibold mb-2">Akses Ditolak (403)</h1>
        <p className="text-gray-600 mb-6">
          Anda tidak memiliki izin untuk membuka halaman ini. Jika ini kesalahan, silakan hubungi Owner.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/" className="inline-flex h-9 items-center px-4 rounded-md bg-primary text-white hover:opacity-90">
            Kembali ke Dashboard
          </Link>
          <Link href="/system-user/activity-log" className="inline-flex h-9 items-center px-4 rounded-md border hover:bg-gray-50">
            Lihat Activity Log
          </Link>
        </div>
      </div>
    </div>
  );
}

