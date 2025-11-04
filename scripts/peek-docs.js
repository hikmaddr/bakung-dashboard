/* Quick peek first available doc IDs for testing */
/* eslint-disable no-console */
try { require('dotenv').config(); } catch (_) {}
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const inv = await p.invoice.findFirst({ select: { id: true, invoiceNumber: true } });
  const quo = await p.quotation.findFirst({ select: { id: true, quotationNumber: true } });
  const so = await p.salesOrder.findFirst({ select: { id: true, orderNumber: true } });
  const rc = await p.receipt.findFirst({ select: { id: true, receiptNumber: true } });
  console.table([
    { model: 'invoice', id: inv?.id ?? null, number: inv?.invoiceNumber ?? null },
    { model: 'quotation', id: quo?.id ?? null, number: quo?.quotationNumber ?? null },
    { model: 'salesOrder', id: so?.id ?? null, number: so?.orderNumber ?? null },
    { model: 'receipt', id: rc?.id ?? null, number: rc?.receiptNumber ?? null },
  ]);
})()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await p.$disconnect(); });
