import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveBrandProfile, resolveAllowedBrandIds } from "@/lib/brand";
import { getAuth } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

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

export async function GET(req: NextRequest) {
  try {
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
    if (!brandId) {
      const brand = await getActiveBrandProfile();
      if (brand?.id) brandId = brand.id;
    }

    const where: any = {};
    if (brandId) where.brandProfileId = brandId;
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
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || "Gagal memuat expenses" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CreateExpenseBody;
    const auth = await getAuth();
    const brand = await getActiveBrandProfile();
    if (!brand?.id) return NextResponse.json({ success: false, message: "Brand aktif tidak ditemukan" }, { status: 400 });
    const brandId = brand.id;
    const allowedBrandIds = await resolveAllowedBrandIds(auth?.userId ?? null, (auth?.roles as string[]) ?? [], []);
    if (!allowedBrandIds.includes(brandId)) return NextResponse.json({ success: false, message: "Forbidden: brand scope" }, { status: 403 });
    const amount = Number(body.amount) || 0;
    if (!(amount > 0)) return NextResponse.json({ success: false, message: "Jumlah expense harus > 0" }, { status: 400 });
    const paidAt = body.paidAt ? new Date(body.paidAt) : new Date();

    // Validasi paymentId jika diberikan: harus milik brand yang sama
    if (body.paymentId) {
      const pay = await prisma.payment.findFirst({ where: { id: body.paymentId, brandProfileId: brandId } });
      if (!pay) return NextResponse.json({ success: false, message: "Payment tidak ditemukan atau beda brand" }, { status: 400 });
    }

    const exp = await prisma.expense.create({
      data: {
        brandProfileId: brandId!,
        category: body.category,
        amount,
        payee: body.payee || null,
        attachmentUrl: body.attachmentUrl || null,
        paidAt,
        notes: body.notes || null,
        paymentId: body.paymentId || null,
      },
    });

    // Log important transaction
    try {
      await logActivity(req, {
        userId: auth?.userId || null,
        action: "EXPENSE_CREATE",
        entity: "expense",
        entityId: exp.id,
        metadata: {
          brandProfileId: brandId,
          category: body.category,
          amount,
          paidAt,
          paymentId: body.paymentId || null,
        },
      });
    } catch {}

    return NextResponse.json({ success: true, data: exp });
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || "Gagal membuat expense" }, { status: 500 });
  }
}
