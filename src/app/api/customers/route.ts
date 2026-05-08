import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { customerSchema, validateRequest } from "@/lib/validations";

// GET: Ambil semua data customer
export async function GET(req: NextRequest) {
  try {
    const includeDeleted = req.nextUrl.searchParams.get("includeDeleted") === "true";
    const customers = await prisma.customer.findMany({
      where: includeDeleted ? undefined : { deletedAt: null },
      orderBy: { id: "desc" },
    });
    const fmt = req.nextUrl.searchParams.get("format");
    if (fmt === "std") return NextResponse.json({ success: true, data: customers });
    return NextResponse.json(customers);
  } catch (error) {
    console.error("GET /api/customers error:", error);
    return NextResponse.json({ error: "Gagal mengambil data" }, { status: 500 });
  }
}

// POST: Tambah customer baru
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = validateRequest(customerSchema, body);

    if (!validation.success) {
      return NextResponse.json({ error: "Validation failed", details: validation.errors }, { status: 400 });
    }

    const newCustomer = await prisma.customer.create({
      data: validation.data,
    });

    return NextResponse.json(newCustomer, { status: 201 });
  } catch (error) {
    console.error("POST /api/customers error:", error);
    return NextResponse.json({ error: "Gagal menyimpan data" }, { status: 500 });
  }
}
