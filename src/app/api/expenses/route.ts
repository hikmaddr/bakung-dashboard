import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveAllowedBrandIds } from "@/lib/brand";
import { createApiHandler } from "@/lib/api-handler";

type CreateExpenseBody = {
  category: string;
  amount: number;
  payee?: string;
  attachmentUrl?: string;
  paidAt?: string | Date;
  notes?: string;
  paymentId?: number | null;
  brandProfileId?: number;
};

export const GET = createApiHandler({
  handler: async (req, _, { activeBrand, user }) => {
    const allowedBrandIds = await resolveAllowedBrandIds(
      user.userId,
      user.roles || [],
      []
    );
    const search = req.nextUrl.searchParams;
    const page = Math.max(1, parseInt(search.get("page") || "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(search.get("pageSize") || "20")));
    const brandIdStr = search.get("brandId");
    const category = search.get("category") || undefined;
    const dateFrom = search.get("dateFrom");
    const dateTo = search.get("dateTo");

    let brandId: number | null = null;
    if (brandIdStr) {
      const parsed = Number(brandIdStr);
      if (Number.isFinite(parsed) && parsed > 0) brandId = parsed;
    }

    const where: any = {};
    if (brandId != null) {
      if (allowedBrandIds.length && !allowedBrandIds.includes(brandId)) {
        return NextResponse.json({ success: false, message: "Forbidden: brand scope" }, { status: 403 });
      }
      where.brandProfileId = brandId;
    } else if (allowedBrandIds.length) {
      where.brandProfileId = { in: allowedBrandIds };
    } else {
      where.brandProfileId = activeBrand.id;
    }

    if (category) where.category = { contains: category, mode: "insensitive" };
    if (dateFrom || dateTo) {
      where.paidAt = {} as any;
      if (dateFrom) (where.paidAt as any).gte = new Date(dateFrom!);
      if (dateTo) (where.paidAt as any).lte = new Date(dateTo!);
    }

    const [total, rows, sum] = await Promise.all([
      prisma.expense.count({ where }),
      prisma.expense.findMany({
        where,
        orderBy: { paidAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { payment: { include: { receipt: true } } },
      }),
      prisma.expense.aggregate({ _sum: { amount: true }, where }),
    ]);

    return NextResponse.json({ success: true, data: rows, total, page, pageSize, sum: sum._sum.amount || 0 });
  }
});

export const POST = createApiHandler({
  actionName: "EXPENSE_CREATE",
  entityType: "expense",
  handler: async (req, body: CreateExpenseBody, { activeBrand, user }) => {
    const amount = Number(body.amount) || 0;
    if (!(amount > 0)) return NextResponse.json({ success: false, message: "Jumlah expense harus > 0" }, { status: 400 });
    const paidAt = body.paidAt ? new Date(body.paidAt) : new Date();

    if (body.paymentId) {
      const pay = await prisma.payment.findFirst({ where: { id: body.paymentId, brandProfileId: activeBrand.id } });
      if (!pay) return NextResponse.json({ success: false, message: "Payment tidak ditemukan atau beda brand" }, { status: 400 });
    }

    const exp = await prisma.expense.create({
      data: {
        brandProfileId: activeBrand.id,
        category: body.category,
        amount,
        payee: body.payee || null,
        attachmentUrl: body.attachmentUrl || null,
        paidAt,
        notes: body.notes || null,
        paymentId: body.paymentId || null,
      },
    });

    return NextResponse.json({ success: true, data: exp });
  }
});

