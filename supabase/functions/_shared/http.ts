// Standardized HTTP helpers for WhatsApp / Superadmin edge functions.
// Every response goes through here so the contract stays consistent across
// functions and matches what the frontend (src/lib/whatsapp.ts) expects.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  structuredError,
  type WhatsAppErrorCodeValue,
  type WhatsAppStructuredError,
} from "./whatsapp-errors.ts";

const JSON_HEADERS = { ...corsHeaders, "Content-Type": "application/json" } as const;

export function handleCorsPreflight(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return null;
}

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export function jsonOk<T extends Record<string, unknown>>(
  data: T,
  status = 200,
): Response {
  return jsonResponse(status, { ok: true, ...data });
}

export function jsonError(
  status: number,
  code: WhatsAppErrorCodeValue,
  message: string,
  details?: Record<string, unknown>,
): Response {
  const body: WhatsAppStructuredError = structuredError(code, message, details);
  return jsonResponse(status, body);
}

/**
 * Wrap a handler with CORS + structured error fallback so no function ever
 * leaks an unhandled exception as an opaque 500.
 */
export function withEdgeHandler(
  handler: (req: Request) => Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    const pre = handleCorsPreflight(req);
    if (pre) return pre;
    try {
      return await handler(req);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[edge] unhandled error:", message);
      return jsonError(500, "INTERNAL_ERROR", message);
    }
  };
}

export { corsHeaders };