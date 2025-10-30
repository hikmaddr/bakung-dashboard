import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import jwt from "jsonwebtoken";

const COOKIE = "auth_token";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic =
    pathname.startsWith("/signin") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/assets") ||
    pathname === "/logo.png" ||
    pathname.endsWith(".svg") ||
    pathname === "/favicon.ico";

  // Allow public routes (signin, signup, auth APIs, static assets)
  if (isPublic) return NextResponse.next();

  const token = req.cookies.get(COOKIE)?.value;
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/signin";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  try {
    const secret = process.env.JWT_SECRET || "dev_secret_change_me";
    jwt.verify(token, secret);
    
    // Brand transaction guard: cek akses brand untuk endpoint yang relevan
    const brandTxnPrefixes = [
      "/api/customers",
      "/api/product-categories",
      "/api/product-units",
      "/api/products",
      "/api/purchases",
      "/api/quotations",
      "/api/sales-orders",
      "/api/invoices",
      "/api/receipts",
      "/api/payments",
      "/api/reports",
      "/api/reporting",
      "/api/stock-mutations",
      "/api/expenses",
      "/api/deliveries",
    ];

    const isBrandTxn = brandTxnPrefixes.some((p) => pathname.startsWith(p));
    if (!isBrandTxn) {
      return NextResponse.next();
    }

    // Forward cookies to brand-access-check endpoint
    const origin = req.nextUrl.origin;
    const checkUrl = new URL(`${origin}/api/auth/brand-access-check`);

    // Propagate explicit brand query if present
    const brandIdParam = req.nextUrl.searchParams.get("brandId") || req.nextUrl.searchParams.get("brandProfileId");
    if (brandIdParam) checkUrl.searchParams.set("brandId", brandIdParam);

    const cookieHeader = req.headers.get("cookie") || "";
    
    return fetch(checkUrl.toString(), {
      method: "GET",
      headers: { cookie: cookieHeader },
    })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data?.allowed) return NextResponse.next();
        }

        // Jika bukan API route (page navigation), redirect ke forbidden
        if (!pathname.startsWith("/api")) {
          const url = req.nextUrl.clone();
          url.pathname = "/";
          url.searchParams.set("error", "brand_scope");
          url.searchParams.set("redirect", pathname);
          return NextResponse.redirect(url);
        }

        // Untuk API route, kembalikan 403 JSON
        return NextResponse.json({ success: false, message: "Forbidden: brand scope" }, { status: 403 });
      })
      .catch(() => {
        // Jika terjadi error pada checker, fail-safe: block API, redirect page
        if (!pathname.startsWith("/api")) {
          const url = req.nextUrl.clone();
          url.pathname = "/";
          url.searchParams.set("error", "brand_scope_error");
          url.searchParams.set("redirect", pathname);
          return NextResponse.redirect(url);
        }
        return NextResponse.json({ success: false, message: "Brand scope check error" }, { status: 403 });
      });
  } catch {
    const url = req.nextUrl.clone();
    url.pathname = "/signin";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }
}

export const config = {
  // Apply middleware to all paths; public paths are allowed via isPublic check above
  matcher: ["/(.*)"],
};
