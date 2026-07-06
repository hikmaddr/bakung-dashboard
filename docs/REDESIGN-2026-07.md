# Redesign & Deploy — Juli 2026

## Ringkasan Pemahaman
- Redesign visual seluruh app + 5 template PDF (invoice, quotation, SO, delivery, receipt) dengan satu design language, gaya modern & profesional.
- Dashboard diprioritaskan untuk: (1) pipeline & aktivitas yang butuh tindak lanjut, (2) cash flow & piutang.
- Constraints: dark mode tetap jalan, PDF ikut warna brand aktif, route/navigasi tidak berubah.
- Database: Neon (fresh, tanpa data penting) — bukan migrasi data, cukup sinkronisasi schema.
- Vercel: project lama sudah terhapus — deploy ulang sebagai project baru.

## Decision Log
| Keputusan | Alternatif | Alasan |
|---|---|---|
| Deploy dulu, redesign kemudian (satu commit) | Redesign dulu | Vercel deploy via git import butuh aksi user sekali; digabung agar sekali jalan |
| `prisma db push` di vercel-build | `migrate deploy` | Migrations folder tidak lengkap (username, isDP dll tidak ada di migrasi); DB fresh sehingga db push aman |
| `postinstall: prisma generate` | generate manual | Standar Vercel + memperbaiki 9 type error client basi |
| Redesign PDF via `pdfCommon.ts` | Rewrite tiap route | 4 dari 5 dokumen pakai helper common; perubahan satu titik, konsisten, risiko rendah |
| ActionCenter + ReceivablesCard komponen baru | Ubah MetricCards | Pisahkan "butuh tindakan" dari metrik finansial agar dashboard lebih actionable |
| `outputFileTracingIncludes` untuk public/fonts & images | Pindah font ke assets import | Fix minimal agar fs.readFile PDF jalan di serverless |

## Perubahan UI
- **Dashboard**: strip "Perlu Tindakan" (approval, jatuh tempo, pengiriman, penerimaan) dengan aksen urgensi; 4 kartu finansial (SO Revenue, Invoice, Net Margin, Quotation); kartu baru "Piutang & Kas Masuk" dengan aging tunggakan (1–30/31–60/>60 hari).
- **Tema**: menu sidebar dengan gradient aktif + ring; header glassmorphism (backdrop-blur); ComponentCard dengan shadow halus.
- **PDF (semua dokumen)**: accent bar dua-tone warna brand di tepi atas; judul dokumen dalam chip berwarna; panel From/Bill-To berlatar lembut dengan aksen kiri; separator dua-tone.

## Perbaikan Bug (ditemukan saat type-check)
- `suppliers/[id]`: GET/PUT/DELETE membaca `id` dari context yang salah — selalu NaN (rusak di runtime). Diperbaiki pakai `params.id`.
- `invoices/[id]/pdf`: referensi `auth` yang tidak ada → `authTop`.
- `quotations/[id]/pdf`: `totalAmount` tidak di-select dari Prisma.
- `documentNumber`: tipe `deliveryOrder` tidak terdaftar (dipakai salesService & sales-orders route) → nomor DO gagal digenerate. Ditambahkan (`DO-{YYYY}-{MM}-{SEQ4}`, field `doNumber`).
- `purchaseService`: `supplierName` null-safety.
- Union type action quotation detail (+approve/reject), implicit any di AppSidebar/AppContext.

## Deploy
Lihat `docs/DEPLOYMENT.md`.
