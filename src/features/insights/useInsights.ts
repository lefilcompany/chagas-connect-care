import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type InsightsRange = "7d" | "30d" | "90d";

export type InsightsData = {
  range: InsightsRange;
  since: string;
  delivery: {
    sent: number;
    delivered: number;
    failed: number;
    read: number;
    byError: { reason: string; count: number }[];
    daily: { date: string; sent: number; delivered: number; failed: number }[];
  };
  engagement: {
    inbound: number;
    outbound: number;
    responseRateBps: number; // basis points to avoid float
    avgResponseMinutes: number | null;
    byInteraction: { type: string; count: number }[];
  };
  journey: {
    templatesApproved: number;
    templatesRejected: number;
    batches: number;
    scheduledFuture: number;
  };
};

function rangeToSince(r: InsightsRange): string {
  const map = { "7d": 7, "30d": 30, "90d": 90 } as const;
  const d = new Date();
  d.setDate(d.getDate() - map[r]);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function useInsights(range: InsightsRange = "30d") {
  const since = rangeToSince(range);

  return useQuery<InsightsData>({
    queryKey: ["insights", range],
    queryFn: async () => {
      const [
        sent, delivered, failed, read, inbound, outbound, batches, scheduledFuture,
        approvedTpl, rejectedTpl, errors, interactions, dailyRows,
      ] = await Promise.all([
        supabase.from("messages").select("id", { count: "exact", head: true })
          .eq("direction", "out").gte("created_at", since),
        supabase.from("messages").select("id", { count: "exact", head: true })
          .in("status", ["delivered", "read"]).eq("direction", "out").gte("created_at", since),
        supabase.from("messages").select("id", { count: "exact", head: true })
          .eq("status", "failed").eq("direction", "out").gte("created_at", since),
        supabase.from("messages").select("id", { count: "exact", head: true })
          .eq("status", "read").eq("direction", "out").gte("created_at", since),
        supabase.from("messages").select("id", { count: "exact", head: true })
          .eq("direction", "in").gte("created_at", since),
        supabase.from("messages").select("id", { count: "exact", head: true })
          .eq("direction", "out").gte("created_at", since),
        supabase.from("message_batches").select("id", { count: "exact", head: true })
          .gte("created_at", since),
        supabase.from("message_batches").select("id", { count: "exact", head: true })
          .gt("scheduled_at", new Date().toISOString()),
        supabase.from("message_templates").select("id", { count: "exact", head: true })
          .eq("meta_status", "approved"),
        supabase.from("message_templates").select("id", { count: "exact", head: true })
          .eq("meta_status", "rejected"),
        supabase.from("messages").select("last_error")
          .eq("status", "failed").eq("direction", "out").gte("created_at", since)
          .not("last_error", "is", null).limit(400),
        supabase.from("messages").select("interaction_type")
          .eq("direction", "in").gte("created_at", since)
          .not("interaction_type", "is", null).limit(400),
        supabase.from("messages")
          .select("direction, status, created_at")
          .gte("created_at", since).limit(2000),
      ]);

      const byErrorMap = new Map<string, number>();
      for (const r of (errors.data ?? [])) {
        const key = (r.last_error ?? "Erro desconhecido").slice(0, 80);
        byErrorMap.set(key, (byErrorMap.get(key) ?? 0) + 1);
      }
      const byError = [...byErrorMap.entries()]
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count).slice(0, 6);

      const byInterMap = new Map<string, number>();
      for (const r of (interactions.data ?? [])) {
        const key = r.interaction_type ?? "outro";
        byInterMap.set(key, (byInterMap.get(key) ?? 0) + 1);
      }
      const byInteraction = [...byInterMap.entries()]
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count);

      // Daily aggregation
      const daysMap = new Map<string, { sent: number; delivered: number; failed: number }>();
      for (const r of (dailyRows.data ?? [])) {
        const d = (r.created_at ?? "").slice(0, 10);
        if (!d) continue;
        const cur = daysMap.get(d) ?? { sent: 0, delivered: 0, failed: 0 };
        if (r.direction === "out") cur.sent++;
        if (r.status === "delivered" || r.status === "read") cur.delivered++;
        if (r.status === "failed") cur.failed++;
        daysMap.set(d, cur);
      }
      const daily = [...daysMap.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, v]) => ({ date, ...v }));

      const sentCount = sent.count ?? 0;
      const inCount = inbound.count ?? 0;
      const outCount = outbound.count ?? 0;
      const responseRateBps = outCount > 0 ? Math.round((inCount / outCount) * 10_000) : 0;

      return {
        range, since,
        delivery: {
          sent: sentCount,
          delivered: delivered.count ?? 0,
          failed: failed.count ?? 0,
          read: read.count ?? 0,
          byError, daily,
        },
        engagement: {
          inbound: inCount,
          outbound: outCount,
          responseRateBps,
          avgResponseMinutes: null, // requires paired conversation logic; disponível em fase futura
          byInteraction,
        },
        journey: {
          templatesApproved: approvedTpl.count ?? 0,
          templatesRejected: rejectedTpl.count ?? 0,
          batches: batches.count ?? 0,
          scheduledFuture: scheduledFuture.count ?? 0,
        },
      };
    },
    staleTime: 60_000,
  });
}