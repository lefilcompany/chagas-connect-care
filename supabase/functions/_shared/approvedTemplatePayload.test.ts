import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildApprovedTemplateMessage } from "./approvedTemplatePayload.ts";

const baseTemplate = {
  meta_template_name: "tecnova_lembrete_consulta_v1",
  meta_language: "pt_BR",
  meta_status: "approved" as const,
  meta_has_local_differences: false,
  meta_definition: {
    components: [
      {
        type: "BODY",
        text: "Olá, {{1}}. Sua consulta será em {{2}}.",
      },
    ],
  },
  meta_header_type: null as string | null,
  meta_body_parameter_order: ["nome_paciente", "data_consulta"],
  institution: "tecnova",
};

Deno.test("builds an approved text template with positional body params", () => {
  const r = buildApprovedTemplateMessage({
    template: baseTemplate,
    to: "5581999999999",
    variables: {
      nome_paciente: "Maria",
      data_consulta: "10/07/2026",
    },
  });
  assert(r.ok, `expected ok, got ${(r as any).errorCode}`);
  if (!r.ok) return;
  assertEquals(r.payload, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: "5581999999999",
    type: "template",
    template: {
      name: "tecnova_lembrete_consulta_v1",
      language: { code: "pt_BR" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: "Maria" },
            { type: "text", text: "10/07/2026" },
          ],
        },
      ],
    },
  });
});

Deno.test("rejects a non-approved template", () => {
  const r = buildApprovedTemplateMessage({
    template: { ...baseTemplate, meta_status: "submitted" },
    to: "5581999999999",
    variables: { nome_paciente: "M", data_consulta: "1/1" },
  });
  assert(!r.ok);
  if (r.ok) return;
  assertEquals(r.errorCode, "TEMPLATE_NOT_APPROVED");
});

Deno.test("sends even when local editor differs from approved Meta version", () => {
  const r = buildApprovedTemplateMessage({
    template: { ...baseTemplate, meta_has_local_differences: true },
    to: "5581999999999",
    variables: { nome_paciente: "M", data_consulta: "1/1" },
  });
  assert(r.ok);
});

Deno.test("rejects when meta_definition is missing", () => {
  const r = buildApprovedTemplateMessage({
    template: { ...baseTemplate, meta_definition: null },
    to: "5581999999999",
    variables: { nome_paciente: "M", data_consulta: "1/1" },
  });
  assert(!r.ok);
  if (r.ok) return;
  assertEquals(r.errorCode, "TEMPLATE_DEFINITION_MISSING");
});

Deno.test("rejects when template name is missing", () => {
  const r = buildApprovedTemplateMessage({
    template: { ...baseTemplate, meta_template_name: null },
    to: "5581999999999",
    variables: { nome_paciente: "M", data_consulta: "1/1" },
  });
  assert(!r.ok);
  if (r.ok) return;
  assertEquals(r.errorCode, "TEMPLATE_NAME_MISSING");
});

Deno.test("rejects when language is missing", () => {
  const r = buildApprovedTemplateMessage({
    template: { ...baseTemplate, meta_language: "" },
    to: "5581999999999",
    variables: { nome_paciente: "M", data_consulta: "1/1" },
  });
  assert(!r.ok);
  if (r.ok) return;
  assertEquals(r.errorCode, "TEMPLATE_LANGUAGE_MISSING");
});

Deno.test("rejects when positional body has no meta_body_parameter_order", () => {
  const r = buildApprovedTemplateMessage({
    template: { ...baseTemplate, meta_body_parameter_order: [] },
    to: "5581999999999",
    variables: { nome_paciente: "M", data_consulta: "1/1" },
  });
  assert(!r.ok);
  if (r.ok) return;
  assertEquals(r.errorCode, "TEMPLATE_PARAMETER_ORDER_MISSING");
});

Deno.test("rejects when a required semantic variable is missing", () => {
  const r = buildApprovedTemplateMessage({
    template: baseTemplate,
    to: "5581999999999",
    variables: { nome_paciente: "Maria" }, // missing data_consulta
  });
  assert(!r.ok);
  if (r.ok) return;
  assertEquals(r.errorCode, "TEMPLATE_PARAMETER_MISSING");
});

Deno.test("rejects unresolved {placeholder} left in a variable", () => {
  const r = buildApprovedTemplateMessage({
    template: baseTemplate,
    to: "5581999999999",
    variables: { nome_paciente: "{nome_paciente}", data_consulta: "1/1" },
  });
  assert(!r.ok);
  if (r.ok) return;
  assertEquals(r.errorCode, "TEMPLATE_PARAMETER_MISSING");
});

Deno.test("emits IMAGE header using media_id (never header_handle)", () => {
  const r = buildApprovedTemplateMessage({
    template: {
      ...baseTemplate,
      meta_header_type: "image",
      meta_definition: {
        components: [
          { type: "HEADER", format: "IMAGE" },
          { type: "BODY", text: "Olá, {{1}}. Sua consulta será em {{2}}." },
        ],
      },
    },
    to: "5581999999999",
    variables: { nome_paciente: "Maria", data_consulta: "10/07/2026" },
    header: { format: "image", media_id: "MEDIA_ID_123" },
  });
  assert(r.ok);
  if (!r.ok) return;
  const comps = (r.payload.template as any).components;
  assertEquals(comps[0], {
    type: "header",
    parameters: [{ type: "image", image: { id: "MEDIA_ID_123" } }],
  });
});

Deno.test("rejects when media header is declared but media_id is absent", () => {
  const r = buildApprovedTemplateMessage({
    template: { ...baseTemplate, meta_header_type: "image" },
    to: "5581999999999",
    variables: { nome_paciente: "Maria", data_consulta: "10/07/2026" },
  });
  assert(!r.ok);
  if (r.ok) return;
  assertEquals(r.errorCode, "MEDIA_NOT_UPLOADED");
});

Deno.test("body-only template with no positional placeholders emits no body params", () => {
  const r = buildApprovedTemplateMessage({
    template: {
      ...baseTemplate,
      meta_body_parameter_order: [],
      meta_definition: {
        components: [{ type: "BODY", text: "Bem-vindo à Tecnova." }],
      },
    },
    to: "5581999999999",
    variables: {},
  });
  assert(r.ok);
  if (!r.ok) return;
  assertEquals((r.payload.template as any).components, []);
});