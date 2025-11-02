import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const invoices = await prisma.invoice.findMany({ take: 1 });
    return Response.json({ success: true, data: invoices });
  } catch (error: any) {
    return Response.json({ success: false, error: error?.message || "Unknown error" });
  }
}

