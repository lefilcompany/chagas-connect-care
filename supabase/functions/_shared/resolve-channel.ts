// Resolves the active WhatsApp channel (phone_number_id + waba_id + token) for
// a given institution. Falls back to env-provided defaults when no channel row
// exists yet, so single-tenant setups keep working.
//
// Returns a Response (400/404/500) on failure and a ChannelContext on success.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { jsonError } from "./http.ts";

const FALLBACK_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") ?? "";
const FALLBACK_WABA_ID =
  Deno.env.get("WHATSAPP_WABA_ID") ??
  Deno.env.get("WHATSAPP_BUSINESS_ACCOUNT_ID") ??
  "";
const FALLBACK_TOKEN = Deno.env.get("WHATSAPP_TOKEN") ?? "";
const RAW_GRAPH_VERSION = Deno.env.get("WHATSAPP_GRAPH_VERSION") ?? "v25.0";
const GRAPH_VERSION = /^v\d+\.\d+$/.test(RAW_GRAPH_VERSION) ? RAW_GRAPH_VERSION : "v25.0";

export interface ChannelContext {
  id: string | null;
  institution: string | null;
  phoneNumberId: string;
  wabaId: string;
  token: string;
  graphVersion: string;
  mode: string;
  status: string;
  displayPhoneNumber: string | null;
  displayName: string | null;
  source: "db" | "env";
}

export interface ChannelRow {
  id: string;
  institution: string | null;
  phone_number_id: string | null;
  waba_id: string | null;
  display_phone_number: string | null;
  display_name: string | null;
  mode: string | null;
  status: string | null;
}

function graphBase(): string {
  return `https://graph.facebook.com/${GRAPH_VERSION}`;
}

export function graphUrl(path: string): string {
  const p = path.startsWith("/") ? path.slice(1) : path;
  return `${graphBase()}/${p}`;
}

/**
 * Load the active channel row for an institution, or fall back to env config.
 * Superadmins may pass `institution=null` when explicitly targeting the
 * env-level channel (single-tenant maintenance flows).
 */
export async function resolveChannel(
  service: SupabaseClient,
  institution: string | null,
): Promise<ChannelContext | Response> {
  let row: ChannelRow | null = null;
  if (institution) {
    const { data, error } = await service
      .from("whatsapp_channels")
      .select("id, institution, phone_number_id, waba_id, display_phone_number, display_name, mode, status")
      .eq("institution", institution)
      .maybeSingle();
    if (error) {
      return jsonError(500, "INTERNAL_ERROR", `Failed to load channel: ${error.message}`);
    }
    row = (data as ChannelRow | null) ?? null;
  }

  const phoneNumberId = row?.phone_number_id || FALLBACK_PHONE_NUMBER_ID;
  const wabaId = row?.waba_id || FALLBACK_WABA_ID;
  const token = FALLBACK_TOKEN; // token stays env-only for now
  const status = (row?.status ?? "active").toLowerCase();

  if (!phoneNumberId) {
    return jsonError(400, "CHANNEL_MISCONFIGURED", "WhatsApp phone_number_id is not configured.", {
      institution,
    });
  }
  if (!token) {
    return jsonError(400, "CHANNEL_MISCONFIGURED", "WhatsApp token is not configured.");
  }
  if (row && status === "disabled") {
    return jsonError(409, "CHANNEL_DISABLED", "WhatsApp channel is disabled for this institution.", {
      institution,
    });
  }

  return {
    id: row?.id ?? null,
    institution: row?.institution ?? institution,
    phoneNumberId,
    wabaId,
    token,
    graphVersion: GRAPH_VERSION,
    mode: row?.mode ?? "production",
    status: row?.status ?? "active",
    displayPhoneNumber: row?.display_phone_number ?? null,
    displayName: row?.display_name ?? null,
    source: row ? "db" : "env",
  };
}

/**
 * URL for /{phone_number_id}/messages under the resolved channel.
 */
export function messagesUrl(channel: ChannelContext): string {
  return graphUrl(`${channel.phoneNumberId}/messages`);
}

/**
 * URL for /{waba_id}/message_templates under the resolved channel.
 */
export function templatesUrl(channel: ChannelContext): string {
  if (!channel.wabaId) {
    throw new Error("Channel is missing waba_id.");
  }
  return graphUrl(`${channel.wabaId}/message_templates`);
}