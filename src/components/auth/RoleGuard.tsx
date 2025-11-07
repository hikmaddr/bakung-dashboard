"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  roles?: string[];
  children: React.ReactNode;
};

export default function RoleGuard({ roles, children }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/profile", { cache: "no-store" });
        if (res.status === 401) {
          router.push("/signin");
          return;
        }
        const json = await res.json().catch(() => null);
        const data = json?.data;
        if (!data) {
          router.push("/signin");
          return;
        }
        const isActive = Boolean(data.isActive);
        const roleNames: string[] = Array.isArray(data.roles) ? data.roles : [];
        if (!isActive) {
          router.push("/waiting-approval");
          return;
        }
        if (roles && roles.length > 0) {
          const want = roles.map((r) => r.toLowerCase());
          const have = roleNames.map((r) => r.toLowerCase());
          const ok = want.some((r) => have.includes(r));
          if (!ok) {
            router.push("/403");
            return;
          }
        }
        if (!cancelled) {
          setAllowed(true);
        }
      } catch {
        router.push("/signin");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, roles]);

  if (loading) return <div>Loading...</div>;
  if (!allowed) return null;
  return <>{children}</>;
}

