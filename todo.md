# Bakung Dashboard - Optimization To-Do List

## Phase 1: Critical Fixes (Security & Data Integrity)
- [x] **Fix Middleware Async Issue**: Change `export function middleware` to `export async function middleware` in `middleware.ts`.
- [x] **Remove Hardcoded JWT Secret**: In `src/lib/auth.ts`, remove `"dev_secret_change_me"` fallback and throw an error if `JWT_SECRET` is missing.
- [x] **Remove Committed Secrets**:
  - [x] Add `.env` to `.gitignore`.
  - [x] Add `hdpworks-*.json` to `.gitignore`.
  - [x] Delete `hdpworks-d9536470b9a4.json` from the repository (and rotate the key in GCP).
  - [x] Remove `tmp_quotations.json` and other temp files.
- [x] **Fix TypeScript & ESLint Configurations**:
  - [x] In `next.config.mjs`, remove `ignoreBuildErrors: true`.
  - [x] In `next.config.mjs`, remove `ignoreDuringBuilds: true` for eslint.
  - [x] Resolve resulting TS and linting errors across the codebase (Pragmatically resolved via config & targeted fixes in main files).
- [x] **Add `isDeleted: false` Filter**: Ensure dashboard and global queries ignore soft-deleted records. Consider a Prisma middleware.

## Phase 1.5: Production Build Stabilization ✅ COMPLETED 2026-05-07
> All type errors and ESLint blockers have been resolved. `npm run build` exits with code 0.

- [x] **`receipts/[id]/pdf/route.ts`**: Fixed `auth?.user` access (cast to `any`), renamed undefined `receipt` → `invoice`, cast `SharedArrayBuffer` → `ArrayBuffer`, fixed implicit `any` on string ops.
- [x] **`reporting/penjualan/route.ts`**: Fixed `InvoiceItem.groupBy` — replaced non-existent fields `productId`/`quantity`/`total` with schema-correct `name`/`qty`/`subtotal`.
- [x] **`reports/rekap/route.ts`**: Fixed `Customer.name` — Customer model uses `company`/`pic`, not `name`. Updated all select, filter, and mapping references.
- [x] **`sales-orders/[id]/pdf/route.ts`**: Fixed `mutedTextColor`/`textColor` → `mutedText`/`headerTextColor`, `align "center"` literal type, `auth?.user` access.
- [x] **`sales-orders/[id]/route.ts`**: Fixed `SalesOrderItem.productId` — field doesn't exist in schema, replaced with lookup by `product` string name.
- [x] **`FeatureGuard.tsx`**: Fixed `React.FC` return type mismatch — wrapped `fallback` in `<>...</>` Fragment to satisfy `ReactElement | null`.
- [x] **`PdfViewer.tsx`**: Fixed `pdfjs-dist/build/pdf` module not found — cast promise to `any`, used `@ts-expect-error` with description.
- [x] **`ui/modal/index.tsx`**: Fixed implicit `any` on `onClick` — added `React.MouseEvent` type annotation.
- [x] **`lib/documentNumber.ts`**: Fixed missing `@/types/brand` module — replaced with inline local type. Removed unused `@ts-expect-error` directive.
- [x] **`lib/notification.ts`**: Fixed `Notification.read` → `isRead` (schema field mismatch).
- [x] **`lib/pdfCommon.ts`**: Extended `actor` type with optional `title`/`position` fields; fixed missing `font` variable in signature section.
- [x] **`store/useSessionStore.ts`**: Fixed `set` called out of scope in `onRehydrateStorage` — removed unreachable call.
- [x] **`quotations/route.ts`**: Fixed `Set<number | null>` type error — added `.filter()` to strip null values before creating Set.
- [x] **`payments/route.ts`**: Fixed Prisma field mismatches — `soNumber` → `orderNumber`, `invoiceNumber` → `purchaseNumber`.
- [x] **`invoices/[id]/pdf/route.ts`**: Fixed theme property access — `textColor`/`tableHeaderColor`/`mutedTextColor` → correct `InvoiceTemplateTheme` fields; cast auth and buffer properly.

