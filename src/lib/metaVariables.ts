/**
 * Catálogo central de variáveis semânticas usadas em mensagens e templates Meta.
 *
 * Regras:
 * - O administrador sempre escreve `{nome_destinatario}` (semântico).
 * - A interface mostra rótulo e exemplo humano vindos daqui (nunca `{{1}}`).
 * - Para envio à Meta, `semanticToPositional` converte para `{{1}}, {{2}}…`
 *   preservando a ordem em que cada chave aparece no texto.
 */

export type SemanticVariableType = "text" | "date" | "time" | "url" | "code" | "phone";

export type SemanticVariable = {
  key: string;
  label: string;
  description: string;
  example: string;
  type: SemanticVariableType;
};

export const SEMANTIC_VARIABLES: SemanticVariable[] = [
  { key: "nome_destinatario", label: "Nome do destinatário", description: "Paciente, familiar, cuidador ou contato.", example: "Maria Silva", type: "text" },
  { key: "nome_paciente", label: "Nome do paciente", description: "Nome completo do paciente vinculado.", example: "João Pereira", type: "text" },
  { key: "nome_contato", label: "Nome do familiar/cuidador", description: "Nome do contato vinculado ao paciente.", example: "Ana Souza", type: "text" },
  { key: "nome_profissional", label: "Profissional responsável", description: "Nome do médico, enfermeiro ou agente comunitário.", example: "Dr. Paulo Lima", type: "text" },
  { key: "nome_instituicao", label: "Instituição", description: "Nome da unidade de saúde ou programa.", example: "Hospital das Clínicas", type: "text" },
  { key: "data_consulta", label: "Data da consulta", description: "Dia em que a consulta acontece.", example: "12/03/2026", type: "date" },
  { key: "hora_consulta", label: "Horário da consulta", description: "Horário da consulta (24h).", example: "14:30", type: "time" },
  { key: "local_consulta", label: "Local da consulta", description: "Endereço ou sala onde será atendida.", example: "Ambulatório 2 — Sala 14", type: "text" },
  { key: "data_exame", label: "Data do exame", description: "Dia agendado para o exame.", example: "20/03/2026", type: "date" },
  { key: "hora_exame", label: "Horário do exame", description: "Horário do exame (24h).", example: "08:00", type: "time" },
  { key: "data_retorno", label: "Data de retorno", description: "Dia do retorno clínico.", example: "05/04/2026", type: "date" },
  { key: "data_medicacao", label: "Data da medicação", description: "Dia em que a medicação deve ser tomada.", example: "Hoje", type: "date" },
  { key: "hora_medicacao", label: "Horário da medicação", description: "Horário em que a medicação deve ser tomada.", example: "20:00", type: "time" },
  { key: "medicacao", label: "Medicação", description: "Nome e dosagem da medicação.", example: "Benznidazol 100 mg", type: "text" },
  { key: "orientacao", label: "Orientação", description: "Orientação clínica curta.", example: "Tomar com bastante água.", type: "text" },
  { key: "orientacao_rotina", label: "Orientação de rotina", description: "Orientação geral de rotina.", example: "Manter hidratação ao longo do dia.", type: "text" },
  { key: "orientacao_alimentacao", label: "Orientação alimentar", description: "Recomendação alimentar.", example: "Evitar frituras nas próximas 24h.", type: "text" },
  { key: "aviso", label: "Aviso", description: "Aviso importante.", example: "Sua consulta foi reagendada.", type: "text" },
  { key: "codigo_otp", label: "Código de verificação", description: "Código numérico de autenticação.", example: "123456", type: "code" },
  { key: "link_confirmacao", label: "Link de confirmação", description: "URL segura para o destinatário.", example: "https://exemplo.org/c/abc", type: "url" },
  { key: "telefone_unidade", label: "Telefone da unidade", description: "Telefone de contato.", example: "(81) 99999-0000", type: "phone" },
];

const BY_KEY = new Map(SEMANTIC_VARIABLES.map((v) => [v.key, v]));

/** Returns the catalog entry, or a generic fallback for unknown keys. */
export function getSemanticVariable(key: string): SemanticVariable {
  return (
    BY_KEY.get(key) ?? {
      key,
      label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      description: "",
      example: "",
      type: "text",
    }
  );
}

const SEMANTIC_RE = /\{([a-zA-Z0-9_]+)\}/g;

/** Returns unique variable keys in the order they first appear. */
export function extractSemanticKeys(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(SEMANTIC_RE);
  while ((m = re.exec(text ?? "")) !== null) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      out.push(m[1]);
    }
  }
  return out;
}

/**
 * Converts a semantic body (e.g. `Olá, {nome_destinatario}`) into the Meta
 * positional format (`Olá, {{1}}`) and returns the ordered keys.
 */
export function semanticToPositional(
  text: string,
  order?: string[],
): { positional: string; order: string[] } {
  const appearance = extractSemanticKeys(text);
  const final = order && order.length > 0 ? [...order] : [...appearance];
  for (const k of appearance) if (!final.includes(k)) final.push(k);
  const indexByKey = new Map(final.map((k, i) => [k, i + 1]));
  const positional = (text ?? "").replace(SEMANTIC_RE, (raw, key: string) => {
    const idx = indexByKey.get(key);
    return idx ? `{{${idx}}}` : raw;
  });
  return { positional, order: final };
}

/** Converts `{{1}}` back into `{key}` based on ordered keys. */
export function positionalToSemantic(text: string, order: string[]): string {
  return (text ?? "").replace(/\{\{(\d+)\}\}/g, (raw, n) => {
    const idx = Number(n) - 1;
    const key = order[idx];
    return key ? `{${key}}` : raw;
  });
}

/**
 * Renders a semantic body for preview purposes: missing values are replaced
 * by the catalog `example` so the user never sees `{var}` or `{{1}}`.
 */
export function renderWithExamples(
  text: string,
  values: Record<string, string> = {},
): string {
  return (text ?? "").replace(SEMANTIC_RE, (_, key: string) => {
    const provided = values[key];
    if (provided && provided.trim().length > 0) return provided;
    const cat = getSemanticVariable(key);
    return cat.example || cat.label;
  });
}
