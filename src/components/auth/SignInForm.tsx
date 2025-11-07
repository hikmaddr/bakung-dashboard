"use client";
import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useGlobal } from "@/context/AppContext";

const SignInForm: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { refresh } = useGlobal();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Login gagal");
      const userId: number | undefined = json?.data?.id;

      // Beri sedikit jeda agar cookie benar-benar terset lalu sinkronkan store
      await new Promise((r) => setTimeout(r, 250));
      await refresh();

      // Setelah login, cek kelengkapan profil
      let incomplete = false;
      try {
        const profileRes = await fetch("/api/profile", { cache: "no-store" });
        const profileJson = await profileRes.json();
        if (profileJson?.success && profileJson?.data) {
          const d = profileJson.data as {
            firstName?: string | null;
            lastName?: string | null;
            phone?: string | null;
          };
          incomplete = !d?.firstName || !d?.lastName || !d?.phone;
        }
      } catch {}

      const qsRedirect = new URLSearchParams(window.location.search).get("redirect");

      if (qsRedirect) {
        router.push(qsRedirect);
        return;
      }

      // Jika profil belum lengkap → arahkan ke halaman profil.
      // Tampilkan welcome hanya sekali per user (localStorage per userId)
      if (incomplete) {
        const key = userId ? `welcome_shown:${userId}` : undefined;
        const hasShown = key ? typeof window !== "undefined" && localStorage.getItem(key) === "1" : false;
        if (!hasShown) {
          // First login (belum pernah tampil welcome di browser ini)
          router.push("/profile?welcome=1");
        } else {
          router.push("/profile");
        }
        return;
      }

      // Jika profil lengkap → ke dashboard tanpa welcome
      router.push("/");
    } catch (err) {
      setError("Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[60vh] w-full px-4 py-8 flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
          <div className="p-6 sm:p-8">
            <div className="mb-6 text-center">
              <Link className="mb-4 inline-block" href="/">
                <Image
                  src={"/branding/logo-bakung-color-white.png"}
                  alt="Logo"
                  width={160}
                  height={30}
                  priority
                />
              </Link>
              <h2 className="text-xl font-semibold text-black dark:text-white">Masuk ke Dashboard</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Kelola penjualan, faktur, dan brand dalam satu tempat.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="mb-2.5 block font-medium text-black dark:text-white">Email</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent py-3 px-4 text-black outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:text-white dark:focus:border-primary"
                  required
                />
              </div>

              <div>
                <label className="mb-2.5 block font-medium text-black dark:text-white">Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent py-3 px-4 text-black outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:text-white dark:focus:border-primary"
                  required
                />
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 p-3 text-red-600">{error}</div>
              )}

              <Button variant="primary" size="md" type="submit" disabled={loading} className="w-full">
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Masuk...
                  </div>
                ) : (
                  "Masuk"
                )}
              </Button>

              <p className="text-center text-sm text-gray-600 dark:text-gray-400">
                Belum punya akun?{" "}
                <Link href="/signup" className="text-primary">Daftar</Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignInForm;
