# Deploy ke Vercel + Neon

## Sekali saja (setup)
1. Push repo ini ke GitHub (`git push origin main`).
2. Buka https://vercel.com/new → Import `hikmaddr/bakung-dashboard`.
3. Framework terdeteksi Next.js otomatis; build command sudah diatur via `vercel.json` (`npm run vercel-build` = `prisma db push` + `next build`).
4. Set Environment Variables (Production + Preview):

| Variable | Nilai |
|---|---|
| `DATABASE_URL` | Connection string Neon (pakai host **-pooler**, sama dengan `.env` lokal) |
| `JWT_SECRET` | Secret acak yang kuat (JANGAN pakai default) |
| `BLOB_READ_WRITE_TOKEN` | Buat di Vercel → Storage → Blob → Connect ke project |
| `APP_BASE_URL` | `https://<project>.vercel.app` (atau custom domain) |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Isi JSON service account (jika fitur Google dipakai) |
| `SEED_OWNER_EMAIL` / `SEED_OWNER_PASSWORD` | Opsional, untuk seed user owner |

5. Deploy. Saat build, `prisma db push` akan membuat semua tabel di Neon.
6. Seed user owner (sekali): jalankan lokal `npx prisma db seed` dengan `DATABASE_URL` Neon di `.env`, atau via Vercel CLI.

## Rutin
Cukup `git push` — Vercel auto-deploy dari branch `main`.

## Catatan
- File upload otomatis pakai Vercel Blob saat `BLOB_READ_WRITE_TOKEN` ada.
- Font & gambar PDF sudah di-trace ke serverless (`outputFileTracingIncludes`).
- Script PM2/VPS lama tidak dipakai lagi di Vercel.
