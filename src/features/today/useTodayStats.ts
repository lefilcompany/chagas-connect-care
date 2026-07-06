import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Real, non-fabricated counters for the "Hoje" page.
 * Fields backed by not-yet-implemented schema (respostas pendentes,
 * consultas, jornadas interrompidas) default to 0 and surface as empty states.
 */
export function useTodayStats() {
  return useQuery({
    queryKey: ["today-stats"],
    queryFn: async () => {
      const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
      const since24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const since14d = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();

      const [failed, rejectedTpl, incompletePatients, msgsToday, staleContacts, delivered, replied, allToday] = await Promise.all([
        supabase.from("messages").select("id", { count: "exact", head: true })
          .eq("status", "failed").gte("sent_at", since24h),
        supabase.from("message_templates").select("id", { count: "exact", head: true })
          .eq("meta_status", "rejected"),
        supabase.from("patients").select("id", { count: "exact", head: true })
          .or("phone.is.null,full_name.is.null"),
        supabase.from("messages").select("id", { count: "exact", head: true })
          .gte("sent_at", startOfDay.toISOString()),
        supabase.from("patients").select("id", { count: "exact", head: true })
          .lt("updated_at", since14d),
        supabase.from("messages").select("id", { count: "exact", head: true })
          .eq("status", "delivered").gte("sent_at", startOfDay.toISOString()),
        supabase.from("messages").select("id", { count: "exact", head: true })
          .eq("direction", "in").gte("sent_at", startOfDay.toISOString()),
        supabase.from("messages").select("id", { count: "exact", head: true })
          .gte("sent_at", startOfDay.toISOString()),
      ]);

      return {
        attention: {
          failedSends: failed.count ?? 0,
          rejectedTemplates: rejectedTpl.count ?? 0,
          incompletePatients: incompletePatients.count ?? 0,
          staleContacts: staleContacts.count ?? 0,
          pendingReplies: 0,
          unconfirmedAppointments: 0,
          interruptedJourneys: 0,
        },
        summary: {
          messagesToday: msgsToday.count ?? 0,
          delivered: delivered.count ?? 0,
          replied: replied.count ?? 0,
          allToday: allToday.count ?? 0,
        },
      };
    },
    staleTime: 60_000,
  });
}