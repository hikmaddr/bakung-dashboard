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
  if (isPublic) {
    const res = NextResponse.next();
    // Cache static assets aggressively; HTML pages will be covered below
    if (
      pathname.startsWith("/_next/static") ||
      pathname.startsWith("/images") ||
      pathname.startsWith("/assets") ||
      pathname.startsWith("/uploads") ||
      pathname.endsWith(".svg") ||
      pathname === "/favicon.ico" ||
      pathname === "/logo.png"
    ) {
      res.headers.set("Cache-Control", "public, max-age=31536000, immutable");
    }
    return res;
  }

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

    // Scope-based page guard: block certain modules when brand scope is CREATIVE
    const isApiRoute = pathname.startsWith("/api");
    const creativeBlockedPrefixes = [
      "/penjualan/order-penjualan",
      "/penjualan/kwitansi-penjualan",
      "/penjualan/surat-jalan",
      "/produk-stok",
      "/pembelian",
    ];
    const isCreativeBlockedPage = !isApiRoute && creativeBlockedPrefixes.some((p) => pathname.startsWith(p));
    if (isCreativeBlockedPage) {
      const origin = req.nextUrl.origin;
      const cookieHeader = req.headers.get("cookie") || "";
      // Fetch active brand to read businessScope (API uses Node runtime for Prisma)
      return fetch(`${origin}/api/brand-profiles/active`, { headers: { cookie: cookieHeader } })
        .then(async (res) => {
          if (!res.ok) return NextResponse.next();
          const brand = await res.json().catch(() => null);
          if (brand?.businessScope === "CREATIVE") {
            const url = req.nextUrl.clone();
            url.pathname = "/";
            url.searchParams.set("error", "scope_creative_blocked");
            url.searchParams.set("redirect", pathname);
            return NextResponse.redirect(url);
          }
          const nextRes = NextResponse.next();
          // Default page caching for SSR/SSG responses
          nextRes.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
          return nextRes;
        })
        .catch(() => NextResponse.next());
    }
    
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
      const nextRes = NextResponse.next();
      nextRes.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
      return nextRes;
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
          if (data?.allowed) {
            const nextRes = NextResponse.next();
            nextRes.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
            return nextRes;
          }
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
        const jsonRes = NextResponse.json({ success: false, message: "Forbidden: brand scope" }, { status: 403 });
        jsonRes.headers.set("Cache-Control", "no-store");
        return jsonRes;
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
        const jsonRes = NextResponse.json({ success: false, message: "Brand scope check error" }, { status: 403 });
        jsonRes.headers.set("Cache-Control", "no-store");
        return jsonRes;
      });
  } catch {
    const url = req.nextUrl.clone();
    url.pathname = "/signin";
    url.searchParams.set("redirect", pathname);
    const res = NextResponse.redirect(url);
    res.headers.set("Cache-Control", "no-store");
    return res;
  }
}

export const config = {
  // Apply middleware to all paths; public paths are allowed via isPublic check above
  matcher: ["/(.*)"],
};
