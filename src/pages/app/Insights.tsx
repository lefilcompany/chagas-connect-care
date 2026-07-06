import { useState } from "react";
import { AlertTriangle, BarChart3, MessageCircleReply, Send, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState } from "@/components/care/EmptyState";
import { DeliveryFunnel } from "@/features/insights/DeliveryFunnel";
import { useInsights, type InsightsRange } from "@/features/insights/useInsights";

const RANGE_LABEL: Record<InsightsRange, string> = { "7d": "7 dias", "30d": "30 dias", "90d": "90 dias" };

function Metric({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-secondary/50 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold text-ink">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Sparkline({ data }: { data: { date: string; sent: number; delivered: number; failed: number }[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem envios no período.</p>;
  }
  const max = Math.max(1, ...data.map((d) => d.sent));
  return (
    <div>
      <div className="flex h-24 items-end gap-1" role="img" aria-label="Envios diários no período selecionado">
        {data.map((d) => {
          const h = Math.round((d.sent / max) * 100);
          const failedH = d.sent > 0 ? Math.round((d.failed / d.sent) * h) : 0;
          return (
            <div key={d.date} className="flex flex-1 flex-col justify-end" title={`${d.date}: ${d.sent} envios · ${d.failed} falhas`}>
              <div className="w-full rounded-t bg-care" style={{ height: `${Math.max(2, h - failedH)}%` }} />
              {failedH > 0 ? (
                <div className="w-full bg-destructive" style={{ height: `${failedH}%` }} />
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
        <span>{data[0]?.date}</span>
        <span>{data[data.length - 1]?.date}</span>
      </div>
    </div>
  );
}

export default function Insights() {
  const [range, setRange] = useState<InsightsRange>("30d");
  const { data, isLoading, error } = useInsights(range);

  const responseRatePct = data ? (data.engagement.responseRateBps / 100).toFixed(1) : "0.0";

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink md:text-3xl">Insights</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Como o cuidado está chegando às pessoas. Entrega, engajamento e execução das jornadas —
            sempre com contexto para não confundir métrica técnica com desfecho clínico.
          </p>
        </div>
        <div className="flex gap-2" role="tablist" aria-label="Intervalo de análise">
          {(["7d", "30d", "90d"] as InsightsRange[]).map((r) => (
            <Button
              key={r}
              type="button"
              size="sm"
              variant={range === r ? "default" : "outline"}
              onClick={() => setRange(r)}
              role="tab"
              aria-selected={range === r}
            >
              {RANGE_LABEL[r]}
            </Button>
          ))}
        </div>
      </header>

      {error ? (
        <ErrorState description={(error as Error).message} />
      ) : null}

      {/* Entrega */}
      <section aria-labelledby="insights-delivery" className="space-y-4">
        <div className="flex items-center gap-2">
          <Send className="h-4 w-4 text-muted-foreground" aria-hidden />
          <h2 id="insights-delivery" className="font-display text-lg font-semibold text-ink">Entrega</h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <DeliveryFunnel
            sent={data?.delivery.sent ?? 0}
            delivered={data?.delivery.delivered ?? 0}
            read={data?.delivery.read ?? 0}
            failed={data?.delivery.failed ?? 0}
          />
          <Card className="p-5">
            <h3 className="font-display text-sm font-semibold text-ink">Envios por dia</h3>
            <p className="text-xs text-muted-foreground">Barras verdes indicam entregas; vermelhas, falhas.</p>
            <div className="mt-3">
              {isLoading ? (
                <div className="h-24 animate-pulse rounded bg-secondary" />
              ) : (
                <Sparkline data={data?.delivery.daily ?? []} />
              )}
            </div>
          </Card>
        </div>
        <Card className="p-5">
          <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-ink">
            <AlertTriangle className="h-4 w-4 text-primary" aria-hidden /> Principais motivos de falha
          </h3>
          {isLoading ? (
            <div className="mt-3 space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-6 animate-pulse rounded bg-secondary" />)}
            </div>
          ) : (data?.delivery.byError.length ?? 0) === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Nenhuma falha registrada no período.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {data!.delivery.byError.map((e) => (
                <li key={e.reason} className="flex items-start justify-between gap-4 border-b border-border pb-2 last:border-b-0">
                  <span className="text-ink">{e.reason}</span>
                  <Badge variant="outline" className="border-coral/40 bg-coral-soft text-primary">
                    {e.count}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {/* Engajamento */}
      <section aria-labelledby="insights-engagement" className="space-y-4">
        <div className="flex items-center gap-2">
          <MessageCircleReply className="h-4 w-4 text-muted-foreground" aria-hidden />
          <h2 id="insights-engagement" className="font-display text-lg font-semibold text-ink">Engajamento</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Respostas recebidas" value={data?.engagement.inbound ?? 0} />
          <Metric label="Enviadas para pessoas" value={data?.engagement.outbound ?? 0} />
          <Metric
            label="Taxa de resposta"
            value={`${responseRatePct}%`}
            hint="Respostas recebidas ÷ mensagens enviadas"
          />
          <Metric
            label="Tempo médio de resposta"
            value={data?.engagement.avgResponseMinutes != null ? `${data.engagement.avgResponseMinutes} min` : "—"}
            hint="Cálculo por conversa virá em breve"
          />
        </div>
        <Card className="p-5">
          <h3 className="font-display text-sm font-semibold text-ink">Tipos de interação recebida</h3>
          {isLoading ? (
            <div className="mt-3 h-16 animate-pulse rounded bg-secondary" />
          ) : (data?.engagement.byInteraction.length ?? 0) === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Nenhuma interação categorizada no período.</p>
          ) : (
            <ul className="mt-3 flex flex-wrap gap-2 text-sm">
              {data!.engagement.byInteraction.map((i) => (
                <li key={i.type}>
                  <Badge variant="outline" className="border-border bg-secondary text-ink">
                    {i.type} · {i.count}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {/* Jornada */}
      <section aria-labelledby="insights-journey" className="space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" aria-hidden />
          <h2 id="insights-journey" className="font-display text-lg font-semibold text-ink">Jornada e templates</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Modelos Meta aprovados" value={data?.journey.templatesApproved ?? 0} />
          <Metric label="Modelos rejeitados" value={data?.journey.templatesRejected ?? 0} />
          <Metric label="Lotes de envio no período" value={data?.journey.batches ?? 0} />
          <Metric label="Envios futuros agendados" value={data?.journey.scheduledFuture ?? 0} />
        </div>
        <EmptyState
          icon={BarChart3}
          tone="neutral"
          title="Métricas de jornada plena virão com o motor de execução"
          description="Assim que jornadas passarem a rodar de verdade, mostraremos iniciadas, concluídas, interrompidas e tempo médio até conclusão."
        />
      </section>
    </div>
  );
}