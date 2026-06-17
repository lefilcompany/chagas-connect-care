import type { AudienceType, SegmentFilters, TargetingMode } from "@/lib/segments";

export type TemplateKind = "internal" | "meta";
export type MetaStatus =
  | "not_submitted"
  | "submitted"
  | "approved"
  | "rejected"
  | "paused"
  | "disabled";

export type MessageTemplate = {
  id: string;
  name: string;
  description: string;
  category: string;
  body: string;
  body_patient?: string | null;
  body_contact?: string | null;
  body_segment?: string | null;
  variables: string[];
  targeting_mode: TargetingMode;
  audience_types: AudienceType[];
  segment_id: string | null;
  filters: SegmentFilters;
  channel: "whatsapp" | "sms";
  template_kind: TemplateKind;
  meta_template_name: string | null;
  meta_template_id: string | null;
  meta_language: string;
  meta_category: string | null;
  meta_status: MetaStatus;
  
  created_by: string | null;
  is_active: boolean;
  is_default?: boolean;
  created_at: string;
  updated_at: string;
};

/** Recipient variants supported by an objetivo (template). */
export type TemplateVariant = "patient" | "contact" | "segment";

export const VARIANT_LABEL: Record<TemplateVariant, string> = {
  patient: "Paciente",
  contact: "Familiar/Cuidador",
  segment: "Segmento",
};

/**
 * Returns the body for the requested variant with sensible fallbacks:
 * requested variant → body_patient → legacy body. Never returns null.
 */
export function pickVariantBody(
  template: Pick<MessageTemplate, "body" | "body_patient" | "body_contact" | "body_segment">,
  variant: TemplateVariant,
): string {
  const key = (
    { patient: "body_patient", contact: "body_contact", segment: "body_segment" } as const
  )[variant];
  const v = (template as any)[key];
  if (typeof v === "string" && v.trim().length > 0) return v;
  if (template.body_patient && template.body_patient.trim().length > 0) return template.body_patient;
  return template.body ?? "";
}

const VAR_RE = /\{([a-zA-Z0-9_]+)\}/g;

/** Extracts unique variable names from `{var}` placeholders. */
export function extractVariables(body: string): string[] {
  const found = new Set<string>();
  const text = body ?? "";
  let m: RegExpExecArray | null;
  const re = new RegExp(VAR_RE);
  while ((m = re.exec(text)) !== null) found.add(m[1]);
  return Array.from(found);
}

/** Replaces `{var}` placeholders with provided values. Missing values stay as `{var}`. */
export function renderTemplate(body: string, values: Record<string, string>): string {
  return (body ?? "").replace(VAR_RE, (_, key: string) =>
    values[key] != null && values[key] !== "" ? values[key] : `{${key}}`,
  );
}

export const TEMPLATE_CATEGORIES = [
  { value: "medicacao", label: "Medicação" },
  { value: "alimentacao", label: "Alimentação" },
  { value: "consulta", label: "Consulta" },
  { value: "orientacao", label: "Orientação" },
  { value: "adesao", label: "Adesão" },
  { value: "geral", label: "Geral" },
];

export const META_STATUS_LABEL: Record<MetaStatus, string> = {
  not_submitted: "Não submetido",
  submitted: "Em análise",
  approved: "Aprovado",
  rejected: "Rejeitado",
  paused: "Pausado",
  disabled: "Desativado",
};

/** Common variable suggestions to display as chips in the editor. */
export const VARIABLE_SUGGESTIONS: { key: string; hint: string }[] = [
  { key: "nome_destinatario", hint: "Nome do destinatário (paciente, familiar, cuidador, etc.)" },
  { key: "nome_paciente", hint: "Nome do paciente (compatibilidade)" },
  { key: "nome_contato", hint: "Nome do familiar/cuidador/médico (compatibilidade)" },
  { key: "orientacao", hint: "Orientação genérica" },
  { key: "orientacao_rotina", hint: "Orientação de rotina" },
  { key: "orientacao_alimentacao", hint: "Orientação alimentar" },
  { key: "aviso", hint: "Aviso" },
  { key: "data_consulta", hint: "Data da consulta" },
  { key: "hora_consulta", hint: "Hora da consulta" },
  { key: "local_consulta", hint: "Local da consulta" },
];

export type MedicationLike = {
  name?: string | null;
  dose?: string | null;
  schedule?: string | null;
};

/**
 * Formats a list of medications into a human-readable string for messages.
 * - 0 meds → ""
 * - 1 med → "Nome — Dose — Horário"
 * - many meds (mode "all") → bullet list on separate lines
 * - many meds (mode "first") → only the first one as a single line
 */
export function formatMedications(
  meds: MedicationLike[],
  mode: "all" | "first" = "all",
): string {
  if (!meds?.length) return "";
  const fmt = (m: MedicationLike) =>
    [m.name, m.dose, m.schedule].map((x) => (x ?? "").trim()).filter(Boolean).join(" — ");
  if (mode === "first" || meds.length === 1) return fmt(meds[0]);
  return meds.map((m) => `• ${fmt(m)}`).join("\n");
}

/** Best-effort auto-fill of common variables based on patient/contact context. */
export function autofillVariables(
  variables: string[],
  ctx: {
    patient?: { full_name?: string | null } | null;
    contact?: { full_name?: string | null } | null;
    medications?: { name?: string | null; dose?: string | null; schedule?: string | null }[];
  },
): Record<string, string> {
  const out: Record<string, string> = {};
  const recipientName =
    ctx.contact?.full_name?.trim() || ctx.patient?.full_name?.trim() || "";
  for (const v of variables) {
    if (v === "nome_destinatario" && recipientName) out[v] = recipientName;
    else if (v === "nome_paciente" && ctx.patient?.full_name) out[v] = ctx.patient.full_name;
    else if (v === "nome_contato" && ctx.contact?.full_name) out[v] = ctx.contact.full_name;
    else if ((v === "medicacao" || v === "medicacao_orientacao") && ctx.medications?.length) {
      const m = ctx.medications[0];
      const parts = [m.name, m.dose, m.schedule].filter(Boolean);
      if (parts.length) out[v] = parts.join(" — ");
    }
  }
  return out;
}
