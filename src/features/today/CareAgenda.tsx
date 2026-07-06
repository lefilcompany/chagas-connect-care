import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CalendarClock } from "lucide-react";
import { EmptyState } from "@/components/care/EmptyState";

export function CareAgenda() {
  const { data, isLoading } = useQuery({
    queryKey: ["today-agenda"],
    queryFn: async () => {
      const { data } = await supabase
        .from("message_batches")
        .select("id, name, started_at, created_at, status")
        .in("status", ["scheduled", "pending", "processing"])
        .order("started_at", { ascending: true, nullsFirst: false })
        .limit(8);
      return data ?? [];
    },
    staleTime: 60_000,
  });

  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-2xl bg-secondary" aria-hidden />;
  }
  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={CalendarClock}
        title="Sem eventos agendados para os próximos 7 dias"
        description="Programe uma comunicação para ver os eventos aqui."
      />
    );
  }
  return (
    <ol className="space-y-2">
      {data.map((b) => {
        const at = b.started_at ?? b.created_at;
        const when = at ? new Date(at).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
        return (
          <li key={b.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
            <CalendarClock className="h-4 w-4 text-care" aria-hidden />
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-ink">{b.name || "Comunicação programada"}</p>
              <p className="text-xs text-muted-foreground">{when}</p>
            </div>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {b.status}
            </span>
          </li>
        );
      })}
    </ol>
  );
}