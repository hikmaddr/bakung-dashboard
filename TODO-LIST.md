# 🧾 BAKUNG DASHBOARD – IMPLEMENTATION TODO LIST (POLISH & APPLY FOCUS)

## 🧭 A. CORE ARCHITECTURE
- [x] Pisahkan business logic ke folder `/services` (salesService, purchaseService, stockService, dll).
  - Tambah `src/services/salesService.ts`: normalisasi item, perhitungan total, create order, upsert dari quotation (SO & Invoice).
  - Refactor API: `sales-orders` POST, `convert-to-so`, `convert-to-invoice` → gunakan service.
  - Tambah stub `src/services/purchaseService.ts` dan `src/services/stockService.ts` untuk pondasi PO & stok.
 - [x] Tambahkan `multi-tenant middleware` untuk validasi `brandProfileId` di semua API.
   - Middleware memanggil `GET /api/auth/brand-access-check` dan menyuntikkan header `x-allowed-brand-ids` dan `x-active-brand-id` ke request.
   - API `brand-access-check` kini mengembalikan `{ allowedBrandIds, activeBrandId }` agar route lain dapat memanfaatkan scope tanpa query ulang.
   - Helper `resolveAllowedBrandIds` membaca header injeksi sebagai fast-path, fallback ke DB bila header tidak ada.
- [x] Gunakan global store Zustand untuk brand & user session agar tidak hilang di navigasi.
  - Tambah `src/store/useSessionStore.ts` untuk menyimpan `user`, `activeBrandId`, `loading` + actions (`hydrate`, `setActiveBrandId`, dll).
  - Refactor `src/context/AppContext.tsx` agar memakai store dan tetap expose `useGlobal` API yang sama.
  - `GlobalProvider` melakukan `hydrate()` sekali saat mount; `refresh()` memanggil `hydrate()` ulang.
  - Persist store session dengan Zustand `persist` + `sessionStorage` (hanya `activeBrandId` dan `user`). Rehydrate non-blocking; `AppContext` tetap memanggil `hydrate()` untuk sinkronisasi server.
- [x] Tambahkan `activity_log` model di Prisma untuk mencatat semua aksi penting (login, edit, delete, approve).
  - Model `ActivityLog` dan `LoginLog` sudah ada di `prisma/schema.prisma`.
  - Utility `logActivity` dan `logLogin` tersedia di `src/lib/activity.ts` (menyimpan IP dan user-agent dari request).
  - Sudah dipakai di beberapa endpoint (contoh: `src/app/api/expenses/route.ts`).
- [x] Implementasikan `event-driven update` antar modul (invoice paid → kwitansi otomatis).
  - API `/api/payments` otomatis: membuat `Receipt`, dan recalculates `paidAmount` + `paymentStatus` untuk `SalesOrder`/`Invoice`/`Purchase`.
  - Tambahan: log aktivitas `INVOICE_PAID` saat status invoice transisi menjadi `PAID` (metadata: invoiceNumber, amountAdded, paidAmount, total, method, receiptNumber, paidAt).
  - Tambahan: log aktivitas `INVOICE_PARTIAL` saat status invoice berubah menjadi `PARTIAL` dari status lain (metadata serupa dengan `INVOICE_PAID`).
  - Validasi overpayment di `/api/payments` (server-side):
    - `type=IN` + `refType=INVOICE`/`SALES_ORDER` → tolak jika `amount` > sisa tagihan.
    - `type=OUT` + `refType=PURCHASE` → tolak jika `amount` > sisa tagihan.
    - Gunakan toleransi `±0.0001` untuk menghindari rounding issue.
- [x] Refactor soft delete (`isDeleted` flag) agar aktif di semua model penting.
  - Skema Prisma: tambahkan `isDeleted Boolean @default(false)` + index pada model inti (Customer, Quotation, SalesOrder, Invoice, Product, PurchaseDirect, SignatureProfile).
  - Endpoint DELETE diubah menjadi soft delete:
    - `/api/quotations/[id]`: set `isDeleted=true`, `deletedAt=now`, log `QUOTATION_DELETE_SOFT`.
    - `/api/sales-orders/[id]`: set `isDeleted=true`, `deletedAt=now`, log `SALES_ORDER_DELETE_SOFT`.
    - `/api/invoices/[id]`: set `isDeleted=true` selain `deletedAt` yang sudah ada.
    - `/api/products/[id]`: set `isDeleted=true`, `deletedAt=now`.
    - `/api/purchases/direct/[id]`: set `isDeleted=true`, `deletedAt=now`, tanpa rollback stok (data tetap utuh untuk audit).
    - `/api/customers/[id]`: set `isDeleted=true` selain `deletedAt` yang sudah ada.
    - `/api/signature-profiles`: set `isDeleted=true` selain `deletedAt` yang sudah ada.
  - Catatan lanjutan: tambahkan default filter `isDeleted=false` di semua list/query agar konsisten dan tambahkan helper `safeDelete()` untuk reuse.
- [x] Perkuat generator nomor dokumen per brand (format konsisten + prefix brand code).
  - Enforce prefix kode brand jika format tidak menyertakan `{BRAND}`.
  - Ganti generator acak di API: convert-to-invoice, convert-to-so, sales-orders POST → gunakan `generateNextNumber`.
  - Hitung sequence per brand per periode prefix (YYYY/MM/ROMAN) agar reset alami.

