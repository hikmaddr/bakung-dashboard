import { NextRequest, NextResponse } from "next/server";
import { getAuth, AuthTokenPayload } from "@/lib/auth";
import { getActiveBrandProfile } from "@/lib/brand";
import { z } from "zod";
import { logActivity } from "@/lib/activity";

export type HandlerContext = {
  user: AuthTokenPayload;
  activeBrand: { id: number; slug: string; name: string };
  params: Record<string, string>;
};

type ApiHandlerOptions<T> = {
  schema?: z.Schema<T>;
  handler: (req: NextRequest, body: T, context: HandlerContext) => Promise<Response>;
  requireAuth?: boolean;
  requireBrand?: boolean;
  actionName?: string; // If provided, will automatically log activity on success
  entityType?: string;
};

/**
 * createApiHandler
 * A generic wrapper for Next.js API routes to handle auth, brand check, validation, and error management.
 */
export function createApiHandler<T>({
  schema,
  handler,
  requireAuth = true,
  requireBrand = true,
  actionName,
  entityType,
}: ApiHandlerOptions<T>) {
  return async (req: NextRequest, context: any) => {
    const params = context?.params || {};
    try {
      // 1. Authentication Check
      const auth = await getAuth();
      if (requireAuth && !auth) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
      }

      // 2. Active Brand Check
      const activeBrand = requireBrand ? await getActiveBrandProfile() : null;
      if (requireBrand && !activeBrand) {
        return NextResponse.json({ success: false, message: "No active brand selected" }, { status: 400 });
      }

      // 3. Body Parsing & Validation
      let body: any = null;
      if (["POST", "PUT", "PATCH"].includes(req.method)) {
        const contentType = req.headers.get("content-type") || "";
        
        if (contentType.includes("application/json")) {
          try {
            body = await req.json();
          } catch (e) {
            body = {};
          }
        } else if (contentType.includes("multipart/form-data")) {
          try {
            body = await req.formData();
          } catch (e) {
            body = null;
          }
        }
        
        // Only validate if it's JSON and schema is provided
        if (schema && body && !(body instanceof FormData)) {
          const result = schema.safeParse(body);
          if (!result.success) {
            return NextResponse.json({
              success: false,
              errors: result.error.flatten().fieldErrors,
            }, { status: 400 });
          }
          body = result.data;
        }
      }

      // 4. Execute Handler
      const response = await handler(req, body, { 
        user: auth as AuthTokenPayload, 
        activeBrand: activeBrand as any, 
        params: params
      });

      // 5. Automatic Activity Logging (Optional)
      if (actionName && response.ok && auth) {
        let entityId: number | undefined;
        try {
          // Try to extract entityId from response if it's JSON
          const clone = response.clone();
          const data = await clone.json();
          if (data?.data?.id) entityId = data.data.id;
          else if (data?.id) entityId = data.id;
        } catch {}

        // Log asynchronously, don't wait for it
        logActivity(req, {
          userId: auth.userId,
          action: actionName,
          entity: entityType,
          entityId,
          metadata: { method: req.method, url: req.url }
        }).catch(err => console.error("[createApiHandler] Auto-log failed:", err));
      }

      return response;
    } catch (error: any) {
      console.error(`[API Error] ${req.method} ${req.url}:`, error);
      
      // Generic error response
      return NextResponse.json({
        success: false,
        message: process.env.NODE_ENV === "development" ? error.message : "Internal Server Error",
      }, { status: 500 });
    }
  };
}
