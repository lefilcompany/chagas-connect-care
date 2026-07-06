import { Activity, Info } from "lucide-react";
import { useJourneyMetrics } from "./useJourneys";
import type { JourneyStatus } from "./types";

export function RunStatusBanner({ journeyId, status }: { journeyId: string; status: JourneyStatus }) {
  const { data } = useJourneyMetrics(journeyId);
  const m = data ?? { active: 0, waiting: 0, completed: 0, failed: 0, stopped: 0, handoff: 0 };

  if (status === "rascunho") {
    return (
      <div role="status" className="flex items-start gap-3 rounded-xl border border-border bg-secondary/60 p-4 text-sm text-ink">
        <Info className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden />
        <div>
          <p className="font-medium">Rascunho não publicado.</p>
          <p className="text-muted-foreground">Publique para o motor executar. Nada é enviado enquanto estiver como rascunho.</p>
        </div>
      </div>
    );
  }

  if (status === "pausada") {
    return (
      <div role="status" className="flex items-start gap-3 rounded-xl border border-coral/40 bg-coral-soft/60 p-4 text-sm text-ink">
        <Info className="mt-0.5 h-4 w-4 text-primary" aria-hidden />
        <div>
          <p className="font-medium">Jornada pausada.</p>
          <p className="text-muted-foreground">Execuções em andamento são congeladas até a jornada ser retomada.</p>
        </div>
      </div>
    );
  }

  return (
    <div role="status" className="flex flex-wrap items-center gap-4 rounded-xl border border-care/30 bg-mint-soft/60 p-4 text-sm text-care">
      <Activity className="h-4 w-4" aria-hidden />
      <span><strong>{m.active}</strong> em execução</span>
      <span>·</span>
      <span><strong>{m.waiting}</strong> aguardando</span>
      <span>·</span>
      <span><strong>{m.completed}</strong> concluídas</span>
      <span>·</span>
      <span><strong>{m.failed}</strong> falhas</span>
      <span>·</span>
      <span><strong>{m.handoff}</strong> em handoff</span>
    </div>
  );
}