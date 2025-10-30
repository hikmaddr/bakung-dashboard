"use client";

import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { AtSign, Phone } from "lucide-react";

/** Helper kecil untuk “card/section” agar seragam */
function FormCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
      <h4 className="mb-4 text-base font-semibold">{title}</h4>
      {children}
    </section>
  );
}

export default function AddClientPage() {
  const router = useRouter();
  // use global Toaster (toast.*)

  const [pic, setPic] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // normalisasi dan validasi sederhana
    const normalizePhone = (raw: string) => {
      let digits = (raw || "").replace(/\D/g, "");
      if (digits.startsWith("620")) digits = "62" + digits.slice(3);
      if (digits.startsWith("0")) digits = "62" + digits.slice(1);
      if (!digits.startsWith("62")) digits = "62" + digits;
      return digits;
    };
    if (!pic || !company || !address || !phone) {
      toast.error("Harap isi semua data wajib (PIC, Perusahaan, Alamat, No HP)");
      return;
    }
    const normalizedPhone = normalizePhone(phone);

    setLoading(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pic,
          email: email || null,
          company,
          address,
          phone: normalizedPhone,
        }),
      });
      if (!res.ok) throw new Error("Gagal menambahkan client");
      toast.success("Client berhasil ditambahkan.");
      router.push("/client/list");
    } catch (err) {
      console.error(err);
      toast.error("Terjadi kesalahan saat menyimpan data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Breadcrumb (pola template) */}
      <PageBreadcrumb pageTitle="Tambah Client" />

      {/* GRID 2 kolom ala Form Elements */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 xl:grid-cols-2" item-stretch>
        {/* Kolom kiri */}
        <FormCard title="Detail Client">
          <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">PIC *</label>
            <input
              type="text"
              value={pic}
              onChange={(e) => setPic(e.target.value)}
              className="dark:bg-dark-900 shadow-theme-xs focus:border-brand-300 focus:ring-brand-500/10 dark:focus:border-brand-800 h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:ring-3 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30"
              placeholder="Nama PIC"
            />
          </div>


            <div>
              <label className="mb-1 block text-sm font-medium">Perusahaan *</label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="dark:bg-dark-900 shadow-theme-xs focus:border-brand-300 focus:ring-brand-500/10 dark:focus:border-brand-800 h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:ring-3 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30"
                placeholder="Nama Perusahaan"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Alamat *</label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                 className="dark:bg-dark-900 shadow-theme-xs focus:border-brand-300 focus:ring-brand-500/10 dark:focus:border-brand-800 h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:ring-3 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30"
                rows={4}
                placeholder="Alamat perusahaan"
              />
            </div>
          </div>
        </FormCard>

        {/* Kolom kanan */}
        <div className="space-y-6">
          <FormCard title="Contact Person">
            <div className="space-y-4">
              {/* Email dengan ikon kiri (mirip demo) */}
              <div>
                <label className="mb-1 block text-sm font-medium">Email</label>
                <div className="relative">
                  <AtSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                     className="dark:bg-dark-900 shadow-theme-xs focus:border-brand-300 focus:ring-brand-500/10 dark:focus:border-brand-800 h-11 w-full rounded-lg border border-gray-300 bg-transparent px-8 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:ring-3 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30"
                    placeholder="info@email.com"
                  />
                </div>
              </div>

              {/* Phone dengan ikon kiri */}
              <div>
                <label className="mb-1 block text-sm font-medium">No HP *</label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="dark:bg-dark-900 shadow-theme-xs focus:border-brand-300 focus:ring-brand-500/10 dark:focus:border-brand-800 h-11 w-full rounded-lg border border-gray-300 bg-transparent px-8 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:ring-3 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30"
                    placeholder="+62 8xx xxxx xxxx"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => router.push("/client/list")}
                className="rounded-md border px-4 py-2 hover:bg-gray-100"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={loading}
                className={`rounded-md px-4 py-2 text-white ${
                  loading
                    ? "cursor-not-allowed bg-blue-400"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {loading ? "Menyimpan..." : "Simpan"}
              </button>
              
            </div>
          </FormCard>

          {/* (Opsional) Section lain seperti File Input / Checkbox / Radio */}
          {/* Contoh File Input agar setara dengan demo */}
          {/* <FormCard title="File Input">
            <input type="file" className="w-full rounded-md border px-3 py-2" />
          </FormCard> */}
        </div>

        {/* Actions (full width) */}
      </form>
    </div>
  );
}
