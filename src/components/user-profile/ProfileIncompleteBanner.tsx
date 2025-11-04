"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function ProfileIncompleteBanner() {
  const [incomplete, setIncomplete] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/profile", { cache: "no-store" });
        const json = await res.json();
        if (!cancelled && json?.success && json?.data) {
          const d = json.data as { firstName?: string | null; lastName?: string | null; phone?: string | null };
          const inc = !d?.firstName || !d?.lastName || !d?.phone;
          setIncomplete(inc);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  if (!incomplete) return null;

  return (
    <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">Profil Anda belum lengkap</p>
          <p className="text-sm opacity-90">Lengkapi Nama Depan, Nama Belakang, dan Nomor Telepon agar fitur berjalan optimal.</p>
        </div>
        <button
          onClick={() => router.push("/profile")}
          className="shrink-0 rounded-md bg-amber-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-600"
        >
          Lengkapi Sekarang
        </button>
      </div>
    </div>
  );
}

