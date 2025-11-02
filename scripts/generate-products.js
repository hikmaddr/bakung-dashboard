const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function randFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

const adjectives = ['Premium', 'Eco', 'Smart', 'Ultra', 'Classic', 'Compact', 'Pro'];
const items = ['Notebook', 'Pen', 'Mug', 'T-Shirt', 'USB Drive', 'Backpack', 'Bottle'];

function makeSku(i) {
  const base = 'SKU' + String(1000 + i);
  return base;
}

async function ensureDefaultCategory(brandId) {
  const code = 'GEN';
  const existing = await prisma.productCategory.findUnique({ where: { code } });
  if (existing) return existing;
  return prisma.productCategory.create({
    data: {
      name: 'General',
      code,
      description: 'Default category',
      brandProfileId: brandId,
    },
  });
}

async function main() {
  try {
    const brand = await prisma.brandProfile.findFirst({ where: { isActive: true } });
    if (!brand) throw new Error('Active brand profile not found. Please create/activate a brand first.');

    const category = await ensureDefaultCategory(brand.id);
    const toCreate = 20;
    console.log(`[generate-products] Creating ${toCreate} products for brand id=${brand.id}, category id=${category.id}`);

    for (let i = 0; i < toCreate; i++) {
      const name = `${randFrom(adjectives)} ${randFrom(items)} ${i+1}`;
      await prisma.product.create({
        data: {
          sku: makeSku(i),
          name,
          description: 'Sample product for testing',
          categoryId: category.id,
          brandProfileId: brand.id,
          unit: 'pcs',
          buyPrice: Math.round((Math.random() * 50000 + 10000) * 100) / 100,
          sellPrice: Math.round((Math.random() * 80000 + 20000) * 100) / 100,
          trackStock: true,
          qty: Math.floor(Math.random() * 200),
        },
      });
    }
    console.log('[generate-products] Done');
  } catch (e) {
    console.error('[generate-products] Error:', e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();

