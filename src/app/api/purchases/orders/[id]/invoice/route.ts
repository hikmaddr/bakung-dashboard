import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/api-handler";
import { createPurchaseInvoiceFromOrder } from "@/services/purchaseService";

export const runtime = "nodejs";

export const POST = createApiHandler({
  actionName: "PURCHASE_INVOICE_CREATE_FROM_ORDER",
  entityType: "purchase_invoice",
  handler: async (req, body, { params }) => {
    const { id } = params as { id: string };
    try {
      const invoice = await createPurchaseInvoiceFromOrder(parseInt(id));
      return NextResponse.json({
        success: true,
        message: "Purchase Invoice berhasil dibuat dari Order",
        data: invoice,
      });
    } catch (err: any) {
      return NextResponse.json(
        { success: false, message: err.message || "Gagal membuat invoice" },
        { status: 400 }
      );
    }
  }
});
