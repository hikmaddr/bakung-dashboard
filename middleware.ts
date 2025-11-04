import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import jwt from "jsonwebtoken";

const COOKIE = "auth_token";
const LAST_ACTIVITY_COOKIE = "last_activity";
const MAX_IDLE_MS = 24 * 60 * 60 * 1000; // 24 hours

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic =
    pathname.startsWith("/signin") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/s/") ||
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

    // Idle timeout check
    const now = Date.now();
    const lastStr = req.cookies.get(LAST_ACTIVITY_COOKIE)?.value;
    const last = lastStr ? Number(lastStr) : 0;
    if (last && now - last > MAX_IDLE_MS) {
      const url = req.nextUrl.clone();
      url.pathname = "/signin";
      url.searchParams.set("reason", "idle_timeout");
      url.searchParams.set("redirect", pathname);
      const res = NextResponse.redirect(url);
      // Clear cookies
      res.cookies.set({ name: COOKIE, value: "", maxAge: 0, path: "/" });
      res.cookies.set({ name: LAST_ACTIVITY_COOKIE, value: "", maxAge: 0, path: "/" });
      res.headers.set("Cache-Control", "no-store");
      return res;
    }

    const setActivity = (res: NextResponse) => {
      res.cookies.set({
        name: LAST_ACTIVITY_COOKIE,
        value: String(now),
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      });
      return res;
    };

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
            url.pathname = "/403";
            url.searchParams.set("reason", "scope_creative_blocked");
            url.searchParams.set("redirect", pathname);
            return NextResponse.redirect(url);
          }
          const nextRes = setActivity(NextResponse.next());
          // Default page caching for SSR/SSG responses
          nextRes.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
          return nextRes;
        })
        .catch(() => NextResponse.next());
    }
    
    // Multi-tenant guard: terapkan untuk semua API kecuali /api/auth
    const shouldCheckBrandScopeForApi = isApiRoute && !pathname.startsWith("/api/auth");
    if (!shouldCheckBrandScopeForApi) {
      const nextRes = setActivity(NextResponse.next());
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
            // Inject allowed brand scope into request headers for API handlers to consume
            const requestHeaders = new Headers(req.headers);
            if (Array.isArray(data.allowedBrandIds)) {
              requestHeaders.set(
                "x-allowed-brand-ids",
                data.allowedBrandIds.join(",")
              );
            }
            if (data.activeBrandId) {
              requestHeaders.set("x-active-brand-id", String(data.activeBrandId));
            }
            const nextRes = setActivity(
              NextResponse.next({ request: { headers: requestHeaders } })
            );
            nextRes.headers.set(
              "Cache-Control",
              "public, s-maxage=60, stale-while-revalidate=300"
            );
            return nextRes;
          }
        }

        // Jika bukan API route (page navigation), redirect ke forbidden
        if (!pathname.startsWith("/api")) {
          const url = req.nextUrl.clone();
          url.pathname = "/403";
          url.searchParams.set("reason", "brand_scope");
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
          url.pathname = "/403";
          url.searchParams.set("reason", "brand_scope_error");
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
