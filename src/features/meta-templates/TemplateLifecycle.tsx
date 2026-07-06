import { CheckCircle2, Circle, FileEdit, Send, Loader2, XCircle } from "lucide-react";

export type MetaLifecycleStatus =
  | "draft"
  | "validated"
  | "submitted"
  | "in_review"
  | "approved"
  | "rejected";

const STEPS: { key: MetaLifecycleStatus; label: string }[] = [
  { key: "draft", label: "Rascunho" },
  { key: "validated", label: "Validado" },
  { key: "submitted", label: "Enviado" },
  { key: "in_review", label: "Em análise" },
  { key: "approved", label: "Aprovado" },
];

/**
 * Visual do ciclo de vida de um modelo Meta. Aceita status "rejected" e
 * mostra o passo como falho, exibindo motivo/orientação quando fornecidos.
 */
export function TemplateLifecycle({
  status,
  rejectionReason,
  rejectedAt,
  guidance,
}: {
  status: MetaLifecycleStatus;
  rejectionReason?: string | null;
  rejectedAt?: string | null;
  guidance?: string | null;
}) {
  const isRejected = status === "rejected";
  const currentIdx = isRejected ? 2 : STEPS.findIndex((s) => s.key === status);

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <h3 className="font-display text-sm font-semibold text-ink">Ciclo de vida do modelo</h3>
      <ol className="mt-3 grid grid-cols-5 gap-1" aria-label="Etapas de aprovação">
        {STEPS.map((step, idx) => {
          const done = idx < currentIdx || (!isRejected && idx <= currentIdx);
          const active = !isRejected && idx === currentIdx;
          const failed = isRejected && idx === 2;
          const Icon = failed ? XCircle : done ? CheckCircle2 : active ? Loader2 : idx === 0 ? FileEdit : idx === 2 ? Send : Circle;
          return (
            <li key={step.key} className="flex flex-col items-center gap-1 text-center">
              <div
                className={
                  failed ? "text-destructive"
                    : done ? "text-care"
                    : active ? "text-primary"
                    : "text-muted-foreground"
                }
              >
                <Icon className={`h-5 w-5 ${active ? "animate-spin" : ""}`} aria-hidden />
              </div>
              <span
                className={
                  "text-[11px] " +
                  (failed ? "font-semibold text-destructive"
                    : done ? "text-ink"
                    : active ? "font-medium text-ink"
                    : "text-muted-foreground")
                }
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>

      {isRejected ? (
        <div className="mt-4 space-y-1 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <p className="font-semibold text-destructive">Modelo rejeitado pela Meta</p>
          {rejectionReason ? (
            <p className="text-destructive/90"><span className="font-medium">Motivo:</span> {rejectionReason}</p>
          ) : null}
          {rejectedAt ? (
            <p className="text-xs text-destructive/70">Em {new Date(rejectedAt).toLocaleString("pt-BR")}</p>
          ) : null}
          {guidance ? (
            <p className="mt-1 text-destructive/90"><span className="font-medium">Como corrigir:</span> {guidance}</p>
          ) : (
            <p className="mt-1 text-destructive/80">
              Ajuste o conteúdo apontado e envie uma nova versão para revisão.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}