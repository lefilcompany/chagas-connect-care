// Pure handler for `message_template_status_update` webhook events.
// No Deno.env, no supabase client, no fetch. All I/O is injected.

import {
  mapMetaTemplateStatus,
  MetaStatusChange,
  MetaStatusEntry,
  payloadFingerprint,
} from "../_shared/metaTemplateStatus.ts";

export interface TemplateMatch {
  id: string;
  institution: string;
  meta_template_id: string | null;
  meta_waba_id: string | null;
  meta_language: string | null;
  meta_status: string | null;
  meta_template_name: string | null;
}

export interface TemplateStatusDeps {
  hasEvent(hash: string): Promise<boolean>;
  recordEvent(row: {
    meta_template_id: string | null;
    event: string;
    entry_timestamp: string;
    payload_hash: string;
    payload: unknown;
  }): Promise<void>;
  findByMetaId(id: string): Promise<TemplateMatch | null>;
  findByWabaNameLang(
    waba: string,
    name: string,
    language: string,
  ): Promise<TemplateMatch | null>;
  findByInstitutionNameLang(
    institution: string,
    name: string,
    language: string,
  ): Promise<TemplateMatch | null>;
  resolveInstitutionByWaba(waba: string): Promise<string | null>;
  updateTemplate(id: string, patch: Record<string, unknown>): Promise<void>;
  now(): Date;
}

export type StatusOutcome =
  | { processed: true; template_id: string; new_status: string }
  | { processed: false; reason: string };

export function createTemplateStatusHandler(deps: TemplateStatusDeps) {
  return async function handle(
    entry: MetaStatusEntry,
    change: MetaStatusChange,
  ): Promise<StatusOutcome> {
    const v = change.value ?? {};
    const event = String(v.event ?? "").toUpperCase();
    const metaId = v.message_template_id != null ? String(v.message_template_id) : null;
    const name = v.message_template_name ?? null;
    const language = v.message_template_language ?? null;
    const waba = entry?.id ?? null;
    const entryTs = entry?.time
      ? new Date(entry.time * 1000).toISOString()
      : deps.now().toISOString();

    const hash = await payloadFingerprint(entry, change);
    if (await deps.hasEvent(hash)) {
      return { processed: false, reason: "duplicate" };
    }

    // Match order: meta_template_id → waba+name+lang → institution+name+lang.
    let match: TemplateMatch | null = null;
    if (metaId) {
      match = await deps.findByMetaId(metaId);
    }
    if (!match && waba && name && language) {
      match = await deps.findByWabaNameLang(waba, name, language);
    }
    if (!match && waba && name && language) {
      const institution = await deps.resolveInstitutionByWaba(waba);
      if (institution) {
        match = await deps.findByInstitutionNameLang(institution, name, language);
      }
    }

    if (!match) {
      await deps.recordEvent({
        meta_template_id: metaId,
        event,
        entry_timestamp: entryTs,
        payload_hash: hash,
        payload: { entry, change },
      });
      return { processed: false, reason: "unmatched" };
    }

    // Guardrails: never overwrite across language or WABA collisions.
    if (language && match.meta_language && match.meta_language !== language) {
      await deps.recordEvent({
        meta_template_id: metaId,
        event,
        entry_timestamp: entryTs,
        payload_hash: hash,
        payload: { entry, change, skipped: "language_mismatch" },
      });
      return { processed: false, reason: "language_mismatch" };
    }
    if (waba && match.meta_waba_id && match.meta_waba_id !== waba) {
      await deps.recordEvent({
        meta_template_id: metaId,
        event,
        entry_timestamp: entryTs,
        payload_hash: hash,
        payload: { entry, change, skipped: "waba_mismatch" },
      });
      return { processed: false, reason: "waba_mismatch" };
    }

    const mapped = mapMetaTemplateStatus(event);
    if (!mapped) {
      await deps.recordEvent({
        meta_template_id: metaId,
        event,
        entry_timestamp: entryTs,
        payload_hash: hash,
        payload: { entry, change, skipped: "no_status_change" },
      });
      return { processed: false, reason: "no_status_change" };
    }

    const patch: Record<string, unknown> = {
      meta_status: mapped,
      meta_status_raw: event,
      meta_last_webhook_at: entryTs,
    };
    if (metaId && !match.meta_template_id) patch.meta_template_id = metaId;
    if (waba && !match.meta_waba_id) patch.meta_waba_id = waba;
    if (event === "REJECTED") {
      patch.meta_rejection_reason = v.reason ?? null;
      patch.meta_rejection_info = { reason: v.reason ?? null, at: entryTs, event };
    }

    await deps.updateTemplate(match.id, patch);
    await deps.recordEvent({
      meta_template_id: metaId ?? match.meta_template_id,
      event,
      entry_timestamp: entryTs,
      payload_hash: hash,
      payload: { entry, change },
    });

    return { processed: true, template_id: match.id, new_status: mapped };
  };
}