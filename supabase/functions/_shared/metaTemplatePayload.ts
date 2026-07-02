// Pure, dependency-free builder for Meta message_templates creation payloads.
// No fetch, no Deno.env, no database access. Given the local template fields
// and variable examples, produces the exact JSON Meta's Graph API expects.

const SEMANTIC_RE = /\{([a-zA-Z0-9_]+)\}/g;

export type MetaCategory = "UTILITY" | "MARKETING" | "AUTHENTICATION";

export type MetaButton =
  | { type: "QUICK_REPLY"; text: string }
  | { type: "URL"; text: string; url: string; example?: string[] }
  | { type: "PHONE_NUMBER"; text: string; phone_number: string };

export interface BuildInput {
  name: string;
  language: string;
  category: MetaCategory;
  body: string;
  header?:
    | { type: "none" }
    | { type: "text"; text?: string | null }
    | { type: "image" | "video" | "document"; handle?: string | null }
    | null;
  footer?: string | null;
  buttons?: MetaButton[] | null;
  variableExamples: Record<string, string>;
}

export interface MetaComponent {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
  format?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
  text?: string;
  example?: {
    body_text?: string[][];
    header_text?: string[];
    header_handle?: string[];
  };
  buttons?: MetaButton[];
}

export interface MetaCreationPayload {
  name: string;
  language: string;
  category: MetaCategory;
  parameter_format: "POSITIONAL";
  components: MetaComponent[];
}

export type BuildResult =
  | { ok: true; payload: MetaCreationPayload; order: string[] }
  | { ok: false; errors: Record<string, string> };

const NAME_RE = /^[a-z0-9_]+$/;

function extractKeys(text: string): string[] {
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

function toPositional(text: string, order: string[]): string {
  const idx = new Map(order.map((k, i) => [k, i + 1]));
  return text.replace(SEMANTIC_RE, (raw, key: string) => {
    const i = idx.get(key);
    return i ? `{{${i}}}` : raw;
  });
}

/** Deterministic build. Returns errors instead of throwing. */
export function buildMetaTemplateCreationPayload(input: BuildInput): BuildResult {
  const errors: Record<string, string> = {};
  const name = (input.name ?? "").trim();
  if (!name) errors.name = "Nome técnico é obrigatório.";
  else if (!NAME_RE.test(name)) errors.name = "Use apenas letras minúsculas, números e underline.";
  if (name.length > 512) errors.name = "Nome técnico excede 512 caracteres.";

  const language = (input.language ?? "").trim() || "pt_BR";

  const body = (input.body ?? "").trim();
  if (!body) errors.body = "O corpo da mensagem não pode ficar vazio.";

  const header = input.header ?? { type: "none" };
  if (header.type === "text") {
    const t = (header.text ?? "").trim();
    if (!t) errors.header = "Cabeçalho de texto não pode ficar vazio.";
    else if (t.length > 60) errors.header = "Cabeçalho de texto deve ter até 60 caracteres.";
  } else if (
    header.type === "image" ||
    header.type === "video" ||
    header.type === "document"
  ) {
    const h = (header.handle ?? "").trim();
    if (!h) {
      errors.header = "Envie uma amostra de mídia antes de submeter o modelo.";
    }
  }

  const footer = (input.footer ?? "").trim();
  if (footer.length > 60) errors.footer = "Rodapé deve ter até 60 caracteres.";

  const order = extractKeys(body);
  const examples = input.variableExamples ?? {};
  const bodyExamples: string[] = [];
  for (const key of order) {
    const v = (examples[key] ?? "").trim();
    if (!v) errors[`variable_examples.${key}`] = `Informe um exemplo para {${key}}`;
    bodyExamples.push(v);
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const components: MetaComponent[] = [];
  if (header.type === "text") {
    components.push({ type: "HEADER", format: "TEXT", text: (header.text ?? "").trim() });
  } else if (
    header.type === "image" ||
    header.type === "video" ||
    header.type === "document"
  ) {
    const format =
      header.type === "image" ? "IMAGE" : header.type === "video" ? "VIDEO" : "DOCUMENT";
    components.push({
      type: "HEADER",
      format,
      example: { header_handle: [(header.handle ?? "").trim()] },
    });
  }
  const bodyComp: MetaComponent = { type: "BODY", text: toPositional(body, order) };
  if (bodyExamples.length > 0) bodyComp.example = { body_text: [bodyExamples] };
  components.push(bodyComp);
  if (footer) components.push({ type: "FOOTER", text: footer });
  const buttons = Array.isArray(input.buttons) ? input.buttons.filter(Boolean) : [];
  if (buttons.length > 0) components.push({ type: "BUTTONS", buttons });

  const payload: MetaCreationPayload = {
    name,
    language,
    category: input.category,
    parameter_format: "POSITIONAL",
    components,
  };
  return { ok: true, payload, order };
}

/** Stable JSON: keys sorted at every object level; arrays preserved as-is. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k])).join(",") + "}";
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
