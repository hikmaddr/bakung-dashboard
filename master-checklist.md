# 🧭 Bakung Dashboard — Master Checklist (Final)

## **A. Tujuan & Fokus Utama**

Menyatukan gaya visual, memperkuat UX, serta menambahkan sistem interaksi dinamis:

- Multi-brand & multi-role dengan context switching  
- Flow sign-up → approval oleh Owner/Admin  
- Sistem notifikasi dan feedback waktu nyata  
- UI yang konsisten, scalable, dan profesional  

---

## 🎨 **B. Global Layout & Navigation**

### **Header / Topbar**
- [x] Tambahkan brand switcher dropdown (logo + nama brand aktif)
- [x] Tambahkan profil user (nama + role + avatar)
- [x] Tampilkan nama brand aktif di header halaman
- [x] Tambahkan breadcrumb navigation (contoh: Dashboard › Penjualan › Quotation)
- [x] Pastikan header konsisten di seluruh halaman
- [x] Tambahkan dark/light mode toggle opsional

### **Sidebar Navigation**
- [x] Gunakan ikon + label yang jelas untuk tiap menu utama
- [x] Highlight menu aktif dengan warna brand
- [x] Submenu muncul hanya saat induk dibuka (accordion style)
- [x] Tambahkan badge jumlah data penting (misal invoice belum dibayar)
- [x] Sidebar responsif & dapat collapse otomatis di layar kecil
- [x] Auto-open submenu sesuai route hanya sekali per path
- [x] Auto-open menghormati manual toggle dan tidak spam log di dev
- [x] Tombol logout & mode switch berada di posisi konsisten bawah

---

## 🧩 **C. Reusable Components & Consistency**

### **Buttons & Inputs**
- [x] Standarisasi ukuran (`sm`, `md`, `lg`) dan warna (`primary`, `secondary`, `danger`, `ghost`)
- [x] Tambahkan state visual (hover, active, disabled, loading)
- [x] Gunakan komponen form reusable (`FormField`, `Input`, `Select`, `TextArea`)
- [x] Tombol utama selalu pakai warna primary brand aktif

### **Modal & Dialog**
- [x] Struktur konsisten (`ModalHeader`, `ModalBody`, `ModalFooter`)
- [x] Animasi muncul halus (fade/scale)
- [x] Modal konfirmasi untuk aksi hapus/edit penting
- [x] Modal sukses/error global untuk feedback sistem

### **Table & Data View**
- [x] Header tabel konsisten & readable
- [ ] Tambahkan sorting, filter cepat, dan pagination
- [x] Hover effect dan ikon aksi (👁️ lihat, ✏️ edit, 🗑️ hapus)
- [x] Warna label status konsisten (Hijau = sukses, Kuning = pending, Merah = gagal)
 - [x] Tab "Terhapus" untuk menampilkan data `deletedAt != null` (gantikan toggle)
 - [x] Aksi hapus (soft delete) via ikon 🗑️, retensi 30 hari

### **Toast & Feedback**
- [x] Gunakan toast global (success, warning, error)
- [x] Tampilkan toast untuk aksi penting (simpan, hapus, upload, approve user)
 - [x] Gunakan NProgress bar di top header saat halaman memuat
 - [x] Tambahkan skeleton UI saat data loading

---

## 🧭 **D. UX & Multi-Brand Context**

### **Brand Context (Flow & API)**
- [x] Modal pilih brand aktif saat login bila user memiliki >1 brand yang diizinkan
  - Sumber data: `GET /api/brand-profiles` (kembalikan hanya brand yang diizinkan; guard server via `resolveAllowedBrandIds`/`brandScopeWhere`)
  - Fallback: jika hanya 1 brand diizinkan → auto-select tanpa modal
  - Fallback: jika tidak ada brand diizinkan → tampilkan EmptyState + kontak admin
- [x] Simpan pilihan brand aktif via `POST /api/brand-profiles/activate` (server menulis cookie `active_brand_slug` dan validasi scope)
- [x] Setelah aktifkan brand → refresh GlobalContext
  - Panggil `refresh()` dari `src/context/AppContext.tsx` untuk memperbarui `user` dan `activeBrandId` (via `GET /api/auth/brand-access-check`)
  - Re-fetch profil brand aktif: `GET /api/brand-profiles/active`
  - Emit event untuk sidebar/modules: `window.dispatchEvent(new Event('brand-modules:updated'))`
