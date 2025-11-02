import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Gracefully disconnect Prisma on process exit to avoid hanging connections
process.on("beforeExit", async () => {
  try {
    await prisma.$disconnect();
  } catch (_) {
    // ignore
  }
});
