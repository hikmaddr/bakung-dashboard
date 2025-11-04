"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// Konfigurasi timeout idle via env (client-safe NEXT_PUBLIC)
// NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES: angka menit, default 24 jam
// NEXT_PUBLIC_IDLE_CHECK_INTERVAL_MS: interval cek (ms), default 60 detik
const DEFAULT_IDLE_MINUTES = 24 * 60;
const ENV_IDLE_MINUTES = Number(process.env.NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES);
const IDLE_LIMIT_MS = (Number.isFinite(ENV_IDLE_MINUTES) && ENV_IDLE_MINUTES > 0
  ? ENV_IDLE_MINUTES
  : DEFAULT_IDLE_MINUTES) * 60 * 1000;
const CHECK_INTERVAL_MS = Number(process.env.NEXT_PUBLIC_IDLE_CHECK_INTERVAL_MS || 60_000);
const KEY = "hdp_last_activity";

export default function IdleWatcher() {
  const router = useRouter();
  const timerRef = useRef<any>(null);

  useEffect(() => {
    const now = Date.now();
    try {
      const last = Number(localStorage.getItem(KEY) || 0);
      if (!last) localStorage.setItem(KEY, String(now));
    } catch {}

    const updateActivity = () => {
      try {
        localStorage.setItem(KEY, String(Date.now()));
      } catch {}
      scheduleCheck();
    };

    const scheduleCheck = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        try {
          const last = Number(localStorage.getItem(KEY) || 0);
          const idleMs = Date.now() - last;
          if (idleMs >= IDLE_LIMIT_MS) {
            await fetch("/api/auth/logout", { method: "POST" });
            router.push("/signin");
            return;
          }
        } catch {}
        scheduleCheck();
      }, CHECK_INTERVAL_MS); // interval cek
    };

    const listeners: Array<[string, any]> = [
      ["mousemove", updateActivity],
      ["keydown", updateActivity],
      ["click", updateActivity],
      ["scroll", updateActivity],
      ["touchstart", updateActivity],
    ];

    listeners.forEach(([evt, fn]) => window.addEventListener(evt, fn, { passive: true }));
    scheduleCheck();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      listeners.forEach(([evt, fn]) => window.removeEventListener(evt, fn));
    };
  }, [router]);

  return null;
}