- [x] Tema UI mengikuti brand aktif
  - Set variabel CSS global: `--brand-primary`, `--brand-secondary` berdasarkan `brand.primaryColor` dan `brand.secondaryColor`
  - Terapkan ke komponen utama (button primary, link aktif, badge status, border highlight)
- [x] Logo/nama brand aktif tampil konsisten
  - Header/Sidebar: gunakan `brand.logoUrl` fallback ke inisial + warna brand
  - Dokumen PDF: gunakan profil brand aktif (lihat resolver brand di route PDF yang memanggil `getActiveBrandProfile`)

### **Role Visibility & Guards**
- [ ] Owner → akses semua brand & modul (server guard: `resolveAllowedBrandIds` mengembalikan seluruh id brand)
- [ ] Admin → akses brand tertentu (scope via tabel `userBrandScope`)
- [ ] Staff → input transaksi sesuai brand yang diizinkan
- [ ] Sidebar menyesuaikan role & modul brand aktif (lihat `AppSidebar` memuat `modules` dari brand aktif)
- [ ] Profil user menampilkan “Nama – Role” dan menyembunyikan aksi non-izin
- [ ] Jika akses tidak valid → redirect ke 403 atau tampilkan EmptyState
  - [x] Client: bungkus halaman dengan `<FeatureGuard feature="...">`
  - Server: filter `brandProfileId` menggunakan `brandScopeWhere` atau validasi `allowedBrandIds` di tiap endpoint

---

## 👥 **E. User Management & Sign-Up Flow**

### **1️⃣ Sign-Up Page (Tanpa Pilih Role)**
- [ ] Form minimal: Nama Lengkap, Email, Password, Brand (opsional)
- [ ] Setelah submit → `isActive = false`, `role = null`, `approvedBy = null`
- [ ] Redirect ke halaman *“Menunggu Persetujuan Admin”*
- [ ] Pesan: “Akun kamu sedang menunggu persetujuan Admin.”

### **2️⃣ User Approval Page (Owner/Admin Only)**
- [ ] Menu: *System & User › User Approval*
- [ ] Tabel user pending (Nama, Email, Brand Request, Tanggal, Aksi)
- [ ] Modal “Setujui & Aktifkan” → pilih Role & Brand Access
- [ ] Modal “Tolak” → alasan penolakan opsional
- [ ] Setelah approve:
  ```ts
  isActive = true
  role = "STAFF"
  brandProfileId = selectedBrand
  approvedBy = ownerId
  approvedAt = now()
   ```

---

## 🔒 **F. Backend Security & Audit**

- [x] Enforcement brand guards di API routes (scope by `brandProfileId`)
  - [x] Invoices: `GET /api/invoices`, `GET/PATCH/DELETE /api/invoices/[id]`
  - [x] Sales Orders: `POST /api/sales-orders`
  - [x] Purchases (Direct): `POST /api/purchases/direct`, `POST /api/purchases/direct/[id]/receive`
  - [x] Expenses: `GET/POST /api/expenses`
  - [x] Payments: `GET/POST /api/payments`
- [x] Hapus override paksa `brandProfileId` di Payments & Expenses
- [x] Validasi referensi lintas entitas harus sama brand (Payments refs, Expense `paymentId`)
- [x] Tambahkan ActivityLog pada create endpoints
  - [x] `SALES_ORDER_CREATE` (sales-orders)
  - [x] `INVOICE_CREATE` (invoices)
  - [x] `PURCHASE_CREATE` (purchases/direct)
  - [x] `EXPENSE_CREATE` (expenses)
  - [x] `PAYMENT_CREATE` (payments)
- [x] Cegah data lintas brand: filter query CRUD dengan `brandProfileId`
 - [x] Soft delete Invoice: set kolom `deletedAt` melalui DELETE handler
 - [x] List invoices: default filter `deletedAt = null`, dukung `includeDeleted=1`
  - [x] Purge invoice terhapus lebih dari N hari: `POST /api/invoices/purge?days=N`

---

## ⚙️ **G. Error Handling & Dev UX**

