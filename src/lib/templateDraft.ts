import { z } from "zod";
import { extractSemanticKeys } from "./metaVariables";
import type { TemplateKind } from "./templates";

export const META_NAME_RE = /^[a-z0-9_]+$/;

/** Coerces any string to a Meta-valid technical name (lowercase, `[a-z0-9_]`). */
export function normalizeMetaName(input: string): string {
  return (input ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 512);
}

export const buttonSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("quick_reply"), text: z.string().trim().min(1).max(25) }),
  z.object({
    type: z.literal("url"),
    text: z.string().trim().min(1).max(25),
    url: z.string().trim().url(),
  }),
  z.object({
    type: z.literal("phone_number"),
    text: z.string().trim().min(1).max(25),
    phone_number: z.string().trim().min(3),
  }),
]);

export type TemplateDraftButton = z.infer<typeof buttonSchema>;

export const templateDraftSchema = z
  .object({
    name: z.string().trim().min(1, "Informe um nome para o modelo").max(120),
    description: z.string().trim().max(500).optional().default(""),
    category: z.string().trim().min(1).default("geral"),
    template_kind: z.enum(["internal", "meta"]),
    body: z.string().trim().min(1, "O corpo da mensagem não pode ficar vazio"),
    meta_template_name: z.string().trim().default(""),
    meta_language: z.string().trim().default("pt_BR"),
    meta_category: z
      .enum(["UTILITY", "MARKETING", "AUTHENTICATION"])
      .default("UTILITY"),
    meta_header_type: z.enum(["none", "text"]).default("none"),
    meta_header_text: z.string().trim().max(60).default(""),
    meta_footer_text: z.string().trim().max(60).default(""),
    meta_buttons: z.array(buttonSchema).max(10).default([]),
    variable_examples: z.record(z.string(), z.string()).default({}),
    targeting_mode: z
      .enum(["all", "audience", "segment", "filters"])
      .default("all"),
    audience_types: z.array(z.string()).default([]),
  })
  .superRefine((data, ctx) => {
    if (data.template_kind === "meta") {
      if (!META_NAME_RE.test(data.meta_template_name)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["meta_template_name"],
          message: "Use apenas letras minúsculas, números e _",
        });
      }
      const vars = extractSemanticKeys(data.body);
      for (const v of vars) {
        const example = data.variable_examples[v];
        if (!example || example.trim().length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["variable_examples", v],
            message: `Informe um exemplo para {${v}}`,
          });
        }
      }
    }
  });

export type TemplateDraftInput = z.infer<typeof templateDraftSchema>;

/** Convenience: safeParse returning a flat `{ [path]: message }` map. */
export function validateTemplateDraft(
  input: Partial<TemplateDraftInput> | Record<string, unknown>,
):
  | { ok: true; data: TemplateDraftInput }
  | { ok: false; errors: Record<string, string> } {
  const parsed = templateDraftSchema.safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data };
  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path.join(".") || "_";
    if (!errors[key]) errors[key] = issue.message;
  }
  return { ok: false, errors };
}

export type TemplateDraftKind = TemplateKind;
