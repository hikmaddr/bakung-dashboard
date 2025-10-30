import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function parseIntMaybe(v: string | null): number | undefined {
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get("page") || 1);
    const pageSize = Number(searchParams.get("pageSize") || 20);
    const action = searchParams.get("action") || undefined;
    const entity = searchParams.get("entity") || undefined;
    const userId = parseIntMaybe(searchParams.get("userId"));
    const dateFromStr = searchParams.get("dateFrom");
    const dateToStr = searchParams.get("dateTo");
    const q = searchParams.get("q") || undefined;

    const dateFrom = dateFromStr ? new Date(dateFromStr) : undefined;
    const dateTo = dateToStr ? new Date(dateToStr) : undefined;

    const skip = (page - 1) * pageSize;
    const where: any = {};
    if (action) where.action = action;
    if (entity) where.entity = entity;
    if (typeof userId === "number") where.userId = userId;
    if (dateFrom || dateTo) where.createdAt = {
      ...(dateFrom ? { gte: dateFrom } : {}),
      ...(dateTo ? { lte: dateTo } : {}),
    };
    if (q) {
      where.OR = [
        { action: { contains: q } },
        { entity: { contains: q } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.activityLog.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: pageSize }),
      prisma.activityLog.count({ where }),
    ]);
    return NextResponse.json({ success: true, data: { items, page, pageSize, total } });
  } catch (err: any) {
    console.error("[activity-log][GET]", err);
    return NextResponse.json({ success: false, message: err?.message || "Gagal load activity" }, { status: 500 });
  }
}
