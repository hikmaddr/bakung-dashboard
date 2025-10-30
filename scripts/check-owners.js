const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const owners = await prisma.userRole.findMany({ where: { role: { name: "owner" } }, select: { userId: true } });
  const users = await prisma.user.findMany({ select: { id: true, email: true } });
  console.log(JSON.stringify({ owners: owners.map((o) => o.userId), users }, null, 2));
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(async () => { await prisma.$disconnect(); });

