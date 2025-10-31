import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Menunggu Persetujuan Admin | TailAdmin",
  description:
    "Halaman informasi setelah registrasi: akun sedang menunggu persetujuan admin.",
};

export default function PendingApprovalPage() {
  return (
    <div className="w-full lg:w-1/2 flex items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="p-6 sm:p-10">
          <h1 className="text-2xl font-bold text-black dark:text-white mb-3">
            Pendaftaran Berhasil
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Akun kamu telah dibuat dan saat ini <span className="font-semibold">menunggu persetujuan admin</span>.
          </p>

          <div className="space-y-3 text-gray-600 dark:text-gray-300">
            <p>
              - Kamu akan menerima notifikasi begitu akun disetujui.
            </p>
            <p>
              - Silakan tunggu dan periksa email atau notifikasi di aplikasi.
            </p>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-lg border border-stroke bg-gray-50 px-5 py-3 text-black transition hover:bg-gray-100 dark:border-strokedark dark:bg-white/5 dark:text-white"
            >
              Kembali ke Beranda
            </Link>
            <Link
              href="/signin"
              className="inline-flex items-center justify-center rounded-lg border border-primary bg-primary px-5 py-3 text-white transition hover:bg-opacity-90"
            >
              Ke Halaman Masuk
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

