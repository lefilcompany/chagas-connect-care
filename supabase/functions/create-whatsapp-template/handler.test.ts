import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createHandler, type HandlerDeps, type TemplateRow, type UserContext } from "./handler.ts";

type Overrides = Partial<HandlerDeps> & {
  user?: UserContext | null;
  template?: TemplateRow | null;
  waba?: { wabaId: string } | null;
  existing?: Awaited<ReturnType<HandlerDeps["findByIdempotencyKey"]>>;
  meta?: Awaited<ReturnType<HandlerDeps["callMeta"]>>;
  metaThrows?: Error;
};

function makeTemplate(over: Partial<TemplateRow> = {}): TemplateRow {
  return {
    id: "tpl-1",
    institution: "Inst A",
    template_kind: "meta",
    meta_status: "not_submitted",
    meta_template_name: "tecnova_lembrete_v1",
    meta_language: "pt_BR",
    meta_category: "UTILITY",
    body: "Olá, {nome_paciente}.",
    meta_header_type: "text",
    meta_header_text: "Lembrete",
    meta_header_handle: null,
    meta_footer_text: "Tecnova",
    meta_buttons: [],
    meta_variable_examples: { nome_paciente: "Maria" },
    meta_version: 1,
    meta_idempotency_key: null,
    meta_template_id: null,
    meta_submitted_at: null,
    meta_waba_id: null,
    ...over,
  };
}

function makeDeps(o: Overrides = {}) {
  const persisted: Array<{ id: string; patch: Record<string, unknown> }> = [];
  const errored: Array<{ id: string; patch: Record<string, unknown> }> = [];
  const metaCalls: Array<{ waba: string; payload: unknown }> = [];
  const deps: HandlerDeps = {
    loadUser: o.loadUser ??
      (async () => o.user ?? {
        userId: "u-1", isSuperadmin: false, isAdmin: true, institution: "Inst A",
      }),
    loadTemplate: o.loadTemplate ??
      (async () => ("template" in o ? (o.template ?? null) : makeTemplate())),
    loadWabaFor: o.loadWabaFor ??
      (async () => ("waba" in o ? o.waba ?? null : { wabaId: "WABA-A" })),
    findByIdempotencyKey: o.findByIdempotencyKey ?? (async () => o.existing ?? null),
    persistSubmission: o.persistSubmission ?? (async (id, patch) => {
      persisted.push({ id, patch });
    }),
    persistError: o.persistError ?? (async (id, patch) => {
      errored.push({ id, patch });
    }),
    callMeta: o.callMeta ?? (async (waba, payload) => {
      metaCalls.push({ waba, payload });
      if (o.metaThrows) throw o.metaThrows;
      return o.meta ?? { ok: true, status: 200, body: { id: "meta-999", status: "PENDING" } };
    }),
    now: o.now ?? (() => new Date("2026-07-02T12:00:00Z")),
  };
  return { deps, persisted, errored, metaCalls };
}

