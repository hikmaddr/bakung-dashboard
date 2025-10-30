/*
  Hapus data modul Penjualan saja (Quotation, Sales Order, Invoice)
  Tanpa menghapus tabel atau data Customer.

  Jalankan: node script/clear-sales-data.js
*/

/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Mulai menghapus data modul Penjualan...');
  const results = {};
  try {
    // Urutan penting untuk FK
    results.invoiceItem = await prisma.invoiceItem.deleteMany();
    results.invoice = await prisma.invoice.deleteMany();
    results.salesOrderItem = await prisma.salesOrderItem.deleteMany();
    results.salesOrder = await prisma.salesOrder.deleteMany();
    results.quotationItem = await prisma.quotationItem.deleteMany();
    results.quotation = await prisma.quotation.deleteMany();

    console.log('Selesai. Ringkasan:');
    for (const [k, v] of Object.entries(results)) {
      console.log(`- ${k}: ${v.count} baris dihapus`);
    }
  } catch (e) {
    console.error('Gagal menghapus data:', e?.message || e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();

