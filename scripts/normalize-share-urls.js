/*
  Normalizes existing shareUrl records to use the APP_BASE_URL domain.
  - Only updates rows where shareUrl points to "/s/<slug>" but with a different origin.
  - Works for Invoice, Quotation, SalesOrder, and Receipt models.
  Usage:
    APP_BASE_URL=https://bakung-dashboard.vercel.app npm run fix:share-urls
  Notes:
    - Ensure DATABASE_URL points to the target database you want to update
      (local/dev/prod). On Vercel, run via a one-off job or locally with prod DB URL.
*/

/* eslint-disable no-console */
try {
  // Attempt to load .env locally if available. Ignore error if dotenv not installed.
  require('dotenv').config();
} catch (_) {}

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function required(name) {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing required env var ${name}`);
  }
  return v;
}

function normalizeBaseUrl(url) {
  // Trim trailing slash
  return url.replace(/\/$/, '');
}

async function updateModelShareUrls(modelName, client, baseUrl) {
  const model = client[modelName];
  if (!model) {
    console.warn(`Model ${modelName} not found on PrismaClient; skipping.`);
    return { updated: 0 };
  }

  // Fetch candidates where shareUrl contains "/s/" and is not NULL
  const rows = await model.findMany({
    where: { shareUrl: { not: null } },
    select: { id: true, shareUrl: true },
  });

  let updated = 0;
  for (const row of rows) {
    const { shareUrl } = row;
    if (!shareUrl) continue;
    if (!shareUrl.includes('/s/')) continue;

    let parsed;
    try {
      parsed = new URL(shareUrl);
    } catch (_) {
      // Not a valid absolute URL; skip
      continue;
    }

    const path = parsed.pathname || '';
    if (!path.startsWith('/s/')) continue;

    const slug = path.split('/').filter(Boolean).pop();
    if (!slug) continue;

    const desired = `${baseUrl}/s/${slug}`;
    if (shareUrl === desired) continue; // already correct

    try {
      await model.update({
        where: { id: row.id },
        data: { shareUrl: desired },
      });
      updated += 1;
    } catch (e) {
      console.error(`Failed to update ${modelName}#${row.id}:`, e.message);
    }
  }

  return { updated };
}

async function main() {
  const base = normalizeBaseUrl(required('APP_BASE_URL'));
  console.log(`Using APP_BASE_URL=${base}`);

  const models = ['invoice', 'quotation', 'salesOrder', 'receipt'];
  const results = {};

  for (const name of models) {
    results[name] = await updateModelShareUrls(name, prisma, base);
  }

  console.table(
    Object.entries(results).map(([k, v]) => ({ model: k, updated: v.updated }))
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

