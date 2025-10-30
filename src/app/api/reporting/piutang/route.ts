import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveBrandProfile } from "@/lib/brand";

const PAID_STATUSES = [
  "Paid",
  "paid",
  "PAID",
  "Lunas",
  "lunas",
  "Completed",
  "completed",
  "Cancelled",
  "cancelled",
  "Canceled",
  "canceled",
];

export async function GET(req: Request) {
  try {
    const brand = await getActiveBrandProfile();
    const brandWhere = brand ? { brandProfileId: brand.id } : {};
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    const [unpaid, overdue, dueSoon, paidThisMonth, openInvoices] = await Promise.all([
      prisma.invoice.aggregate({
        where: { status: { notIn: PAID_STATUSES }, ...(brandWhere as any) },
        _sum: { total: true },
        _count: true,
      }),
      prisma.invoice.count({
        where: { status: { notIn: PAID_STATUSES }, dueDate: { lt: today }, ...(brandWhere as any) },
      }),
      prisma.invoice.count({
        where: {
          status: { notIn: PAID_STATUSES },
          dueDate: { gte: today, lt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7) },
          ...(brandWhere as any),
        },
      }),
      prisma.invoice.aggregate({
        where: { status: { in: PAID_STATUSES }, issueDate: { gte: startOfMonth, lt: endOfMonth }, ...(brandWhere as any) },
        _sum: { total: true },
      }),
      prisma.invoice.findMany({
        where: { status: { notIn: PAID_STATUSES }, ...(brandWhere as any) },
        select: { id: true, customerId: true, total: true, dueDate: true, status: true, customer: { select: { company: true, pic: true } } },
        orderBy: { dueDate: "asc" },
      }),
    ]);

    // Aging buckets
    const buckets = { "0-30": 0, "31-60": 0, "61-90": 0, ">90": 0 } as Record<string, number>;
    openInvoices.forEach((inv) => {
      const dd = inv.dueDate ? new Date(inv.dueDate as any) : null;
      const days = dd ? Math.floor((today.getTime() - dd.getTime()) / (1000 * 60 * 60 * 24)) : 0;
      const amt = Number(inv.total || 0);
      if (days <= 30) buckets["0-30"] += amt;
      else if (days <= 60) buckets["31-60"] += amt;
      else if (days <= 90) buckets["61-90"] += amt;
      else buckets[">90"] += amt;
    });

    return NextResponse.json({
      brand: brand ? { id: brand.id, name: brand.name } : null,
      metrics: {
        outstanding: Number(unpaid._sum.total || 0),
        invoiceOpen: Number(unpaid._count || 0),
        overdueCount: overdue,
        dueSoon,
        paidThisMonth: Number(paidThisMonth._sum.total || 0),
      },
      aging: buckets,
      openInvoices: openInvoices.map((inv) => ({
        id: inv.id,
        customer: inv.customer ? `${inv.customer.pic ? inv.customer.pic + ' - ' : ''}${inv.customer.company || ''}` : 'Customer',
        total: Number(inv.total || 0),
        dueDate: inv.dueDate,
        status: inv.status,
        days: inv.dueDate ? Math.floor((today.getTime() - new Date(inv.dueDate as any).getTime()) / (1000 * 60 * 60 * 24)) : 0,
      })),
    });
  } catch (error) {
    console.error("[api.reporting.piutang] GET error", error);
    return NextResponse.json({ error: "Failed to load receivables reporting" }, { status: 500 });
  }
}
