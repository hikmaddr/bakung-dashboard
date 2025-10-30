/*
  Seed default roles and promote the first Owner user if none exists.

  Usage:
    node scripts/seed-roles.js [--email someone@example.com]

  Behavior:
  - Ensures roles: owner, admin, finance, warehouse, staff exist (idempotent).
  - If --email provided: assigns role "owner" to that user (creates relation if missing).
  - Else, if there is no current owner and exactly one user exists, assigns that user as owner.
  - Else, logs instructions without making a risky blanket change.
*/

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function getArg(name) {
  const idx = process.argv.findIndex((a) => a === name || a.startsWith(name + "="));
  if (idx === -1) return null;
  const cur = process.argv[idx];
  if (cur.includes("=")) return cur.split("=")[1];
  const next = process.argv[idx + 1];
  if (!next || next.startsWith("--")) return "";
  return next;
}

async function ensureRoles() {
  const roles = [
    { name: "owner", description: "Full system access" },
    { name: "admin", description: "System admin (manage brands, reporting)" },
    { name: "finance", description: "Can access Finance menus" },
    { name: "warehouse", description: "Warehouse staff; limited menus" },
    { name: "staff", description: "General staff access" },
  ];

  const createdOrExisting = [];
  for (const r of roles) {
    const upserted = await prisma.role.upsert({
      where: { name: r.name },
      update: { description: r.description },
      create: { name: r.name, description: r.description, permissions: {} },
    });
    createdOrExisting.push(upserted);
  }
  return createdOrExisting;
}

async function findOwnerRoleId() {
  const owner = await prisma.role.findUnique({ where: { name: "owner" } });
  if (!owner) throw new Error("Role 'owner' tidak ditemukan setelah seeding.");
  return owner.id;
}

async function countOwners() {
  const owners = await prisma.userRole.findMany({
    where: { role: { name: "owner" } },
    select: { userId: true },
  });
  return owners.length;
}

async function findSingleUserIfOnlyOne() {
  const total = await prisma.user.count();
  if (total === 1) {
    return prisma.user.findFirst();
  }
  return null;
}

async function assignOwnerToUser(userId, ownerRoleId) {
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId, roleId: ownerRoleId } },
    update: {},
    create: { userId, roleId: ownerRoleId },
  });
}

async function main() {
  console.log("[seed-roles] Start");
  await ensureRoles();
  const ownerRoleId = await findOwnerRoleId();

  const emailArg = getArg("--email");
  const ownersCount = await countOwners();

  if (emailArg) {
    const user = await prisma.user.findUnique({ where: { email: String(emailArg) } });
    if (!user) {
      console.error(`[seed-roles] User dengan email ${emailArg} tidak ditemukan.`);
      process.exitCode = 1;
      return;
    }
    await assignOwnerToUser(user.id, ownerRoleId);
    console.log(`[seed-roles] Berhasil assign OWNER ke ${user.email} (id=${user.id}).`);
    return;
  }

  if (ownersCount === 0) {
    const single = await findSingleUserIfOnlyOne();
    if (single) {
      await assignOwnerToUser(single.id, ownerRoleId);
      console.log(`[seed-roles] Tidak ada OWNER. Hanya ada 1 user (${single.email}). Dipromosikan jadi OWNER.`);
      return;
    }
    console.log(
      "[seed-roles] Tidak ada OWNER saat ini. Karena terdapat >1 user, mohon jalankan dengan --email user-target. Contoh: node scripts/seed-roles.js --email you@example.com"
    );
    return;
  }

  console.log(`[seed-roles] Sudah ada ${ownersCount} OWNER. Hanya melakukan seeding roles.`);
}

main()
  .catch((e) => {
    console.error("[seed-roles] Error:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