- [x] Perbaiki hydration error di `src/app/error.tsx` (hapus nested `<html>/<body>`)
 - [x] Tambah `src/app/global-error.tsx` (opsional, untuk full-page error dengan `<html>/<body>`)
- [x] Graceful fallback saat DB tidak reachable (opsional: tampilkan EmptyState, hindari crash)
- [x] Kebijakan Single Dev Server untuk mencegah konflik cache `.next`
- [x] Tambah script `dev:clean` untuk hapus cache `.next` lalu start dev

---


## 🧭 **I. Catatan Multi-Brand (UI & State)**
- [x] Brand switcher menyimpan pilihan via cookie `active_brand_slug`
- [x] State global refresh data saat brand diganti
- [x] Tema UI mengikuti brand aktif (warna, logo, template)

---

## 🛡️ **J. Roles & Permissions Matrix**

- [ ] Definisikan kapabilitas per role:
  - Owner: akses semua brand, kelola modul, approve user
  - Admin: akses brand tertentu, kelola transaksi & master data
  - Staff: input transaksi sesuai scope brand
- [x] Tabel RBAC: fitur → role yang diizinkan

RBAC Matrix (Fitur → Role yang diizinkan)

- Sales
  - Quotation: admin, owner, sales
  - Sales Order: admin, owner, sales
  - Invoice: admin, owner, finance, sales
  - Receipt: admin, owner, finance
  - Delivery: admin, owner, sales

- Purchase
  - Purchase Order: admin, owner, purchase
  - Purchase Invoice: admin, owner, finance, purchase
  - Purchase Receipt: admin, owner, finance, purchase
  - Receiving: admin, owner, warehouse, purchase

- Inventory
  - Products: admin, owner, inventory
  - Stock: admin, owner, inventory, warehouse

Catatan:
- Admin dan Owner memiliki akses penuh lintas modul.
- Role spesifik (sales, finance, purchase, inventory, warehouse) dibatasi sesuai domain tugas.
- Gate menu dan fitur mengikuti `userRoles` dari `/api/profile` dan modul aktif brand.
- [ ] Enforce RBAC di server (API) dan client (FeatureGuard)
- [ ] Dokumen alur eskalasi (approval, perubahan role)

---

## 🔧 **K. Feature Guards Mapping**
 
 - [ ] Pemetaan fitur → modul brand (contoh: `reporting.rekap`, `sales.order`, `invoice.issue`)
 - [x] Terapkan `<FeatureGuard feature="...">` pada halaman yang relevan
 - [x] Event refresh saat brand modules diubah (`brand-modules:updated`)
 - [x] Tombol/aksi disembunyikan jika modul nonaktif

---

## 📑 **L. API Contract & Validation**

- [ ] Skema payload (Quotation, Sales Order, Invoice, Payment, Expense)
- [ ] Validasi server-side: tipe data, range, enum status
- [ ] Status transition rules (draft → sent → confirmed → approved → shipped/paid)
- [ ] Brand guard di setiap endpoint (gunakan `brandScopeWhere` / `brandProfileId`)
 - [x] Health check endpoint `/api/health` (DB, env)
 - [x] Invoice soft delete: `DELETE /api/invoices/{id}` → set `deletedAt = now()`
 - [x] List invoice mendukung `includeDeleted=1` untuk menampilkan arsip
  - [x] Pulihkan invoice (unarchive) via `PATCH { deletedAt: null }` dan aksi UI
  - [x] Purge invoice terhapus lebih dari N hari: `POST /api/invoices/purge?days=N`

---

## 🔢 **M. Numbering & Templates**

- [ ] Format penomoran per brand (prefix, padding, reset period)
- [ ] Template PDF per brand (invoice, quotation, receipt)
- [ ] Preview template dan apply ke brand aktif
- [x] Footer & header dinamis (alamat, kontak, logo)

---

## ✉️ **N. Notification & Communication**

- [ ] Email notifikasi approval user (approve/deny)
- [ ] Notifikasi internal (toast + badge) untuk tunggakan & approval pending
- [ ] Webhook/Zapier opsional untuk integrasi eksternal

---

## 🚀 **O. Deployment & Backup**

