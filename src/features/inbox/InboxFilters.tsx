import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { inboxChannelLabels, inboxStatusLabels, type InboxChannelFilter, type InboxStatusFilter } from "./types";

export function InboxFilters({
  query,
  onQueryChange,
  status,
  onStatusChange,
  channel,
  onChannelChange,
  patientId,
  onPatientChange,
  patients,
  counts,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  status: InboxStatusFilter;
  onStatusChange: (s: InboxStatusFilter) => void;
  channel: InboxChannelFilter;
  onChannelChange: (c: InboxChannelFilter) => void;
  patientId: string;
  onPatientChange: (id: string) => void;
  patients: Array<{ id: string; name: string }>;
  counts: Record<InboxStatusFilter, number>;
}) {
  const statusChips: InboxStatusFilter[] = [
    "todas",
    "nao-lidas",
    "aguardando-resposta",
    "janela-aberta",
    "janela-fechada",
    "desconhecido",
  ];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
          <Input
            className="pl-9 tap-target"
            placeholder="Buscar por nome, telefone ou mensagem..."
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            aria-label="Buscar conversa"
          />
        </div>
        <Select value={channel} onValueChange={(v) => onChannelChange(v as InboxChannelFilter)}>
          <SelectTrigger className="w-[180px]" aria-label="Filtrar por canal">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(inboxChannelLabels) as InboxChannelFilter[]).map((k) => (
              <SelectItem key={k} value={k}>
                {inboxChannelLabels[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={patientId} onValueChange={onPatientChange}>
          <SelectTrigger className="w-[220px]" aria-label="Filtrar por pessoa">
            <SelectValue placeholder="Filtrar por pessoa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas as pessoas</SelectItem>
            {patients.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div role="tablist" aria-label="Filtro de status" className="flex flex-wrap gap-2">
        {statusChips.map((k) => {
          const active = status === k;
          return (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onStatusChange(k)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              <span>{inboxStatusLabels[k]}</span>
              <span
                className={cn(
                  "rounded-full px-1.5 text-[10px] font-semibold",
                  active ? "bg-primary-foreground/20" : "bg-secondary text-muted-foreground",
                )}
              >
                {counts[k] ?? 0}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}