# Bakung Dashboard — Multi-Brand Business System by HDP Works

Bakung Dashboard is an internal multi-brand management system built for **HDP Works**, a creative and procurement studio.
It centralizes quotation, invoicing, purchasing, and reporting processes across multiple business scopes: **Creative Service**, **Procurement**, and **Souvenir**.

---

## Features

### Core Modules
- **Authentication & Role Management**  
  Multi-role access (Owner, Admin, Staff) with brand-based permissions.
- **Multi-Brand Support**  
  Each brand has its own scope (CREATIVE, PROCUREMENT, SOUVENIR) and independent data context.
- **Sales System**  
  Quotation → Sales Order → Invoice → Receipt → Delivery Note  
  (Simplified to Quotation → Invoice for Creative brands)
- **Purchase & Inventory**  
  Purchase Order, Supplier Management, and Stock Control.
- **Brand Templates & Branding Manager**  
  Custom document templates per brand (header, footer, signature, theme color).
- **Notification System**  
  Approval alerts, pending actions, and system feedback (toast + header badge).
- **Reporting & Recap**  
  Comprehensive summaries for sales, purchases, stock, and receivables.

---

## Brand Scopes

| Scope | Description | Active Modules |
|--------|--------------|----------------|
| **Creative Service** | Focus on design & creative projects | Quotation, Invoice, Reporting |
| **Procurement** | Full operational module | All modules |
| **Souvenir** | Merchandise & finished products | All modules + product catalog |

---

## Tech Stack

- **Frontend:** Next.js, TailwindCSS, shadcn/ui  
- **Backend:** Node.js + Prisma ORM  
- **Database:** MySQL  
- **UI Library:** TypeScript, Zustand, Axios  
- **Hosting:** Vercel (Frontend), Railway / VPS (Backend)  
- **PDF & File Services:** Puppeteer, PDFKit  
- **Notifications:** Toast & in-app badge system  
- **Authentication:** Role-based login dengan aktivasi (akun pertama auto-aktif)

---

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/hikmaddr/bakung-dashboard.git
   cd bakung-dashboard
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Buat file .env:
   ```env
   # MySQL lokal
   DATABASE_URL="mysql://username:password@localhost:3306/bakung_dashboard"

   # JWT secret untuk token login (wajib diisi di production)
   JWT_SECRET="ganti_dengan_kunci_rahasia_yang_kuat"
   ```

   Contoh koneksi TiDB Cloud (public endpoint memakai TLS):
   ```env
   # TiDB Cloud Serverless
   DATABASE_URL="mysql://username:password@host:4000/database?sslaccept=strict"
   # Jika diminta CA cert, simpan file CA di folder prisma dan tambahkan:
   # DATABASE_URL="mysql://username:password@host:4000/database?sslaccept=strict&sslcert=./prisma/ca.pem"
   ```
4. Run Prisma migrations:
   ```bash
   npx prisma migrate dev
   ```
5. Start development server:
   ```bash
   npm run dev
   ```

6. Bootstrap akun pertama:
   - Buka halaman `/signup` dan daftarkan akun Owner pertama.
   - Jika database masih kosong, akun pertama otomatis aktif sebagai `Owner` sehingga bisa langsung login.
   - Pendaftaran berikutnya berstatus menunggu persetujuan admin (non-aktif) dan perlu di-approve lewat panel System User.

---

## Developer Guide

Each brand profile has a field `businessScope`:
```prisma
businessScope String? // "CREATIVE" | "PROCUREMENT" | "SOUVENIR"
```
Sidebar and document flow adapt automatically based on the selected scope.

Creative scope skips Sales Order and directly allows Create Invoice from Quotation.

Owner can manage users, roles, and approve new sign-ups.

Notification and Activity Log capture key system actions (approve, edit, delete).

---

## Branding & Ownership

- Project: Bakung Dashboard
- Company/Studio: **HDP Works**
- Maintainer: **hikmaddr** (GitHub: https://github.com/hikmaddr)

For branding updates (logo, theme, document headers), see `src/lib/quotationTheme.ts` and brand assets under `public/images/brand/`.
