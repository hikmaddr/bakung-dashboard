import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const basePrisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["error", "warn"],
  });

export const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const softDeleteModels = [
          "Customer",
          "Quotation",
          "SalesOrder",
          "Invoice",
          "Product",
          "PurchaseDirect",
          "SignatureProfile",
        ];

        if (
          softDeleteModels.includes(model) &&
          ["findMany", "findFirst", "count", "aggregate", "groupBy"].includes(
            operation
          )
        ) {
          const queryArgs = args as { where?: { isDeleted?: boolean } };
          queryArgs.where = { ...queryArgs.where, isDeleted: false };
        }

        return query(args);
      },
    },
  },
});

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = basePrisma;

// Gracefully disconnect Prisma on process exit to avoid hanging connections
process.on("beforeExit", async () => {
  try {
    await prisma.$disconnect();
  } catch {
    // ignore
  }
});
