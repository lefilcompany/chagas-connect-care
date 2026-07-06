import { type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type ChannelStatus = "operacional" | "atencao" | "inativo" | "planejado";

const STATUS_LABEL: Record<ChannelStatus, string> = {
  operacional: "Operacional",
  atencao: "Requer atenção",
  inativo: "Não configurado",
  planejado: "Planejado",
};

const STATUS_TONE: Record<ChannelStatus, string> = {
  operacional: "bg-mint-soft text-care border-care/30",
  atencao: "bg-coral-soft text-primary border-coral/40",
  inativo: "bg-secondary text-muted-foreground border-border",
  planejado: "bg-secondary text-muted-foreground border-border",
};

export type ChannelAction = {
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: "default" | "outline" | "ghost";
  disabled?: boolean;
};

export type ChannelCardProps = {
  name: string;
  icon: LucideIcon;
  status: ChannelStatus;
  description: string;
  sender?: string;
  lastSync?: string;
  recentFailures?: number;
  actions?: ChannelAction[];
  disabled?: boolean;
};

export function ChannelCard({
  name, icon: Icon, status, description, sender, lastSync, recentFailures, actions = [], disabled,
}: ChannelCardProps) {
  return (
    <Card className={`p-5 shadow-soft ${disabled ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-mint-soft text-care">
            <Icon className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h2 className="font-display text-base font-semibold text-ink">{name}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        <Badge variant="outline" className={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-lg border border-border bg-secondary/50 p-2">
          <dt className="text-muted-foreground">Remetente</dt>
          <dd className="mt-0.5 truncate font-medium text-ink">{sender ?? "—"}</dd>
        </div>
        <div className="rounded-lg border border-border bg-secondary/50 p-2">
          <dt className="text-muted-foreground">Última sincronização</dt>
          <dd className="mt-0.5 font-medium text-ink">{lastSync ?? "—"}</dd>
        </div>
        <div className="col-span-2 rounded-lg border border-border bg-secondary/50 p-2">
          <dt className="text-muted-foreground">Falhas recentes</dt>
          <dd className="mt-0.5 font-medium text-ink">
            {recentFailures == null ? "—" : recentFailures === 0 ? "Nenhuma" : `${recentFailures} nas últimas 24h`}
          </dd>
        </div>
      </dl>

      {actions.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {actions.map((a) => (
            a.href ? (
              <Button key={a.label} asChild variant={a.variant ?? "outline"} size="sm" disabled={a.disabled}>
                <a href={a.href}>{a.label}</a>
              </Button>
            ) : (
              <Button key={a.label} variant={a.variant ?? "outline"} size="sm" onClick={a.onClick} disabled={a.disabled}>
                {a.label}
              </Button>
            )
          ))}
        </div>
      ) : null}
    </Card>
  );
}