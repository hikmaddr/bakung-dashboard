import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Soft-delete helper using deletedAt field across models
// Usage: await safeDelete(prisma, "invoice", id)
export async function safeDelete(
  prisma: any,
  model: string,
  id: number
) {
  const repo = (prisma as any)?.[model];
  if (!repo || typeof repo.update !== "function") {
    throw new Error(`safeDelete: Prisma model '${model}' not found or invalid`);
  }
  const now = new Date();
  try {
    return await repo.update({ where: { id }, data: { deletedAt: now } });
  } catch (err: any) {
    // If model has no deletedAt (unexpected), fallback to no-op error
    err.message = `safeDelete failed on model '${model}' with id ${id}: ${err.message}`;
    throw err;
  }
}
