import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuth } from "@/lib/auth";
import { getActiveBrandProfile } from "@/lib/brand";

export const runtime = "nodejs";

export async function GET() {
  try {
    const auth = await getAuth();
    if (!auth?.userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    // Parallel fetch for speed
    const [user, activeBrand] = await Promise.all([
      prisma.user.findUnique({
        where: { id: auth.userId },
        include: { roles: { include: { role: true } } },
      }),
      getActiveBrandProfile(),
    ]);

    if (!user) {
      return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
    }

    const roles = user.roles.map((ur) => ur.role.name);
    const rolesLower = roles.map(r => r.toLowerCase());
    const isOwner = rolesLower.includes("owner");

    // Fetch brands user has access to
    let brands: any[] = [];
    if (isOwner) {
      brands = await prisma.brandProfile.findMany({
        orderBy: { name: "asc" }
      });
    } else {
      const scopes = await prisma.userBrandScope.findMany({
        where: { userId: user.id },
        include: { brand: true }
      });
      brands = scopes.map(s => s.brand);
    }

    // Fetch common metrics (e.g., unpaid invoices)
    let invoiceOpenCount = 0;
    if (activeBrand) {
      invoiceOpenCount = await prisma.invoice.count({
        where: {
          brandProfileId: activeBrand.id,
          paymentStatus: "UNPAID",
          deletedAt: null
        }
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          firstName: user.firstName,
          lastName: user.lastName,
          roles: roles,
        },
        activeBrand,
        brands,
        metrics: {
          invoiceOpen: invoiceOpenCount
        }
      }
    });
  } catch (err: any) {
    console.error("[api/init] Error:", err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
