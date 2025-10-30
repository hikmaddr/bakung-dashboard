import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: Ambil semua data customer
export async function GET(req: NextRequest, _ctx: { params: Promise<{}> }) {
  try {
    const customers = await prisma.customer.findMany({
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
export async function POST(req: NextRequest, _ctx: { params: Promise<{}> }) {
  try {
    const body = await req.json();
    const { pic, email, company, address, phone } = body;

    if (!pic || !company || !address || !phone) {
      return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });
    }

    const newCustomer = await prisma.customer.create({
      data: { pic, email, company, address, phone },
    });

    return NextResponse.json(newCustomer, { status: 201 });
  } catch (error) {
    console.error("POST /api/customers error:", error);
    return NextResponse.json({ error: "Gagal menyimpan data" }, { status: 500 });
  }
}
