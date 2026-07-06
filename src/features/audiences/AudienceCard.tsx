import { Link } from "react-router-dom";
import { Users, Pencil, Copy, Trash2, MoreHorizontal, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AUDIENCE_LABELS, type AudienceType, type SegmentDef } from "@/lib/segments";
import { segmentSentence } from "./sentence";
import { useAudienceCounts } from "./useAudienceCounts";

export function AudienceCard({
  segment, onDuplicate, onDelete,
}: { segment: SegmentDef; onDuplicate: () => void; onDelete: () => void }) {
  const { data, isLoading, refetch, isFetching } = useAudienceCounts(segment);

  return (
    <Card className="p-5 shadow-soft transition hover:shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg font-semibold text-ink">{segment.name}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {segmentSentence(segment)}
          </p>
          {segment.description ? (
            <p className="mt-2 text-xs text-muted-foreground">
              <span className="font-medium text-ink">Observação:</span> {segment.description}
            </p>
          ) : null}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Ações do segmento">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link to={`/app/segmentos/${segment.id}/editar`}>
                <Pencil className="mr-2 h-4 w-4" /> Editar
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="mr-2 h-4 w-4" /> Duplicar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
              <Trash2 className="mr-2 h-4 w-4" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-secondary/60 p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Elegíveis</p>
          <p className="mt-0.5 flex items-center gap-2 font-display text-2xl font-semibold text-ink">
            {isLoading ? <span className="inline-block h-6 w-10 animate-pulse rounded bg-muted" /> : data?.eligible ?? 0}
            <Users className="h-4 w-4 text-muted-foreground" aria-hidden />
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {segment.audience_types.map((a) => (
              <Badge key={a} variant="outline" className="text-[10px]">
                {AUDIENCE_LABELS[a as AudienceType]} · {data?.byRelation[a] ?? 0}
              </Badge>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-secondary/60 p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Distribuição por canal</p>
          <div className="mt-1 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">WhatsApp</span>
              <span className="font-medium text-ink">{data?.channels.whatsapp ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">SMS</span>
              <span className="font-medium text-ink">{data?.channels.sms ?? 0}</span>
            </div>
          </div>
        </div>
      </div>

      {data?.sample?.length ? (
        <div className="mt-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Amostra</p>
          <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            {data.sample.map((r) => (
              <li key={r.key} className="truncate">
                • {r.name} <span className="opacity-70">({AUDIENCE_LABELS[r.relation]})</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Atualizado {data ? new Date(data.computedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"}
        </span>
        <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} /> Recalcular
        </Button>
      </div>
    </Card>
  );
}