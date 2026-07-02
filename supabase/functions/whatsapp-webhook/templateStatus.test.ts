import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createTemplateStatusHandler, TemplateMatch } from "./templateStatus.ts";
import { payloadFingerprint } from "../_shared/metaTemplateStatus.ts";

type UpdateCall = { id: string; patch: Record<string, unknown> };

function makeDeps(opts: {
  match?: TemplateMatch | null;
  byWaba?: TemplateMatch | null;
  byInst?: TemplateMatch | null;
  institution?: string | null;
  duplicateHash?: string | null;
} = {}) {
  const updates: UpdateCall[] = [];
  const events: any[] = [];
  const deps = {
    hasEvent: (h: string) => Promise.resolve(opts.duplicateHash === h),
    recordEvent: (row: any) => { events.push(row); return Promise.resolve(); },
    findByMetaId: (_: string) => Promise.resolve(opts.match ?? null),
    findByWabaNameLang: (_w: string, _n: string, _l: string) => Promise.resolve(opts.byWaba ?? null),
    findByInstitutionNameLang: (_i: string, _n: string, _l: string) => Promise.resolve(opts.byInst ?? null),
    resolveInstitutionByWaba: (_: string) => Promise.resolve(opts.institution ?? null),
    updateTemplate: (id: string, patch: Record<string, unknown>) => {
      updates.push({ id, patch }); return Promise.resolve();
    },
    now: () => new Date("2026-07-02T12:00:00Z"),
  };
  return { deps, updates, events };
}

const baseEntry = { id: "WABA_1", time: 1782910000 };
const approvedChange = {
  field: "message_template_status_update",
  value: {
    event: "APPROVED",
    message_template_id: "META_1",
    message_template_name: "tecnova_lembrete_v1",
    message_template_language: "pt_BR",
    reason: null,
  },
};

const baseMatch: TemplateMatch = {
  id: "local-1",
  institution: "Inst A",
  meta_template_id: "META_1",
  meta_waba_id: "WABA_1",
  meta_language: "pt_BR",
  meta_status: "submitted",
  meta_template_name: "tecnova_lembrete_v1",
};

Deno.test("APPROVED by meta_template_id updates template", async () => {
  const { deps, updates } = makeDeps({ match: baseMatch });
  const out = await createTemplateStatusHandler(deps)(baseEntry, approvedChange);
  assertEquals(out, { processed: true, template_id: "local-1", new_status: "approved" });
  assertEquals(updates.length, 1);
  assertEquals(updates[0].patch.meta_status, "approved");
  assertEquals(updates[0].patch.meta_status_raw, "APPROVED");
  assertEquals(updates[0].patch.meta_last_webhook_at, "2026-07-01T13:26:40.000Z");
});

Deno.test("REJECTED stores rejection reason", async () => {
  const { deps, updates } = makeDeps({ match: baseMatch });
  const out = await createTemplateStatusHandler(deps)(baseEntry, {
    field: "message_template_status_update",
    value: {
      event: "REJECTED",
      message_template_id: "META_1",
      message_template_name: "tecnova_lembrete_v1",
      message_template_language: "pt_BR",
      reason: "INVALID_FORMAT",
    },
  });
  assertEquals(out.processed, true);
  assertEquals(updates[0].patch.meta_status, "rejected");
  assertEquals(updates[0].patch.meta_rejection_reason, "INVALID_FORMAT");
});

Deno.test("duplicate event is not reapplied", async () => {
  const hash = await payloadFingerprint(baseEntry as any, approvedChange as any);
  const { deps, updates } = makeDeps({ match: baseMatch, duplicateHash: hash });
  const out = await createTemplateStatusHandler(deps)(baseEntry, approvedChange);
  assertEquals(out, { processed: false, reason: "duplicate" });
  assertEquals(updates.length, 0);
});

Deno.test("language mismatch does not overwrite", async () => {
  const { deps, updates } = makeDeps({ match: { ...baseMatch, meta_language: "en_US" } });
  const out = await createTemplateStatusHandler(deps)(baseEntry, approvedChange);
  assertEquals(out, { processed: false, reason: "language_mismatch" });
  assertEquals(updates.length, 0);
});

Deno.test("waba mismatch does not overwrite", async () => {
  const { deps, updates } = makeDeps({ match: { ...baseMatch, meta_waba_id: "OTHER" } });
  const out = await createTemplateStatusHandler(deps)(baseEntry, approvedChange);
  assertEquals(out, { processed: false, reason: "waba_mismatch" });
  assertEquals(updates.length, 0);
});

Deno.test("falls back to waba+name+language when no meta_template_id in event", async () => {
  const { deps, updates } = makeDeps({
    match: null,
    byWaba: { ...baseMatch, meta_template_id: null },
  });
  const out = await createTemplateStatusHandler(deps)(baseEntry, {
    field: "message_template_status_update",
    value: {
      event: "APPROVED",
      message_template_name: "tecnova_lembrete_v1",
      message_template_language: "pt_BR",
    },
  });
  assertEquals(out.processed, true);
  assertEquals(updates.length, 1);
});

Deno.test("only name (no waba+lang match) does not update", async () => {
  const { deps, updates } = makeDeps({});
  const out = await createTemplateStatusHandler(deps)(baseEntry, {
    field: "message_template_status_update",
    value: {
      event: "APPROVED",
      message_template_name: "unknown",
      message_template_language: "pt_BR",
    },
  });
  assertEquals(out, { processed: false, reason: "unmatched" });
  assertEquals(updates.length, 0);
});

Deno.test("unknown status never becomes approved", async () => {
  const { deps, updates } = makeDeps({ match: baseMatch });
  const out = await createTemplateStatusHandler(deps)(baseEntry, {
    field: "message_template_status_update",
    value: {
      event: "SOMETHING_NEW",
      message_template_id: "META_1",
      message_template_name: "tecnova_lembrete_v1",
      message_template_language: "pt_BR",
    },
  });
  assertEquals(out, { processed: false, reason: "no_status_change" });
  assertEquals(updates.length, 0);
});
