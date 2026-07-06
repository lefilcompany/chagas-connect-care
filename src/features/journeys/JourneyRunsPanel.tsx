import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { apiListRuns, apiListRunSteps } from "./api";
import type { JourneyRun, JourneyRunStatus } from "./types";

const STATUS_TONE: Record<JourneyRunStatus, string> = {
  queued: "bg-secondary text-ink border-border",
  running: "bg-mint-soft text-care border-care/30",
  waiting: "bg-secondary text-muted-foreground border-border",
  completed: "bg-mint-soft text-care border-care/30",
  failed: "bg-coral-soft text-primary border-coral/40",
  stopped: "bg-muted text-muted-foreground border-border",
  handoff: "bg-coral-soft text-primary border-coral/40",
};

const STATUS_LABEL: Record<JourneyRunStatus, string> = {
  queued: "Na fila", running: "Executando", waiting: "Aguardando",
  completed: "Concluída", failed: "Falha", stopped: "Parada", handoff: "Handoff",
};

function fmt(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function JourneyRunsPanel({ journeyId }: { journeyId: string }) {
  const [openRun, setOpenRun] = useState<JourneyRun | null>(null);
  const { data: runs, isLoading, refetch } = useQuery({
    queryKey: ["journey-runs", journeyId],
    queryFn: () => apiListRuns(journeyId),
    refetchInterval: 15_000,
  });

  return (
    <Card className="p-4 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-base font-semibold text-ink">Execuções</h2>
        <Button variant="ghost" size="sm" onClick={() => refetch()}>Atualizar</Button>
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : !runs?.length ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma execução ainda. Publique a jornada e inscreva pessoas para iniciar.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-muted-foreground">
                <th className="px-2 py-2">Pessoa</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Nó atual</th>
                <th className="px-2 py-2">Início</th>
                <th className="px-2 py-2">Retomada</th>
                <th className="px-2 py-2">Erro</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-2 py-2 text-ink">{r.patientName ?? r.patientId?.slice(0,8)}</td>
                  <td className="px-2 py-2">
                    <Badge variant="outline" className={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                  </td>
                  <td className="px-2 py-2 text-muted-foreground">{r.currentNodeId?.slice(0,8) ?? "—"}</td>
                  <td className="px-2 py-2 text-muted-foreground">{fmt(r.enteredAt)}</td>
                  <td className="px-2 py-2 text-muted-foreground">{fmt(r.resumeAt)}</td>
                  <td className="px-2 py-2 text-primary">{r.error ?? ""}</td>
                  <td className="px-2 py-2 text-right">
                    <Button variant="ghost" size="sm" onClick={() => setOpenRun(r)}>Detalhes</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Sheet open={!!openRun} onOpenChange={(v) => { if (!v) setOpenRun(null); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Trilha da execução</SheetTitle>
          </SheetHeader>
          {openRun ? <RunSteps runId={openRun.id} /> : null}
        </SheetContent>
      </Sheet>
    </Card>
  );
}

function RunSteps({ runId }: { runId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["run-steps", runId],
    queryFn: () => apiListRunSteps(runId),
    refetchInterval: 10_000,
  });
  if (isLoading) return <p className="mt-4 text-sm text-muted-foreground">Carregando…</p>;
  if (!data?.length) return <p className="mt-4 text-sm text-muted-foreground">Sem passos registrados ainda.</p>;
  return (
    <ol className="mt-4 space-y-3">
      {data.map((s) => (
        <li key={s.id} className="rounded-lg border border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-xs text-muted-foreground">{s.nodeKind} · tentativa {s.attempt}</span>
            <Badge variant="outline" className={
              s.status === "ok" ? "bg-mint-soft text-care border-care/30" :
              s.status === "failed" ? "bg-coral-soft text-primary border-coral/40" :
              "bg-secondary text-muted-foreground border-border"
            }>{s.status}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{fmt(s.startedAt)}</p>
          {s.error ? <p className="mt-1 text-xs text-primary">{s.error}</p> : null}
          {Object.keys(s.detail).length > 0 ? (
            <pre className="mt-2 max-h-40 overflow-auto rounded bg-secondary/60 p-2 text-[11px]">
              {JSON.stringify(s.detail, null, 2)}
            </pre>
          ) : null}
        </li>
      ))}
    </ol>
  );
}