import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuth } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

function isOwner(roles?: string[] | null): boolean {
  if (!Array.isArray(roles)) return false;
  return roles.some((r) => r.toLowerCase() === "owner");
}

const MODULE_KEYS = [
  "client",
  "quotation",
  "salesOrder",
  "invoice",
  "kwitansi",
  "delivery",
  "purchaseOrder",
  "productStock",
  "templateBranding",
  "reporting",
  "systemUser",
];

const PERM_TEMPLATE = { view: true, create: false, edit: false, delete: false, approve: false };

function p(view = true, create = false, edit = false, del = false, approve = false) {
  return { view, create, edit, delete: del, approve };
}

function buildDefaultsForRole(roleName: string) {
  const lower = roleName.toLowerCase();

  // Owner: full access to everything
  if (lower === "owner") {
    const obj: any = {};
    for (const m of MODULE_KEYS) obj[m] = p(true, true, true, true, true);
    return obj;
  }

  // Admin: can manage most business operations, approve key flows, no hard delete
  if (lower === "admin") {
    return {
      client: p(true, true, true, false, false),
      quotation: p(true, true, true, false, true),
      salesOrder: p(true, true, true, false, true),
      invoice: p(true, true, true, false, true),
      kwitansi: p(true, true, true, false, true),
      delivery: p(true, true, true, false, true),
      purchaseOrder: p(true, true, true, false, true),
      productStock: p(true, true, true, false, true),
      templateBranding: p(true, true, true, false, false),
      reporting: p(true, false, false, false, false),
      systemUser: p(true, false, false, false, false),
    };
  }

  // Finance: focus on billing and payments approvals
  if (lower === "finance") {
    return {
      client: p(true, false, true, false, false),
      quotation: p(true, false, false, false, false),
      salesOrder: p(true, false, false, false, false),
      invoice: p(true, true, true, false, true),
      kwitansi: p(true, true, true, false, true),
      delivery: p(true, false, false, false, false),
      purchaseOrder: p(true, false, false, false, false),
      productStock: p(true, false, false, false, false),
      templateBranding: p(true, false, false, false, false),
      reporting: p(true, false, false, false, false),
      systemUser: p(true, false, false, false, false),
    };
  }

  // Warehouse: manage delivery and stock operations
  if (lower === "warehouse") {
    return {
      client: p(true, false, false, false, false),
      quotation: p(true, false, false, false, false),
      salesOrder: p(true, false, false, false, false),
      invoice: p(true, false, false, false, false),
      kwitansi: p(true, false, false, false, false),
      delivery: p(true, true, true, false, true),
      purchaseOrder: p(true, false, false, false, false),
      productStock: p(true, true, true, false, true),
      templateBranding: p(true, false, false, false, false),
      reporting: p(true, false, false, false, false),
      systemUser: p(true, false, false, false, false),
    };
  }

  // Default to Staff: minimal create on quotations, otherwise view-only
  return {
    client: p(true, false, false, false, false),
    quotation: p(true, true, false, false, false),
    salesOrder: p(true, false, false, false, false),
    invoice: p(true, false, false, false, false),
    kwitansi: p(true, false, false, false, false),
    delivery: p(true, false, false, false, false),
    purchaseOrder: p(true, false, false, false, false),
    productStock: p(true, false, false, false, false),
    templateBranding: p(true, false, false, false, false),
    reporting: p(true, false, false, false, false),
    systemUser: p(true, false, false, false, false),
  };
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuth();
    if (!auth?.userId || !isOwner(auth.roles)) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const roles = await prisma.role.findMany();
    const updates: any[] = [];
    for (const r of roles) {
      const defaults = buildDefaultsForRole(r.name);
      const updated = await prisma.role.update({ where: { id: r.id }, data: { permissions: defaults } });
      updates.push({ id: r.id, name: r.name, permissions: updated.permissions });
    }

    await logActivity(req, {
      userId: auth.userId,
      action: "ROLE_RESET_DEFAULT",
      entity: "role",
      entityId: null,
      metadata: { count: updates.length, updates },
    });

    return NextResponse.json({ success: true, data: updates });
  } catch (err: any) {
    console.error("[roles/reset-default][POST]", err);
    return NextResponse.json({ success: false, message: err?.message || "Gagal reset permissions" }, { status: 500 });
  }
}
