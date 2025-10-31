// Reset role permissions to sensible defaults per role
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const MODULE_KEYS = [
  'client',
  'quotation',
  'salesOrder',
  'invoice',
  'kwitansi',
  'delivery',
  'purchaseOrder',
  'productStock',
  'templateBranding',
  'reporting',
  'systemUser',
];

function p(view = true, create = false, edit = false, del = false, approve = false) {
  return { view, create, edit, delete: del, approve };
}

function buildDefaultsForRole(roleName) {
  const lower = String(roleName || '').toLowerCase();

  if (lower === 'owner') {
    const obj = {};
    for (const m of MODULE_KEYS) obj[m] = p(true, true, true, true, true);
    return obj;
  }

  if (lower === 'admin') {
    return {
      client: p(true, true, true, false, false),
      quotation: p(true, true, true, false, true),
      salesOrder: p(true, true, true, false, true),
      invoice: p(true, true, true, false, true),
      kwitansi: p(true, true, true, false, true),
      delivery: p(true, true, true, false, true),
      purchaseOrder: p(true, true, true, false, true),
      productStock: p(true, true, true, false, true),
      templateBranding: p(true, true, true, false, false),
      reporting: p(true, false, false, false, false),
      systemUser: p(true, false, false, false, false),
    };
  }

  if (lower === 'finance') {
    return {
      client: p(true, false, true, false, false),
      quotation: p(true, false, false, false, false),
      salesOrder: p(true, false, false, false, false),
      invoice: p(true, true, true, false, true),
      kwitansi: p(true, true, true, false, true),
      delivery: p(true, false, false, false, false),
      purchaseOrder: p(true, false, false, false, false),
      productStock: p(true, false, false, false, false),
      templateBranding: p(true, false, false, false, false),
      reporting: p(true, false, false, false, false),
      systemUser: p(true, false, false, false, false),
    };
  }

  if (lower === 'warehouse') {
    return {
      client: p(true, false, false, false, false),
      quotation: p(true, false, false, false, false),
      salesOrder: p(true, false, false, false, false),
      invoice: p(true, false, false, false, false),
      kwitansi: p(true, false, false, false, false),
      delivery: p(true, true, true, false, true),
      purchaseOrder: p(true, false, false, false, false),
      productStock: p(true, true, true, false, true),
      templateBranding: p(true, false, false, false, false),
      reporting: p(true, false, false, false, false),
      systemUser: p(true, false, false, false, false),
    };
  }

  // default (staff)
  return {
    client: p(true, false, false, false, false),
    quotation: p(true, true, false, false, false),
    salesOrder: p(true, false, false, false, false),
    invoice: p(true, false, false, false, false),
    kwitansi: p(true, false, false, false, false),
    delivery: p(true, false, false, false, false),
    purchaseOrder: p(true, false, false, false, false),
    productStock: p(true, false, false, false, false),
    templateBranding: p(true, false, false, false, false),
    reporting: p(true, false, false, false, false),
    systemUser: p(true, false, false, false, false),
  };
}

(async () => {
  try {
    const roles = await prisma.role.findMany();
    const updates = [];
    for (const r of roles) {
      const defaults = buildDefaultsForRole(r.name);
      const updated = await prisma.role.update({ where: { id: r.id }, data: { permissions: defaults } });
      updates.push({ id: updated.id, name: updated.name });
    }
    console.log(JSON.stringify({ success: true, updated: updates }, null, 2));
  } catch (e) {
    console.error('Error resetting role defaults:', e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();

