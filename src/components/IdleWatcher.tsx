"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// Auto-logout after 24 hours (in ms)
const IDLE_LIMIT_MS = 24 * 60 * 60 * 1000;
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
      }, 60 * 1000); // check every minute
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

