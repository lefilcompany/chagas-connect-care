// Pure helpers for mapping Meta message_template_status_update events to the
// project's internal status strings.

import { sha256Hex, stableStringify } from "./metaTemplatePayload.ts";

export const META_TEMPLATE_STATUS_MAP: Record<string, string> = {
  PENDING: "submitted",
  IN_APPEAL: "submitted",
  APPROVED: "approved",
  REJECTED: "rejected",
  PAUSED: "paused",
  DISABLED: "disabled",
  PENDING_DELETION: "disabled",
  DELETED: "disabled",
};

/** Returns the internal status, or `null` when the event is unknown. */
export function mapMetaTemplateStatus(event: string | null | undefined): string | null {
  if (!event) return null;
  const key = String(event).toUpperCase();
  return META_TEMPLATE_STATUS_MAP[key] ?? null;
}

export type MetaStatusChange = {
  field: string;
  value: {
    event?: string;
    message_template_id?: string | number;
    message_template_name?: string;
    message_template_language?: string;
    reason?: string | null;
    [k: string]: unknown;
  };
};

export type MetaStatusEntry = {
  id?: string;
  time?: number;
  [k: string]: unknown;
};

/** Deterministic hash for idempotency (`whatsapp_template_events.payload_hash`). */
export async function payloadFingerprint(
  entry: MetaStatusEntry,
  change: MetaStatusChange,
): Promise<string> {
  const v = change.value ?? {};
  return sha256Hex(
    stableStringify({
      waba: entry?.id ?? null,
      time: entry?.time ?? null,
      field: change.field,
      event: v.event ?? null,
      id: v.message_template_id != null ? String(v.message_template_id) : null,
      name: v.message_template_name ?? null,
      language: v.message_template_language ?? null,
      reason: v.reason ?? null,
    }),
  );
}