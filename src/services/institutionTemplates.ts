import { createContext, useContext } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { MessageTemplate } from "@/lib/templates";
import type { TemplateDraftInput } from "@/lib/templateDraft";
import { semanticToPositional } from "@/lib/metaVariables";

/** Fields the server owns — never accepted from the client. */
const SERVER_OWNED = ["meta_status", "institution", "id", "created_at", "updated_at"] as const;

function stripServerOwned<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = { ...obj };
  for (const k of SERVER_OWNED) delete out[k];
  return out as T;
}

/**
 * Turns a validated draft into a row insert/update payload for
 * `message_templates`. Never emits `meta_status` or `institution` —
 * those are set server-side / by RLS.
 */
export function draftToRow(draft: TemplateDraftInput): Record<string, unknown> {
  const clean = stripServerOwned(draft as Record<string, unknown>);
  const isMeta = draft.template_kind === "meta";
  const positional = isMeta ? semanticToPositional(draft.body).order : [];
  const row: Record<string, unknown> = {
    name: draft.name,
    description: draft.description ?? "",
    category: draft.category,
    template_kind: draft.template_kind,
    body: draft.body,
    body_patient: draft.body,
    variables: positional,
    channel: "whatsapp",
    is_active: true,
    is_default: false,
    targeting_mode: draft.targeting_mode,
    audience_types: draft.audience_types,
  };
  if (isMeta) {
    row.meta_template_name = draft.meta_template_name;
    row.meta_language = draft.meta_language;
    row.meta_category = draft.meta_category;
    row.meta_footer_text = draft.meta_footer_text || null;
    row.meta_footer_source = draft.meta_footer_text ? "custom" : "institution_default";
    // Header/buttons kept as JSON siblings in the row (schema-flexible).
    (row as Record<string, unknown>).meta_header = {
      type: draft.meta_header_type,
      text: draft.meta_header_text,
    };
    (row as Record<string, unknown>).meta_buttons = draft.meta_buttons;
  }
  void clean;
  return row;
}

/**
 * Public service used by the institutional templates catalog. Only the
 * behaviours the catalog needs are exposed — creation/submission live in
 * later phases so this interface stays small on purpose.
 */
export interface InstitutionTemplateService {
  list(institution: string): Promise<MessageTemplate[]>;
  getById(id: string): Promise<MessageTemplate | null>;
  createDraft(
    input: TemplateDraftInput,
    ctx: { institution: string; userId: string },
  ): Promise<MessageTemplate>;
  updateDraft(id: string, input: TemplateDraftInput): Promise<MessageTemplate>;
}

/** Real implementation: reads from the message_templates table scoped by RLS. */
export const supabaseInstitutionTemplates: InstitutionTemplateService = {
  async list(institution: string): Promise<MessageTemplate[]> {
    if (!institution) return [];
    const { data, error } = await supabase
      .from("message_templates")
      .select("*")
      .eq("institution", institution)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as MessageTemplate[];
  },
  async getById(id: string): Promise<MessageTemplate | null> {
    if (!id) return null;
    const { data, error } = await supabase
      .from("message_templates")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return (data as unknown as MessageTemplate) ?? null;
  },
  async createDraft(input, ctx) {
    if (!ctx.institution) {
      throw new Error("Instituição não identificada para o usuário atual.");
    }
    const row = {
      ...draftToRow(input),
      institution: ctx.institution,
      created_by: ctx.userId,
      meta_status: "not_submitted",
    };
    const { data, error } = await supabase
      .from("message_templates")
      .insert(row as never)
      .select("*")
      .single();
    if (error) throw error;
    return data as unknown as MessageTemplate;
  },
  async updateDraft(id, input) {
    // Refuse to overwrite non-draft templates (RLS also enforces it).
    const existing = await this.getById(id);
    if (!existing) throw new Error("Modelo não encontrado.");
    if (existing.meta_status && existing.meta_status !== "not_submitted") {
      throw new Error(
        "Este modelo já foi enviado para a Meta e não pode ser editado nesta fase.",
      );
    }
    const row = draftToRow(input); // no meta_status, no institution
    const { data, error } = await supabase
      .from("message_templates")
      .update(row as never)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return data as unknown as MessageTemplate;
  },
};

export const InstitutionTemplateServiceContext =
  createContext<InstitutionTemplateService>(supabaseInstitutionTemplates);

export const useInstitutionTemplateService = (): InstitutionTemplateService =>
  useContext(InstitutionTemplateServiceContext);

/**
 * Identity of the logged-in institutional user, as seen by the templates
 * catalog. Exposed via context so tests can drive the page without touching
 * the auth stack or React Query internals.
 */
export type InstitutionIdentity = {
  institution: string | null;
  isAdmin: boolean;
  loading: boolean;
  error: Error | null;
};

export const InstitutionIdentityContext =
  createContext<InstitutionIdentity | null>(null);

export const useInstitutionIdentity = (): InstitutionIdentity => {
  const ctx = useContext(InstitutionIdentityContext);
  if (!ctx) {
    throw new Error(
      "useInstitutionIdentity must be used inside <InstitutionIdentityProvider>",
    );
  }
  return ctx;
};