## 🧩 B. DATABASE & BACKEND
- [x] Tambahkan indexing di `clientId`, `brandProfileId`, `date`, `status` untuk query cepat.
  - Tambah index: `Quotation(date,status)`, `SalesOrder(date,status,paymentStatus)`, `Invoice(issueDate,status,paymentStatus)`, `PurchaseDirect(date,status,paymentStatus)`, `PurchaseInvoice(date,status)`, `PaymentIn(paidAt,status)`, `PaymentOut(paidAt,status)`, `Expense(paidAt)`.
  - Index customer/client sudah ada: `Quotation.customerId`, `SalesOrder.customerId`, `Invoice.customerId`.
  - Jalankan migrasi Prisma untuk menerapkan index di DB produksi.
- [ ] Tambahkan default filter `isDeleted=false` di semua query Prisma.
- [ ] Revisi relasi `Quotation → Invoice` menjadi 1:N.
- [ ] Implementasikan `safeDelete()` helper untuk logical delete.
- [x] Tambahkan migrasi otomatis via `prisma migrate` agar schema versioned.
- [ ] Siapkan cron backup (weekly TiDB export → blob).

## 🎨 C. UI / UX POLISH
- [x] Buat file `/lib/theme.ts` berisi token global (warna utama, warna status, font, spacing).
- [x] Tambahkan `toast provider` global untuk feedback aksi (save, delete, error).
- [x] Tambahkan `skeleton loader` di tabel & detail view.
- [x] Tambahkan `empty state` dengan CTA “Buat Data Pertama”.
- [x] Buat `ModalConfirmation` reusable component untuk aksi delete/edit penting.
- [x] Terapkan `ModalConfirmation` di Invoice (hapus/pulihkan), Sales Order list & detail (hapus), Client List (hapus).
- [x] Tambahkan `badge status` untuk Quotation, Invoice, Kwitansi (`Paid`, `Pending`, `Overdue`).
- [x] Tambahkan `responsive padding/grid` agar UI tetap rapi di mobile/tablet.
  - Utility baru: `container-responsive`, `section-spacing`, `grid-responsive` di `globals.css`.
  - Layout global membungkus `children` dengan `container-responsive section-spacing` untuk padding konsisten.
 - [x] Gunakan `lucide-react` icons konsisten di semua modul.
   - [x] Migrasi ikon AppSidebar ke `lucide-react` (ganti custom `@/icons`).
- [x] Tambahkan `nprogress` bar saat halaman berganti.
 - [x] Gunakan `framer-motion` untuk transisi halus antar halaman dan modal.
   - [x] Tambahkan transisi halaman via wrapper di `app/(admin)/layout.tsx`.
   - [x] Tambahkan animasi overlay dan konten untuk `components/ui/modal`.

## ✅ H. VERIFIKASI UI
- [ ] Pratinjau aplikasi dan verifikasi ikon serta animasi di halaman utama dan Kwitansi.

## ⚡ D. PERFORMANCE & OPTIMIZATION
- [x] Aktifkan ISR (`export const revalidate = 60`) di halaman list dan laporan.
- [x] Tambahkan file `vercel.json` → set `"region": "sin1"` untuk latency lebih rendah.
- [x] Gunakan caching untuk summary dashboard (`unstable_cache`).
- [x] Kompres gambar & preload font untuk meningkatkan LCP.
 - [x] Tambahkan memoization (`useMemo`, `useCallback`) untuk tabel berat.
- [x] Tambahkan `Vercel Analytics` untuk monitoring performa.

## 🔒 E. SECURITY & ACCESS
- [x] Hash password dengan `bcrypt` di backend.
- [x] Implementasi auto logout setelah 24 jam idle.
- [x] Tambahkan halaman `/waiting-approval` untuk user baru.
 - [x] Tambahkan verifikasi email saat sign-up.
- [x] Tambahkan halaman `/403` (Akses Ditolak) dan `/404` (Tidak Ditemukan) dengan CTA kembali.
- [x] Catat login/logout ke `activity_log`.

## 🧱 F. SYSTEM & MAINTAINABILITY
- [ ] Buat dokumentasi API Postman JSON.
- [ ] Siapkan basic unit test (`vitest`) untuk fungsi create/update/delete.
- [ ] Buat footer kecil dengan “Version x.x.x — Last Updated [tanggal]”.
- [ ] Tambahkan changelog.txt untuk tiap batch update.
- [ ] Dokumentasikan struktur folder dan dependensi di `/docs/architecture.md`.

## 📡 G. AUTOMATION & INTEGRATION
- [ ] Perpendek URL Blob PDF menjadi shortlink `/s/[slug]`.
- [ ] Buat webhook mini untuk event otomatis (invoice paid → kwitansi dibuat).
- [ ] Tambahkan export PDF/Excel di modul laporan.
- [ ] Integrasi pembayaran via bukti transfer manual.

## 📅 H. PRIORITAS EKSEKUSI
| Sprint | Fokus | Output |
|:--:|:--|:--|
| **Sprint 1** | Core Security & Role Guard | Middleware, bcrypt, waiting page |
| **Sprint 2** | UX Feedback Layer | Toast, skeleton, modal, nprogress |
| **Sprint 3** | Brand Scope Logic | Branching Creative vs Procurement |
| **Sprint 4** | PDF + WhatsApp Integration | Shortlink + auto message |
| **Sprint 5** | Performance Optimization | ISR, caching, lazyload |
| **Sprint 6** | Docs & Versioning | README, License, Architecture Docs |
