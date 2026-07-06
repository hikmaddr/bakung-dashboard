import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createApiHandler } from "@/lib/api-handler";
import { resolveAllowedBrandIds } from "@/lib/brand";

export const GET = createApiHandler({
  handler: async (req, _, { activeBrand, user }) => {
    const allowedBrandIds = await resolveAllowedBrandIds(
      user.userId,
      user.roles || [],
      []
    );
    const search = req.nextUrl.searchParams;
    const q = search.get("q")?.trim();
    const status = search.get("status")?.trim() || undefined;
    const brandIdStr = search.get("brandId")?.trim();
    const dateFromStr = search.get("dateFrom")?.trim();
    const dateToStr = search.get("dateTo")?.trim();
    const page = parseInt(search.get("page") || "1");
    const pageSize = parseInt(search.get("pageSize") || "20");

    const where: any = { isDeleted: false };
    let brandId: number | null = null;
    if (brandIdStr) {
      const parsed = Number(brandIdStr);
      if (!Number.isNaN(parsed)) brandId = parsed;
    }

    if (brandId != null) {
      if (allowedBrandIds.length && !allowedBrandIds.includes(brandId)) {
        return NextResponse.json(
          { success: false, message: "Forbidden: brand scope" },
          { status: 403 }
        );
      }
      where.brandProfileId = brandId;
    } else {
      if (allowedBrandIds.length) {
        where.brandProfileId = { in: allowedBrandIds };
      } else {
        where.brandProfileId = activeBrand.id;
      }
    }

    if (q) {
      where.OR = [
        { invoiceNumber: { contains: q, mode: 'insensitive' } },
        { supplierName: { contains: q, mode: 'insensitive' } }
      ];
    }
    if (status) where.status = status;
    if (dateFromStr || dateToStr) {
      where.date = {} as any;
      if (dateFromStr) (where.date as any).gte = new Date(dateFromStr);
      if (dateToStr) (where.date as any).lte = new Date(dateToStr);
    }

    const [total, rows] = await Promise.all([
      prisma.purchaseInvoice.count({ where }),
      prisma.purchaseInvoice.findMany({
        where,
        orderBy: { date: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({ success: true, data: rows, total, page, pageSize });
  }
});

export const POST = createApiHandler({
  actionName: "PURCHASE_INVOICE_CREATE",
  entityType: "purchase_invoice",
  handler: async (req, body: any, { activeBrand }) => {
    const { invoiceNumber, date, supplierId, amount, notes, items } = body;

    if (!invoiceNumber || !date || !supplierId) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }

    // Fetch supplier name
    const supplier = await prisma.customer.findUnique({
      where: { id: supplierId }
    });

    if (!supplier) {
      return NextResponse.json({ success: false, message: "Supplier not found" }, { status: 404 });
    }

    const res = await prisma.purchaseInvoice.create({
      data: {
        invoiceNumber,
        date: new Date(date),
        supplierName: supplier.company || supplier.pic,
        notes,
        total: amount,
        brandProfileId: activeBrand.id,
        status: "Draft",
        // If there are items, we could add them here, but the current form only sends 'amount'
      }
    });

    return NextResponse.json({ success: true, data: res });
  }
});
