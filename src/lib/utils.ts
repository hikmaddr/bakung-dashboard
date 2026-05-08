import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { type PrismaClient } from "@prisma/client";

// Soft-delete helper using deletedAt field across models
// Usage: await safeDelete(prisma, "invoice", id)
export async function safeDelete(
  prisma: PrismaClient,
  model: string,
  id: number
) {
  const repo = (prisma as unknown as Record<string, { update: Function }>)?.[model];
  if (!repo || typeof repo.update !== "function") {
    throw new Error(`safeDelete: Prisma model '${model}' not found or invalid`);
  }
  const now = new Date();
  try {
    return await repo.update({ where: { id }, data: { deletedAt: now } });
  } catch (err) {
    const error = err as Error;
    // If model has no deletedAt (unexpected), fallback to no-op error
    error.message = `safeDelete failed on model '${model}' with id ${id}: ${error.message}`;
    throw error;
  }
}
