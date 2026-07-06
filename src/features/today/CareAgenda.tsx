import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CalendarClock } from "lucide-react";
import { EmptyState } from "@/components/care/EmptyState";

export function CareAgenda() {
  const { data, isLoading } = useQuery({
    queryKey: ["today-agenda"],
    queryFn: async () => {
      const now = new Date().toISOString();
      const in7d = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
      const { data } = await supabase
        .from("message_batches")
        .select("id, name, scheduled_at, status")
        .gte("scheduled_at", now)
        .lte("scheduled_at", in7d)
        .order("scheduled_at", { ascending: true })
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
        const when = b.scheduled_at ? new Date(b.scheduled_at).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
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