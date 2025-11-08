"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGlobal } from "@/context/AppContext";

type Props = {
  roles?: string[];
  children: React.ReactNode;
};

export default function RoleGuard({ roles, children }: Props) {
  const router = useRouter();
  const { user, loading } = useGlobal();
  const [status, setStatus] = useState<"checking" | "allowed">("checking");

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!user) {
      setStatus("checking");
      router.push("/signin");
      return;
    }
    if (user.isActive === false) {
      setStatus("checking");
      router.push("/waiting-approval");
      return;
    }
    if (roles && roles.length > 0) {
      const want = roles.map((r) => r.toLowerCase());
      const have = (user.roles || []).map((r) => r.toLowerCase());
      const ok = want.some((r) => have.includes(r));
      if (!ok) {
        setStatus("checking");
        router.push("/403");
        return;
      }
    }
    setStatus("allowed");
  }, [loading, user, roles, router]);

  if (status !== "allowed") {
    return <div>Loading...</div>;
  }
  return <>{children}</>;
}
