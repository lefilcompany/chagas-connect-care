import { Card } from "@/components/ui/card";

function pct(part: number, total: number) {
  if (total === 0) return 0;
  return Math.round((part / total) * 100);
}

export function DeliveryFunnel({
  sent, delivered, read, failed,
}: { sent: number; delivered: number; read: number; failed: number }) {
  const rows = [
    { label: "Enviadas", value: sent, tone: "bg-secondary text-ink" },
    { label: "Entregues", value: delivered, tone: "bg-mint-soft text-care" },
    { label: "Lidas", value: read, tone: "bg-mint-soft text-care" },
    { label: "Falhas", value: failed, tone: "bg-coral-soft text-primary" },
  ];
  return (
    <Card className="p-5">
      <h3 className="font-display text-sm font-semibold text-ink">Funil de entrega</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Não confunda entrega com resultado clínico. Entrega mede infraestrutura, não cuidado.
      </p>
      <ul className="mt-4 space-y-2" aria-label="Distribuição de status de entrega">
        {rows.map((r) => {
          const p = pct(r.value, sent || 1);
          return (
            <li key={r.label} className="space-y-1">
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-ink">{r.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {r.value} <span className="opacity-60">({p}%)</span>
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-secondary" role="presentation">
                <div className={`h-full ${r.tone}`} style={{ width: `${p}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}