import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { runSync, LocalTemplateRow, SyncDeps, CallerContext } from "./handler.ts";

function makeDeps(overrides: Partial<SyncDeps> & {
  pages?: Array<{ data: any[]; nextUrl: string | null }>;
  templateById?: LocalTemplateRow | null;
  waba?: string | null;
  localByItem?: (institution: string, item: any) => LocalTemplateRow | null;
}) {
  const updates: Array<{ id: string; patch: Record<string, unknown> }> = [];
  const pages = overrides.pages ?? [];
  let idx = 0;
  const deps: SyncDeps = {
    fetchPage: (_url: string) => {
      const p = pages[idx++];
      if (!p) return Promise.resolve({ ok: true, status: 200, data: [], nextUrl: null });
      return Promise.resolve({ ok: true, status: 200, data: p.data, nextUrl: p.nextUrl });
    },
    resolveWabaForInstitution: (_: string) => Promise.resolve(overrides.waba === undefined ? "WABA_1" : overrides.waba),
    loadTemplateById: (_: string) => Promise.resolve(overrides.templateById ?? null),
    findLocalRow: (i: string, item: any) =>
      Promise.resolve(overrides.localByItem ? overrides.localByItem(i, item) : null),
    updateTemplate: (id, patch) => { updates.push({ id, patch }); return Promise.resolve(); },
    now: () => new Date("2026-07-02T12:00:00Z"),
    graphVersion: "v25.0",
    fallbackWaba: null,
    ...overrides,
  } as SyncDeps;
  return { deps, updates };
}

const adminCaller: CallerContext = { userId: "u1", role: "admin", institution: "Inst A" };
const superCaller: CallerContext = { userId: "u2", role: "superadmin", institution: null };

const rowA: LocalTemplateRow = {
  id: "local-1", institution: "Inst A",
  meta_template_id: "META_1", meta_template_name: "t1", meta_language: "pt_BR",
  meta_waba_id: "WABA_1", meta_status: "submitted",
  meta_footer_text: null, body_patient: "Olá", body_contact: null, body_segment: null,
};

Deno.test("local_template_id updates only that template", async () => {
  const { deps, updates } = makeDeps({
    templateById: rowA,
    pages: [{ data: [
      { id: "META_1", name: "t1", language: "pt_BR", status: "APPROVED", components: [{ type: "BODY", text: "Olá" }] },
      { id: "META_OTHER", name: "other", language: "pt_BR", status: "APPROVED", components: [] },
    ], nextUrl: null }],
    localByItem: (_i, it) => (it.id === "META_1" ? rowA : null),
  });
  const out = await runSync(deps, adminCaller, { local_template_id: "local-1" });
  assertEquals(out.ok, true);
  if (!out.ok) return;
  assertEquals(out.updated, 1);
  assertEquals(updates.length, 1);
  assertEquals(updates[0].patch.meta_status, "approved");
});

Deno.test("pagination walks multiple pages", async () => {
  const { deps, updates } = makeDeps({
    pages: [
      { data: [{ id: "M1", name: "n1", language: "pt_BR", status: "APPROVED", components: [] }], nextUrl: "https://graph/next" },
      { data: [{ id: "M2", name: "n2", language: "pt_BR", status: "REJECTED", components: [] }], nextUrl: null },
    ],
    localByItem: (_i, it) => ({ ...rowA, id: `local-${it.id}`, meta_template_id: it.id, meta_template_name: it.name }),
  });
  const out = await runSync(deps, adminCaller, {});
  assertEquals(out.ok, true);
  if (!out.ok) return;
  assertEquals(out.pages, 2);
  assertEquals(out.updated, 2);
  assertEquals(updates.length, 2);
});

Deno.test("admin cannot sync another institution", async () => {
  const { deps } = makeDeps({});
  const out = await runSync(deps, adminCaller, { institution: "Inst B" });
  assertEquals(out, { ok: false, status: 403, error: "FORBIDDEN" });
});

Deno.test("superadmin can sync a target institution", async () => {
  const { deps } = makeDeps({ pages: [{ data: [], nextUrl: null }] });
  const out = await runSync(deps, superCaller, { institution: "Inst B" });
  assertEquals(out.ok, true);
});

Deno.test("missing WABA returns 400", async () => {
  const { deps } = makeDeps({ waba: null });
  const out = await runSync(deps, adminCaller, {});
  assertEquals(out, { ok: false, status: 400, error: "WABA_NOT_CONFIGURED" });
});
