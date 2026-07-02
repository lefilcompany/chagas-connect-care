import { describe, it, expect } from "vitest";
import {
  normalizeMetaName,
  validateTemplateDraft,
  templateDraftSchema,
} from "./templateDraft";

const base = {
  name: "Lembrete de consulta",
  category: "consulta",
  template_kind: "meta" as const,
  body: "Olá {nome_paciente}, sua consulta é amanhã.",
  meta_template_name: "lembrete_consulta",
  meta_language: "pt_BR",
  meta_category: "UTILITY" as const,
  meta_header_type: "none" as const,
  meta_header_text: "",
  meta_footer_text: "",
  meta_buttons: [],
  variable_examples: { nome_paciente: "Maria" },
};

describe("templateDraft", () => {
  it("normalizeMetaName lowercases and strips invalid chars", () => {
    expect(normalizeMetaName("Foo Bar!")).toBe("foo_bar");
    expect(normalizeMetaName("Confirmação-Consulta")).toBe("confirmacao_consulta");
  });

  it("accepts a valid Meta draft", () => {
    const r = validateTemplateDraft(base);
    expect(r.ok).toBe(true);
  });

  it("rejects empty body", () => {
    const r = validateTemplateDraft({ ...base, body: "" });
    if (r.ok) throw new Error("expected validation to fail");
    expect(r.errors.body).toBeTruthy();
  });

  it("rejects invalid meta_template_name", () => {
    const r = validateTemplateDraft({ ...base, meta_template_name: "Foo Bar!" });
    if (r.ok) throw new Error("expected validation to fail");
    expect(r.errors.meta_template_name).toBeTruthy();
  });

  it("requires an example for each variable in the body", () => {
    const r = validateTemplateDraft({
      ...base,
      body: "Olá {nome_paciente}, dia {data_consulta}",
      variable_examples: { nome_paciente: "Maria" },
    });
    if (r.ok) throw new Error("expected validation to fail");
    expect(r.errors["variable_examples.data_consulta"]).toBeTruthy();
  });

  it("does not require meta_template_name for internal templates", () => {
    const r = validateTemplateDraft({
      ...base,
      template_kind: "internal",
      meta_template_name: "",
      variable_examples: {},
    });
    expect(r.ok).toBe(true);
  });

  it("schema has no meta_status field (status is read-only server-side)", () => {
    const shape = (templateDraftSchema._def as any).schema?.shape ?? {};
    expect("meta_status" in shape).toBe(false);
    expect("institution" in shape).toBe(false);
  });
});