import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useInstitutionScope } from "@/components/superadmin/InstitutionScope";

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-ink">{value}</div>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export default function SuperAdminDashboard() {
  const { selected, isAll } = useInstitutionScope();

  const { data } = useQuery({
    queryKey: ["sa-dashboard", selected],
    staleTime: 60_000,
    queryFn: async () => {
      const since24h = new Date(Date.now() - 86400_000).toISOString();

      const chBase = supabase.from("whatsapp_channels").select("status,last_webhook_at,last_synced_at,institution");
      const chQuery = isAll ? chBase : chBase.eq("institution", selected);
      const [{ data: chRows }, { count: institutionsCount }, failuresRes, tplRes] = await Promise.all([
        chQuery,
        supabase.from("profiles").select("institution", { count: "exact", head: true }).not("institution", "is", null),
        (() => {
          const q = supabase.from("messages")
            .select("id", { count: "exact", head: true })
            .eq("status", "failed").eq("direction", "out")
            .gte("created_at", since24h);
          return isAll ? q : q.eq("institution", selected);
        })(),
        (() => {
          const q = supabase.from("message_templates").select("meta_status,institution");
          return isAll ? q : q.eq("institution", selected);
        })(),
      ]);

      const channels = (chRows ?? []) as Array<{ status: string; last_webhook_at: string | null; last_synced_at: string | null }>;
      const active = channels.filter((c) => c.status === "active").length;
      const attention = channels.filter((c) => c.status && c.status !== "active" && c.status !== "inactive").length;
      const inactive = channels.filter((c) => c.status === "inactive").length;

      const lastWebhook = channels.map((c) => c.last_webhook_at).filter(Boolean).sort().pop();
      const lastSync = channels.map((c) => c.last_synced_at).filter(Boolean).sort().pop();

      const tpls = (tplRes.data ?? []) as Array<{ meta_status: string | null }>;
      const approved = tpls.filter((t) => t.meta_status === "approved").length;
      const pending = tpls.filter((t) => t.meta_status === "pending" || t.meta_status === "in_review").length;
      const rejected = tpls.filter((t) => t.meta_status === "rejected").length;

      return {
        institutions: institutionsCount ?? 0,
        totalChannels: channels.length,
        active, attention, inactive,
        failures: failuresRes.count ?? 0,
        lastWebhook: lastWebhook ? new Date(lastWebhook).toLocaleString("pt-BR") : "—",
        lastSync: lastSync ? new Date(lastSync).toLocaleString("pt-BR") : "—",
        approved, pending, rejected,
      };
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink md:text-3xl">Visão geral da plataforma</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Dados consolidados {isAll ? "de todas as instituições" : `da instituição “${selected}”`}.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Instituições" value={data?.institutions ?? "—"} />
        <Stat label="Canais configurados" value={data?.totalChannels ?? "—"} />
        <Stat label="Canais ativos" value={data?.active ?? "—"} />
        <Stat label="Canais em atenção" value={data?.attention ?? "—"} />
        <Stat label="Canais inativos" value={data?.inactive ?? "—"} />
        <Stat label="Falhas de envio (24h)" value={data?.failures ?? "—"} />
        <Stat label="Último webhook" value={data?.lastWebhook ?? "—"} />
        <Stat label="Última sincronização" value={data?.lastSync ?? "—"} />
        <Stat label="Templates aprovados" value={data?.approved ?? "—"} />
        <Stat label="Templates pendentes" value={data?.pending ?? "—"} />
        <Stat label="Templates rejeitados" value={data?.rejected ?? "—"} />
      </div>
    </div>
  );
}