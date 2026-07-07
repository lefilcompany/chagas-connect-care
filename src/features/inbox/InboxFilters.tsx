import { Search, SlidersHorizontal } from "lucide-react";
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
    <section aria-label="Filtros da caixa de cuidado" className="care-card space-y-4 p-4 sm:p-5">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        <SlidersHorizontal className="h-4 w-4 text-care" aria-hidden />
        Localizar e filtrar conversas
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(280px,1fr)_180px_220px]">
        <div className="relative min-w-0">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            className="tap-target w-full pl-9"
            placeholder="Buscar por nome, telefone ou mensagem..."
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            aria-label="Buscar conversa"
          />
        </div>

        <Select value={channel} onValueChange={(v) => onChannelChange(v as InboxChannelFilter)}>
          <SelectTrigger className="tap-target w-full" aria-label="Filtrar por canal">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(inboxChannelLabels) as InboxChannelFilter[]).map((key) => (
              <SelectItem key={key} value={key}>
                {inboxChannelLabels[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={patientId} onValueChange={onPatientChange}>
          <SelectTrigger className="tap-target w-full" aria-label="Filtrar por pessoa">
            <SelectValue placeholder="Filtrar por pessoa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas as pessoas</SelectItem>
            {patients.map((person) => (
              <SelectItem key={person.id} value={person.id}>{person.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto pb-1">
        <div role="tablist" aria-label="Filtro de status" className="flex min-w-max items-center gap-2">
          {statusChips.map((key) => {
            const active = status === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onStatusChange(key)}
                className={cn(
                  "inline-flex min-h-9 items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "border-transparent bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground",
                )}
              >
                <span>{inboxStatusLabels[key]}</span>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                    active ? "bg-primary-foreground/20" : "bg-secondary text-muted-foreground",
                  )}
                >
                  {counts[key] ?? 0}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
