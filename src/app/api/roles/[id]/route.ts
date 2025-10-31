import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuth } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

function isOwner(roles?: string[] | null): boolean {
  if (!Array.isArray(roles)) return false;
  return roles.some((r) => r.toLowerCase() === "owner");
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const idObj = await params;
  const id = Number(idObj.id);
  if (Number.isNaN(id)) return NextResponse.json({ success: false, message: "ID tidak valid" }, { status: 400 });
  try {
    const role = await prisma.role.findUnique({ where: { id } });
    if (!role) return NextResponse.json({ success: false, message: "Role tidak ditemukan" }, { status: 404 });
    return NextResponse.json({ success: true, data: role });
  } catch (err: any) {
    console.error("[roles/:id][GET]", err);
    return NextResponse.json({ success: false, message: err?.message || "Gagal" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const idObj = await params;
  const id = Number(idObj.id);
  if (Number.isNaN(id)) return NextResponse.json({ success: false, message: "ID tidak valid" }, { status: 400 });
  try {
    const auth = await getAuth();
    if (!auth?.userId || !isOwner(auth.roles)) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }
    const before = await prisma.role.findUnique({ where: { id } });
    const body = await req.json();
    const data: any = {};
    if (body.name) data.name = body.name;
    if (body.description != null) data.description = body.description;
    if (body.permissions != null) data.permissions = body.permissions;
    const updated = await prisma.role.update({ where: { id }, data });
    await logActivity(req, {
      userId: auth.userId,
      action: "ROLE_UPDATE",
      entity: "role",
      entityId: id,
      metadata: { before, after: updated },
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (err: any) {
    console.error("[roles/:id][PUT]", err);
    return NextResponse.json({ success: false, message: err?.message || "Gagal update role" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const idObj = await params;
  const id = Number(idObj.id);
  if (Number.isNaN(id)) return NextResponse.json({ success: false, message: "ID tidak valid" }, { status: 400 });
  try {
    const auth = await getAuth();
    if (!auth?.userId || !isOwner(auth.roles)) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }
    const before = await prisma.role.findUnique({ where: { id } });
    await prisma.userRole.deleteMany({ where: { roleId: id } });
    await prisma.role.delete({ where: { id } });
    await logActivity(req, {
      userId: auth.userId,
      action: "ROLE_DELETE",
      entity: "role",
      entityId: id,
      metadata: { before },
    });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[roles/:id][DELETE]", err);
    return NextResponse.json({ success: false, message: err?.message || "Gagal hapus role" }, { status: 500 });
  }
}
