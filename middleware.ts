import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Helper: verifikasi JWT HS256 menggunakan Web Crypto (Edge runtime)
async function verifyJwtHS256(token: string, secret: string): Promise<{ valid: boolean; payload?: any }> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return { valid: false };
    const [headerB64, payloadB64, signatureB64] = parts;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const data = `${headerB64}.${payloadB64}`;
    const signature = await crypto.subtle.sign("HMAC", key, enc.encode(data));
    const signatureUrl = toBase64Url(new Uint8Array(signature));
    if (signatureUrl !== signatureB64) return { valid: false };
    const payloadJson = JSON.parse(base64UrlDecode(payloadB64));
    const nowSec = Math.floor(Date.now() / 1000);
    if (typeof payloadJson?.exp === "number" && payloadJson.exp < nowSec) return { valid: false };
    return { valid: true, payload: payloadJson };
  } catch {
    return { valid: false };
  }
}

function toBase64Url(bytes: Uint8Array): string {
  // Convert bytes to standard base64
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);
  // To base64url
  return base64.replace(/=+/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64UrlDecode(b64url: string): string {
  // To standard base64
  let b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4;
  if (pad) b64 += "=".repeat(4 - pad);
  const decoded = atob(b64);
  return decoded;
}

// Minimal guard: hanya buka /signin dan /api/auth (plus aset Next)
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api");

  const isPublic =
    pathname.startsWith("/signin") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/branding") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/fonts") ||
    pathname.startsWith("/uploads") ||
    pathname === "/manifest.json";

  if (isPublic) {
    return NextResponse.next();
  }

  // Dukung transisi dari cookie lama ke baru: "token" atau "auth_token"
  const cookieLegacy = req.cookies.get("token")?.value || null;
  const cookieJwt = req.cookies.get("auth_token")?.value || null;
  let token: string | null = null;
  let isTokenValid = false;
  if (cookieJwt) {
    const secret = process.env.JWT_SECRET || "dev_secret_change_me";
    const v = await verifyJwtHS256(cookieJwt, secret);
    isTokenValid = !!v.valid;
    token = isTokenValid ? cookieJwt : null;
  } else if (cookieLegacy) {
    // Biarkan legacy token lewat tanpa verifikasi untuk kompatibilitas lama
    token = cookieLegacy;
    isTokenValid = !!token;
  }
  if (isApi) {
    // Untuk request API (selain /api/auth), balas 401 JSON bila tidak ada token
    const isAuthApi = pathname.startsWith("/api/auth");
    if (!isAuthApi && !token) {
      const res = NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
      res.headers.set("Cache-Control", "no-store");
      return res;
    }
    return NextResponse.next();
  } else {
    // Untuk halaman biasa, redirect ke /signin bila tidak ada token
    if (!token) {
      const url = req.nextUrl.clone();
      url.pathname = "/signin";
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }
}

export const config = {
  matcher: ["/:path*"],
};
