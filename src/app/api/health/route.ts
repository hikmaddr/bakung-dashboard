import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const startedAt = Date.now();
  const env: Record<string, boolean> = {
    DATABASE_URL: Boolean(process.env.DATABASE_URL),
    JWT_SECRET: Boolean(process.env.JWT_SECRET),
    NEXT_PUBLIC_BASE_URL: Boolean(process.env.NEXT_PUBLIC_BASE_URL),
  };

  let db: { ok: boolean; latencyMs?: number; error?: string } = { ok: false };
  try {
    const t0 = Date.now();
    // Prisma raw ping; works with MySQL provider
    await prisma.$queryRaw`SELECT 1`;
    db.ok = true;
    db.latencyMs = Date.now() - t0;
  } catch (e: any) {
    db.ok = false;
    db.error = e?.message || String(e);
  }

  const payload = {
    status: env.DATABASE_URL && db.ok ? "ok" : "degraded",
    env,
    db,
    uptimeMs: Date.now() - startedAt,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "0.0.0",
  };

  const status = payload.status === "ok" ? 200 : 503;
  return NextResponse.json(payload, { status });
}

