import { useMemo } from "react";
import { AlertTriangle, ShieldAlert } from "lucide-react";

/**
 * Palavras/padrões que devem chamar atenção antes do envio.
 * Lista curta e conservadora — o objetivo é sinalizar, não censurar.
 */
const SENSITIVE_PATTERNS: { pattern: RegExp; hint: string }[] = [
  { pattern: /\bcpf\b/gi, hint: "Contém referência a CPF" },
  { pattern: /\brg\b/gi, hint: "Contém referência a RG" },
  { pattern: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, hint: "Possível CPF no texto" },
  { pattern: /diagn[óo]stico/gi, hint: "Contém termo clínico ('diagnóstico')" },
  { pattern: /HIV|AIDS|c[âa]ncer|c[âa]ncer|hepatite|s[íi]filis|tubercul[óo]se|chagas/gi, hint: "Contém condição de saúde sensível" },
  { pattern: /medicamento|dose|posologia/gi, hint: "Contém informação de medicação" },
  { pattern: /\{\{[^}]*\}\}/g, hint: "Contém variável não substituída" },
];

function findFlags(body: string) {
  const flags: string[] = [];
  for (const { pattern, hint } of SENSITIVE_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(body)) flags.push(hint);
  }
  return [...new Set(flags)];
}

export function messageHasClinicalContent(body: string): boolean {
  return findFlags(body).some((f) => f.includes("clínico") || f.includes("medicação") || f.includes("saúde"));
}

export function MessageSafetyPreview({ body }: { body: string }) {
  const flags = useMemo(() => findFlags(body ?? ""), [body]);
  const isEmpty = !body?.trim();

  if (isEmpty) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
        <AlertTriangle className="mt-0.5 h-4 w-4" aria-hidden />
        Mensagem vazia — o envio será bloqueado.
      </div>
    );
  }

  if (flags.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Nenhum termo sensível detectado. Revise o conteúdo antes de enviar.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-coral/40 bg-coral-soft/60 p-3 text-sm text-primary">
      <div className="flex items-center gap-2 font-semibold">
        <ShieldAlert className="h-4 w-4" aria-hidden /> Conteúdo sensível detectado
      </div>
      <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs">
        {flags.map((f) => <li key={f}>{f}</li>)}
      </ul>
      <p className="mt-2 text-xs">
        Revise se o destinatário tem consentimento específico para este tipo de conteúdo antes de confirmar o envio.
      </p>
    </div>
  );
}