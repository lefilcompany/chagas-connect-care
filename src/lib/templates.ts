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
  institution: string;
  created_by: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

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
