import { prisma } from "@/lib/prisma";
import type { NextRequest } from "next/server";

function extractIp(req: NextRequest): string | null {
  try {
    const xf = req.headers.get("x-forwarded-for");
    if (xf) return xf.split(",")[0].trim();
  } catch {}
  try {
    const anyReq = req as any;
    if (anyReq?.ip) return String(anyReq.ip);
  } catch {}
  return null;
}

export async function logActivity(req: NextRequest, opts: { userId?: number | null; action: string; entity?: string | null; entityId?: number | null; metadata?: any }): Promise<void> {
  const ip = extractIp(req);
  const userAgent = req.headers.get("user-agent") || null;
  const payload: any = { ...(opts.metadata || {}) };
  if (ip) payload.ip = ip;
  if (userAgent) payload.userAgent = userAgent;
  try {
    await prisma.activityLog.create({
      data: {
        userId: opts.userId ?? null,
        action: opts.action,
        entity: opts.entity ?? null,
        entityId: opts.entityId ?? null,
        metadata: payload,
      },
    });
  } catch (e) {
    console.error("[logActivity] Failed", e);
  }
}

export async function logLogin(req: NextRequest, opts: { userId?: number | null; action: "LOGIN" | "LOGOUT"; success?: boolean; message?: string | null }): Promise<void> {
  const ip = extractIp(req);
  const userAgent = req.headers.get("user-agent") || null;
  try {
    await prisma.loginLog.create({
      data: {
        userId: opts.userId ?? null,
        action: opts.action,
        success: opts.success ?? true,
        ip: ip || null,
        userAgent: userAgent || null,
        message: opts.message ?? null,
      },
    });
  } catch (e) {
    console.error("[logLogin] Failed", e);
  }
}

