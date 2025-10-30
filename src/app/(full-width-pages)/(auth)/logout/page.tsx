"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LogoutPage() {
  const router = useRouter();
  useEffect(() => {
    const run = async () => {
      try {
        await fetch("/api/auth/logout", { method: "POST" });
      } catch {}
      router.replace("/signin");
    };
    run();
  }, [router]);

  return (
    <div className="p-6">
      <p className="text-gray-600 dark:text-gray-300">Logging out...</p>
    </div>
  );
}