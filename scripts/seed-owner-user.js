const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function ensureRoles() {
  const roles = [
    { name: 'owner', description: 'Full system access' },
    { name: 'admin', description: 'System admin (manage brands, reporting)' },
    { name: 'finance', description: 'Can access Finance menus' },
    { name: 'warehouse', description: 'Warehouse staff; limited menus' },
    { name: 'staff', description: 'General staff access' },
  ];
  for (const r of roles) {
    await prisma.role.upsert({
      where: { name: r.name },
      update: { description: r.description },
      create: { name: r.name, description: r.description, permissions: {} },
    });
  }
}

async function main() {
  try {
    const brand = await prisma.brandProfile.findFirst({ where: { isActive: true } });
    if (!brand) throw new Error('Active brand profile not found. Please create/activate a brand first.');

    const email = process.env.SEED_OWNER_EMAIL || 'owner@example.com';
    const plainPassword = process.env.SEED_OWNER_PASSWORD || 'owner123';
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    console.log(`[seed-owner-user] Ensuring roles...`);
    await ensureRoles();

    console.log(`[seed-owner-user] Upserting owner user ${email}...`);
    const user = await prisma.user.upsert({
      where: { email },
      update: { defaultBrandProfileId: brand.id },
      create: {
        email,
        name: 'Owner User',
        passwordHash,
        isActive: true,
        defaultBrandProfileId: brand.id,
      },
    });

    const ownerRole = await prisma.role.findUnique({ where: { name: 'owner' } });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: ownerRole.id } },
      update: {},
      create: { userId: user.id, roleId: ownerRole.id },
    });

    await prisma.userBrandScope.upsert({
      where: { userId_brandProfileId: { userId: user.id, brandProfileId: brand.id } },
      update: { isBrandAdmin: true },
      create: { userId: user.id, brandProfileId: brand.id, isBrandAdmin: true },
    });

    console.log(`[seed-owner-user] Done. Owner user id=${user.id}, email=${user.email}`);
  } catch (e) {
    console.error('[seed-owner-user] Error:', e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();

