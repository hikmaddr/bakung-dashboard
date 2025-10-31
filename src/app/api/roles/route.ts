import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuth } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

function isOwner(roles?: string[] | null): boolean {
  if (!Array.isArray(roles)) return false;
  return roles.some((r) => r.toLowerCase() === "owner");
}

export async function GET() {
  try {
    const roles = await prisma.role.findMany({ orderBy: { createdAt: "desc" } });
    return NextResponse.json({ success: true, data: roles });
  } catch (err: any) {
    console.error("[roles][GET]", err);
    return NextResponse.json({ success: false, message: err?.message || "Gagal load roles" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuth();
    if (!auth?.userId || !isOwner(auth.roles)) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }
    const { name, description, permissions = {} } = await req.json();
    if (!name) return NextResponse.json({ success: false, message: "Nama role wajib." }, { status: 400 });
    const created = await prisma.role.create({ data: { name, description, permissions } });
    await logActivity(req, {
      userId: auth.userId,
      action: "ROLE_CREATE",
      entity: "role",
      entityId: created.id,
      metadata: { name: created.name, description: created.description, permissions: created.permissions },
    });
    return NextResponse.json({ success: true, data: created });
  } catch (err: any) {
    console.error("[roles][POST]", err);
    return NextResponse.json({ success: false, message: err?.message || "Gagal membuat role" }, { status: 500 });
  }
}