function req(body: unknown, headers: Record<string, string> = { Authorization: "Bearer jwt" }) {
  return new Request("http://x/functions/v1/create-whatsapp-template", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

Deno.test("happy path: valid draft is submitted, persisted and returns 200", async () => {
  const { deps, persisted, metaCalls } = makeDeps();
  const res = await createHandler(deps)(req({ local_template_id: "tpl-1" }));
  assertEquals(res.status, 200);
  const j = await res.json();
  assertEquals(j.ok, true);
  assertEquals(j.meta_template_id, "meta-999");
  assertEquals(j.meta_status, "submitted");
  assertEquals(j.submitted_at, "2026-07-02T12:00:00.000Z");
  assertEquals(metaCalls.length, 1);
  assertEquals(metaCalls[0].waba, "WABA-A");
  assertEquals(persisted.length, 1);
  assertEquals(persisted[0].patch.meta_status, "submitted");
  assertEquals(persisted[0].patch.meta_template_id, "meta-999");
  assertEquals(persisted[0].patch.meta_submitted_by, "u-1");
  assertEquals(persisted[0].patch.meta_waba_id, "WABA-A");
  assert(persisted[0].patch.meta_idempotency_key);
});

Deno.test("missing local_template_id returns 400 LOCAL_TEMPLATE_ID_REQUIRED and no Meta call", async () => {
  const { deps, metaCalls } = makeDeps();
  const res = await createHandler(deps)(req({}));
  assertEquals(res.status, 400);
  assertEquals((await res.json()).error_code, "LOCAL_TEMPLATE_ID_REQUIRED");
  assertEquals(metaCalls.length, 0);
});

Deno.test("missing auth header returns 401", async () => {
  const { deps } = makeDeps();
  const r = new Request("http://x", { method: "POST", body: "{}" });
  const res = await createHandler(deps)(r);
  assertEquals(res.status, 401);
});

Deno.test("non-admin returns 403", async () => {
  const { deps } = makeDeps({
    user: { userId: "u-1", isSuperadmin: false, isAdmin: false, institution: "Inst A" },
  });
  const res = await createHandler(deps)(req({ local_template_id: "tpl-1" }));
  assertEquals(res.status, 403);
});

Deno.test("admin from another institution returns 403", async () => {
  const { deps, metaCalls } = makeDeps({
    user: { userId: "u-1", isSuperadmin: false, isAdmin: true, institution: "Inst B" },
  });
  const res = await createHandler(deps)(req({ local_template_id: "tpl-1" }));
  assertEquals(res.status, 403);
  assertEquals(metaCalls.length, 0);
});

Deno.test("template not found returns 404", async () => {
  const { deps } = makeDeps({ template: null });
  const res = await createHandler(deps)(req({ local_template_id: "missing" }));
  assertEquals(res.status, 404);
});

Deno.test("already-submitted template with different payload returns 409", async () => {
  const tpl = makeTemplate({ meta_status: "submitted" });
  const { deps, metaCalls } = makeDeps({ template: tpl });
  const res = await createHandler(deps)(req({ local_template_id: "tpl-1" }));
  assertEquals(res.status, 409);
  assertEquals((await res.json()).error_code, "ALREADY_SUBMITTED");
  assertEquals(metaCalls.length, 0);
});

Deno.test("invalid body (missing variable example) returns 400 TEMPLATE_INVALID and no Meta call", async () => {
  const tpl = makeTemplate({ meta_variable_examples: {} });
  const { deps, metaCalls } = makeDeps({ template: tpl });
  const res = await createHandler(deps)(req({ local_template_id: "tpl-1" }));
  assertEquals(res.status, 400);
  const j = await res.json();
  assertEquals(j.error_code, "TEMPLATE_INVALID");
  assert(j.errors["variable_examples.nome_paciente"]);
  assertEquals(metaCalls.length, 0);
});

Deno.test("Meta error persists error state and returns sanitized 502", async () => {
  const { deps, errored } = makeDeps({
    meta: {
      ok: false,
      status: 400,
      body: { error: { message: "raw", error_user_msg: "Categoria inválida", code: 132000, fbtrace_id: "SECRET" } },
    },
  });
  const res = await createHandler(deps)(req({ local_template_id: "tpl-1" }));
  assertEquals(res.status, 502);
  const j = await res.json();
  assertEquals(j.error_code, "META_ERROR");
  assertEquals(j.error, "Categoria inválida");
  assertEquals(j.meta_error.code, 132000);
  assertEquals(j.meta_error.fbtrace_id, undefined);
  assertEquals(errored.length, 1);
  assertEquals(errored[0].patch.meta_status, "error");
});

Deno.test("Meta PENDING maps to persisted meta_status=submitted", async () => {
  const { deps, persisted } = makeDeps({
    meta: { ok: true, status: 200, body: { id: "m", status: "PENDING" } },
  });
  const res = await createHandler(deps)(req({ local_template_id: "tpl-1" }));
  assertEquals(res.status, 200);
  assertEquals(persisted[0].patch.meta_status, "submitted");
});

Deno.test("idempotency: replays previous result without calling Meta", async () => {
  const { deps, metaCalls } = makeDeps({
    existing: {
      id: "tpl-1",
      meta_template_id: "meta-cache",
      meta_status: "submitted",
      meta_submitted_at: "2026-07-01T10:00:00.000Z",
    },
  });
  const res = await createHandler(deps)(req({ local_template_id: "tpl-1" }));
  assertEquals(res.status, 200);
  const j = await res.json();
  assertEquals(j.deduplicated, true);
  assertEquals(j.meta_template_id, "meta-cache");
  assertEquals(metaCalls.length, 0);
});

Deno.test("WABA missing returns 400 WABA_NOT_CONFIGURED", async () => {
  const { deps } = makeDeps({ waba: null });
  const res = await createHandler(deps)(req({ local_template_id: "tpl-1" }));
  assertEquals(res.status, 400);
  assertEquals((await res.json()).error_code, "WABA_NOT_CONFIGURED");
});

Deno.test("IMAGE header without handle returns 400 TEMPLATE_INVALID and no Meta call", async () => {
  const tpl = makeTemplate({
    meta_header_type: "image",
    meta_header_text: "",
    meta_header_handle: null,
  });
  const { deps, metaCalls } = makeDeps({ template: tpl });
  const res = await createHandler(deps)(req({ local_template_id: "tpl-1" }));
  assertEquals(res.status, 400);
  const j = await res.json();
  assertEquals(j.error_code, "TEMPLATE_INVALID");
  assert(j.errors.header);
  assertEquals(metaCalls.length, 0);
});

Deno.test("IMAGE header with handle emits HEADER component with header_handle", async () => {
  const tpl = makeTemplate({
    meta_header_type: "image",
    meta_header_text: "",
    meta_header_handle: "HDL-abc",
  });
  const { deps, metaCalls } = makeDeps({ template: tpl });
  const res = await createHandler(deps)(req({ local_template_id: "tpl-1" }));
  assertEquals(res.status, 200);
  const payload = metaCalls[0].payload as { components: Array<Record<string, unknown>> };
  const header = payload.components.find((c) => c.type === "HEADER");
  assertEquals(header?.format, "IMAGE");
  assertEquals((header?.example as { header_handle?: string[] })?.header_handle, ["HDL-abc"]);
});
