import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TodayHeader } from "@/features/today/TodayHeader";
import { AttentionQueue } from "@/features/today/AttentionQueue";
import { CareAgenda } from "@/features/today/CareAgenda";
import { CommunicationSummary } from "@/features/today/CommunicationSummary";

export default function Today() {
  const { user } = useAuth();
  const { data: profile } = useQuery({
    queryKey: ["today-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name, institution").eq("id", user!.id).maybeSingle();
      return data;
    },
    staleTime: 5 * 60_000,
  });

  return (
    <div className="space-y-8">
      <TodayHeader name={profile?.full_name ?? undefined} institution={profile?.institution ?? undefined} />

      <section aria-labelledby="attention-heading" className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 id="attention-heading" className="font-display text-xl font-bold text-ink">Precisa da sua atenção</h2>
          <p className="text-xs text-muted-foreground">Priorizado por urgência clínica e operacional</p>
        </div>
        <AttentionQueue />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section aria-labelledby="agenda-heading" className="space-y-3">
          <h2 id="agenda-heading" className="font-display text-xl font-bold text-ink">Agenda de cuidado</h2>
          <CareAgenda />
        </section>
        <section aria-labelledby="summary-heading" className="space-y-3">
          <h2 id="summary-heading" className="font-display text-xl font-bold text-ink">Resumo de hoje</h2>
          <CommunicationSummary />
        </section>
      </div>
    </div>
  );
}