import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { SEMANTIC_VARIABLES, extractSemanticKeys } from "@/lib/metaVariables";
import type { MessageTemplate } from "@/lib/templates";

const POSITIONAL_RE = /\{\{\s*(\d+)\s*\}\}/g;

function metaBodyText(t: MessageTemplate): string {
  const def = (t as unknown as { meta_definition?: { components?: unknown[] } })
    .meta_definition;
  const comps = Array.isArray(def?.components) ? (def!.components as any[]) : [];
  const body = comps.find((c) => String(c?.type ?? "").toUpperCase() === "BODY");
  return String(body?.text ?? "");
}

function positionalCount(text: string): number {
  let max = 0;
  const re = new RegExp(POSITIONAL_RE);
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const n = Number(m[1]);
    if (n > max) max = n;
  }
  return max;
}

interface Props {
  template: MessageTemplate;
}

/**
 * Lets an admin bind each {{N}} in the approved Meta body to a semantic
 * variable. Persists to `message_templates.meta_body_parameter_order` — send
 * paths use it to build the outbound `parameters` array in the right order.
 */
export function TemplateParameterOrder({ template }: Props) {
  const qc = useQueryClient();
  const bodyText = metaBodyText(template);
  const total = useMemo(() => positionalCount(bodyText), [bodyText]);
  const initial = useMemo<string[]>(() => {
    const raw = (template as unknown as { meta_body_parameter_order?: unknown })
      .meta_body_parameter_order;
    const arr = Array.isArray(raw) ? (raw as string[]) : [];
    const out = [...arr];
    while (out.length < total) out.push("");
    return out.slice(0, total);
  }, [template, total]);

  const [order, setOrder] = useState<string[]>(initial);
  useEffect(() => setOrder(initial), [initial]);

  const saveMutation = useMutation({
    mutationFn: async (next: string[]) => {
      const { error } = await supabase
        .from("message_templates")
        .update({ meta_body_parameter_order: next } as never)
        .eq("id", template.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ordem das variáveis salva.");
      qc.invalidateQueries({ queryKey: ["template-by-id", template.id] });
    },
    onError: (e: Error) => toast.error(e.message ?? "Falha ao salvar."),
  });

  if (total === 0) return null;

  const suggestion = extractSemanticKeys(template.body ?? "");
  const canAutoFill =
    suggestion.length === total && order.some((v, i) => v !== suggestion[i]);

  const allFilled = order.every((v) => v && v.trim().length > 0);
  const usedTwice = new Set(order.filter(Boolean)).size !== order.filter(Boolean).length;

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <header className="space-y-1">
        <h2 className="text-sm font-semibold">Ordem das variáveis</h2>
        <p className="text-xs text-muted-foreground">
          O texto aprovado pela Meta usa variáveis posicionais{" "}
          <code>{"{{1}}, {{2}}"}</code>. Escolha qual campo do sistema deve preencher
          cada posição. Sem esse mapeamento, o envio falha com{" "}
          <code>TEMPLATE_PARAMETER_ORDER_MISSING</code>.
        </p>
      </header>

      <div className="rounded-md bg-muted/50 p-2 text-xs font-mono whitespace-pre-wrap">
        {bodyText}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {order.map((value, i) => (
          <div key={i} className="space-y-1">
            <Label htmlFor={`param-${i}`} className="text-xs">
              Posição {`{{${i + 1}}}`}
            </Label>
            <Select
              value={value || undefined}
              onValueChange={(v) => {
                const next = [...order];
                next[i] = v;
                setOrder(next);
              }}
            >
              <SelectTrigger id={`param-${i}`}>
                <SelectValue placeholder="Selecione um campo…" />
              </SelectTrigger>
              <SelectContent>
                {SEMANTIC_VARIABLES.map((v) => (
                  <SelectItem key={v.key} value={v.key}>
                    {v.label} <span className="text-muted-foreground">({v.key})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      {usedTwice && (
        <p className="text-xs text-amber-600">
          Você repetiu um campo em mais de uma posição. Confirme se é intencional.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {canAutoFill && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOrder(suggestion)}
          >
            Sugerir pelo corpo local
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          onClick={() => saveMutation.mutate(order)}
          disabled={!allFilled || saveMutation.isPending}
        >
          {saveMutation.isPending ? "Salvando…" : "Salvar ordem"}
        </Button>
      </div>
    </section>
  );
}