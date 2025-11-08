import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Prisma client may have different models, so define a flexible type
type PrismaClientWithModels = {
  [K in string]: {
    update: (args: {
      where: { id: number };
      data: { deletedAt: Date };
    }) => Promise<unknown>;
  };
};

// Soft-delete helper using deletedAt field across models
// Usage: await safeDelete(prisma, "invoice", id)
export async function safeDelete(
  prisma: PrismaClientWithModels,
  model: string,
  id: number
) {
  const repo = prisma[model];
  if (!repo || typeof repo.update !== "function") {
    throw new Error(`safeDelete: Prisma model '${model}' not found or invalid`);
  }
  const now = new Date();
  try {
    return await repo.update({ where: { id }, data: { deletedAt: now } });
  } catch (err: unknown) {
    // If model has no deletedAt (unexpected), fallback to no-op error
    const errorMessage = err instanceof Error ? err.message : String(err);
    throw new Error(
      `safeDelete failed on model '${model}' with id ${id}: ${errorMessage}`
    );
  }
}