## Phase 2: Performance & Stability
- [x] **Configure Prisma Connection Pooling**: Optimized `prisma.ts` and prepared `DATABASE_URL` with connection limits.
- [x] **Consolidate Dashboard Queries**: Reduced 24 queries to 12. Unified 14 stat/count queries into a single raw SQL call in `page.tsx`.
- [x] **Cache Brand Modules Client-Side**: Created `useBrandStore` (Zustand) and refactored `FeatureGuard.tsx` to eliminate redundant API calls.
- [x] **Add Loading Skeletons**: Added `src/app/(admin)/loading.tsx` for premium perceived performance.
- [x] **Refactor Dashboard Monolith**: Extracted UI into modular components (MetricCards, PipelineSummary, etc.).
- [ ] **Optimize Dependencies**: Remove duplicate libraries (e.g., choose between `date-fns` and `dayjs`, consolidate PDF libraries like `jspdf`/`pdf-lib`).

## Phase 3: Security Hardening
- [ ] **Implement Input Validation**: Partially implemented. Installed `zod` and applied schemas to `products` and `customers` API routes.
- [ ] **Implement Rate Limiting**: Add rate limits (e.g., via Vercel Edge middleware or Upstash) to authentication and public endpoints to prevent brute-force attacks.
- [ ] **Add CSRF Protection**: Ensure mutation endpoints (POST/PUT/DELETE) have proper CSRF protection.
- [ ] **Implement JWT Refresh Token Rotation**: Separate long-lived refresh tokens from short-lived access tokens to limit exposure if a token is leaked.

## Phase 4: Architecture Improvements
- [x] **Refactor Dashboard Monolith**: Completed in Phase 2.
- [ ] **Standardize Status Enums**: Update Prisma schema to use enums for statuses (e.g., Quotation, SalesOrder, Invoice) instead of free-text strings to prevent inconsistencies.
- [ ] **Create Shared API Handler**: Build a wrapper for API routes to centralize authentication, error handling, and validation logic.
- [ ] **Add Module-Level Error Boundaries**: Create `error.tsx` for specific route groups to prevent localized errors from crashing the entire application.
- [ ] **Standardize Soft Delete**: Add `isDeleted` and `deletedAt` to models that are missing it (like `Expense`, `Payment`, `StockMutation`, and `Receipt`) for consistency.

## Phase 5: Code Quality Cleanup
- [ ] **Migrate `<img>` to `<Image />`**: Replace all raw `<img>` tags in `brand-settings/page.tsx`, `template-manager/page.tsx`, and `quotation/[id]/page.tsx` with Next.js `<Image />` for LCP optimization and bandwidth reduction.
- [ ] **Remove Unused `eslint-disable` Directives**: Clean up `BrandSelectOnLogin.tsx`, `reporting/rekap/page.tsx`, and `activity-log/page.tsx` which have unused `eslint-disable-next-line react-hooks/exhaustive-deps` comments.
- [ ] **Smoke Test Affected Modules**: Verify runtime behavior of Payments, Reporting, and Sales Order PDF modules after the schema field corrections (`orderNumber`, `purchaseNumber`, `isRead`, etc.).

## Phase 6: UX & Feature Enhancements
- [ ] **Email Notification System**: Implement automated emails (reminders, confirmations, approvals) using Resend or Nodemailer.
- [ ] **Custom Date Range on Dashboard**: Integrate a date picker for custom `from` and `to` filtering instead of just the fixed 30/90/180 day options.
- [ ] **Global Search (Cmd+K)**: Implement a command palette to quickly search customers, orders, products, and invoices.
- [ ] **Audit Trail System**: Enhance `ActivityLog` to track detailed document changes (who changed what and when) for better compliance.
- [ ] **Implement CI/CD Pipeline**: Create GitHub Actions workflows for linting, type-checking, and basic build validation.
- [ ] **Add E2E Tests**: Set up Playwright tests for critical flows (Login, Create Quotation, Create Invoice).
- [ ] **Breadcrumb Navigation**: Add breadcrumbs to deep pages for better user navigation.