- [ ] Konfigurasi environment Windows (gunakan `scripts/deploy-windows.ps1`)
  - Prasyarat: Node.js 18+, PowerShell 5+, akses internet
  - Set ExecutionPolicy: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`
  - Siapkan `.env`: `DATABASE_URL`, `JWT_SECRET`, `NEXT_PUBLIC_BASE_URL`
  - Build & start: `npm ci && npm run build && npm run start`
  - Alternatif: jalankan `scripts/deploy-windows.ps1` untuk otomatisasi
- [ ] Konfigurasi environment Ubuntu (gunakan `scripts/deploy-ubuntu.sh`)
  - Prasyarat: Ubuntu 20.04/22.04 LTS, `curl`, akses sudo, internet
  - Update sistem: `sudo apt update && sudo apt -y upgrade`
  - Install Node via NVM:
    - `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash`
    - `source ~/.nvm/nvm.sh && nvm install 18 && nvm use 18`
  - Install PM2 & deps: `npm i -g pm2 && npm ci`
  - `.env` minimal: set `DATABASE_URL`, `JWT_SECRET`, `NEXT_PUBLIC_BASE_URL`
  - Build: `npm run build`
  - Start via PM2 (pakai ecosystem): `pm2 start ecosystem.config.js --env production`
  - Persist PM2: `pm2 save && pm2 startup systemd` (ikuti instruksi yang muncul)
  - Alternatif: jalankan `bash scripts/deploy-ubuntu.sh`
- [ ] Jalankan migrasi & generate Prisma saat deploy
  - Perintah: `npx prisma generate && npx prisma migrate deploy`
  - Opsional (dev/test): `npx prisma db seed` atau `node scripts/seed-roles.js`
- [ ] PM2 process, log rotation, restart policy
  - Start: `pm2 start ecosystem.config.js --env production`
  - Lihat status: `pm2 status` · Logs: `pm2 logs --lines 100`
  - Restart & reload: `pm2 restart <name>` · Auto-start: `pm2 save && pm2 startup`
  - Log rotation (opsional): `pm2 install pm2-logrotate`
- [ ] Backup database harian, retention policy
  - Postgres (contoh):
    - Dump: `pg_dump "$DATABASE_URL" -F c -f backup_$(date +%F).dump`
    - Cron: `0 2 * * * /usr/bin/pg_dump "$DATABASE_URL" -F c -f /var/backups/app/$(date +\%F).dump`
    - Retensi: simpan 7–14 hari · verifikasi restore berkala
- [ ] Dokumentasi variabel `.env` (DATABASE_URL, JWT/secret, dll.)
  - Minimal yang dipakai:
    - `DATABASE_URL` → koneksi database (Postgres/MySQL sesuai Prisma)
    - `JWT_SECRET` → signing token auth (cek lib/auth)
    - `NEXT_PUBLIC_BASE_URL` → origin publik untuk link/redirect
    - `GOOGLE_SERVICE_ACCOUNT_KEY` → JSON kredensial untuk upload Drive (jika fitur dipakai)
  - Contoh `.env`:
    ```env
    DATABASE_URL="postgresql://user:pass@host:5432/dbname?schema=public"
    JWT_SECRET="super-secret-string"
    NEXT_PUBLIC_BASE_URL="https://your-domain.com"
    # Opsional
    GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account", ... }'
    ```

---

## ✅ **P. Testing & QA**

- [ ] Unit test brand guard & RBAC
- [ ] Integration test API transaksi per brand
- [ ] E2E test (Playwright) untuk flow utama (runWithServer.js)
- [ ] Data seeding untuk test (customers, products, templates)

---

## 🛰️ **Q. Monitoring & Logging**

- [ ] ActivityLog untuk aksi create/update penting
- [ ] Server request logs (status, durasi, userId, brand)
- [ ] Error boundary di UI + global-error (opsional)
- [ ] Metric sederhana: waktu respon API utama

---

## ♿ **R. Accessibility & Performance**

- [ ] Kontras warna sesuai WCAG di tema brand
- [ ] Keyboard navigation & fokus yang jelas
- [ ] Audit Lighthouse (performance & a11y)
- [ ] Code-splitting & lazy-load untuk halaman besar

---

## 🔐 **S. Security Hardening**

- [ ] Rate limiting untuk endpoint sensitif
- [ ] CSRF proteksi untuk aksi write
- [ ] Sanitasi input & validasi file upload
- [ ] Hindari kebocoran env di client bundle
