import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildMetaTemplateCreationPayload,
  stableStringify,
} from "./metaTemplatePayload.ts";

Deno.test("builds a happy-path text template with header, body vars and footer", () => {
  const r = buildMetaTemplateCreationPayload({
    name: "tecnova_lembrete_consulta_v1",
    language: "pt_BR",
    category: "UTILITY",
    body: "Olá, {nome_paciente}. Sua consulta será em {data_consulta}, às {hora_consulta}.",
    header: { type: "text", text: "Lembrete de consulta" },
    footer: "Tecnova",
    variableExamples: {
      nome_paciente: "Maria",
      data_consulta: "10/07/2026",
      hora_consulta: "14:30",
    },
  });
  assert(r.ok, "expected ok=true");
  if (!r.ok) return;
  assertEquals(r.order, ["nome_paciente", "data_consulta", "hora_consulta"]);
  assertEquals(r.payload.parameter_format, "POSITIONAL");
  assertEquals(r.payload.components[0], {
    type: "HEADER",
    format: "TEXT",
    text: "Lembrete de consulta",
  });
  assertEquals(r.payload.components[1], {
    type: "BODY",
    text: "Olá, {{1}}. Sua consulta será em {{2}}, às {{3}}.",
    example: { body_text: [["Maria", "10/07/2026", "14:30"]] },
  });
  assertEquals(r.payload.components[2], { type: "FOOTER", text: "Tecnova" });
});

Deno.test("rejects empty body", () => {
  const r = buildMetaTemplateCreationPayload({
    name: "x", language: "pt_BR", category: "UTILITY", body: "  ",
    variableExamples: {},
  });
  assert(!r.ok);
  if (r.ok) return;
  assert(r.errors.body);
});

Deno.test("rejects missing variable examples", () => {
  const r = buildMetaTemplateCreationPayload({
    name: "x", language: "pt_BR", category: "UTILITY",
    body: "Olá {nome_paciente}",
    variableExamples: {},
  });
  assert(!r.ok);
  if (r.ok) return;
  assert(r.errors["variable_examples.nome_paciente"]);
});

Deno.test("rejects footer > 60 chars", () => {
  const r = buildMetaTemplateCreationPayload({
    name: "x", language: "pt_BR", category: "UTILITY",
    body: "Oi", footer: "x".repeat(61), variableExamples: {},
  });
  assert(!r.ok);
  if (r.ok) return;
  assert(r.errors.footer);
});

Deno.test("rejects invalid technical name", () => {
  const r = buildMetaTemplateCreationPayload({
    name: "Foo Bar!", language: "pt_BR", category: "UTILITY",
    body: "Oi", variableExamples: {},
  });
  assert(!r.ok);
  if (r.ok) return;
  assert(r.errors.name);
});

Deno.test("is deterministic across calls", () => {
  const input = {
    name: "n_a", language: "pt_BR", category: "UTILITY" as const,
    body: "Oi {a} e {b}", variableExamples: { a: "1", b: "2" },
  };
  const a = buildMetaTemplateCreationPayload(input);
  const b = buildMetaTemplateCreationPayload(input);
  assert(a.ok && b.ok);
  if (!(a.ok && b.ok)) return;
  assertEquals(stableStringify(a.payload), stableStringify(b.payload));
});

Deno.test("preserves variable order by first appearance and dedupes", () => {
  const r = buildMetaTemplateCreationPayload({
    name: "n_a", language: "pt_BR", category: "UTILITY",
    body: "{b} depois {a} de novo {b}",
    variableExamples: { a: "A", b: "B" },
  });
  assert(r.ok);
  if (!r.ok) return;
  assertEquals(r.order, ["b", "a"]);
  assertEquals(r.payload.components[0], {
    type: "BODY",
    text: "{{1}} depois {{2}} de novo {{1}}",
    example: { body_text: [["B", "A"]] },
  });
});
