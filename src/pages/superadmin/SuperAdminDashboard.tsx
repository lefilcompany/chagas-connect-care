import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, Building2, CheckCircle2, Clock3, MessageSquareWarning, Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSuperAdminScope } from "@/lib/superadmin-context";
import { Card } from "@/components/ui/card";

function MetricCard({ label, value, helper, icon: Icon }: { label: string; value: number | string; helper: string; icon: typeof Building2 }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-bold text-ink">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
        </div>
        <span className="rounded-xl bg-mint-soft p-2.5 text-care"><Icon className="h-5 w-5" /></span>
      </div>
    </Card>
  );
}

export default function SuperAdminDashboard() {
  const { selectedInstitution } = useSuperAdminScope();

  const { data, isLoading, error } = useQuery({
    queryKey: ["superadmin-dashboard", selectedInstitution],
    queryFn: async () => {
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const profilesRequest = selectedInstitution
        ? supabase.from("profiles").select("institution").eq("institution", selectedInstitution)
        : supabase.from("profiles").select("institution").neq("institution", "");
      const channelsRequest = selectedInstitution
        ? supabase.from("whatsapp_channels").select("id,institution,status,last_webhook_at,last_synced_at,quality_rating").eq("institution", selectedInstitution)
        : supabase.from("whatsapp_channels").select("id,institution,status,last_webhook_at,last_synced_at,quality_rating");
      const templatesRequest = selectedInstitution
        ? supabase.from("message_templates").select("id,institution,meta_status").eq("template_kind", "meta").eq("institution", selectedInstitution)
        : supabase.from("message_templates").select("id,institution,meta_status").eq("template_kind", "meta");
      const failuresRequest = selectedInstitution
        ? supabase.from("messages").select("id", { count: "exact", head: true }).eq("status", "failed").eq("direction", "out").eq("institution", selectedInstitution).gte("created_at", since24h)
        : supabase.from("messages").select("id", { count: "exact", head: true }).eq("status", "failed").eq("direction", "out").gte("created_at", since24h);
      const auditRequest = selectedInstitution
        ? supabase.from("whatsapp_admin_audit_log").select("id,action,entity,result,created_at,institution").eq("institution", selectedInstitution).order("created_at", { ascending: false }).limit(6)
        : supabase.from("whatsapp_admin_audit_log").select("id,action,entity,result,created_at,institution").order("created_at", { ascending: false }).limit(6);

      const [profiles, channels, templates, failures, audit] = await Promise.all([
        profilesRequest,
        channelsRequest,
        templatesRequest,
        failuresRequest,
        auditRequest,
      ]);

      const firstError = profiles.error || channels.error || templates.error || failures.error || audit.error;
      if (firstError) throw firstError;

      const channelRows = channels.data ?? [];
      const templateRows = templates.data ?? [];
      const institutions = new Set((profiles.data ?? []).map((row) => row.institution).filter(Boolean));
      const activeChannels = channelRows.filter((row) => row.status === "active" || row.status === "connected").length;
      const warningChannels = channelRows.filter((row) => !["active", "connected"].includes(row.status)).length;
      const latestWebhook = channelRows
        .map((row) => row.last_webhook_at)
        .filter(Boolean)
        .sort()
        .at(-1) ?? null;
      const latestSync = channelRows
        .map((row) => row.last_synced_at)
        .filter(Boolean)
        .sort()
        .at(-1) ?? null;

      return {
        institutionCount: selectedInstitution ? 1 : institutions.size,
        totalChannels: channelRows.length,
        activeChannels,
        warningChannels,
        failures24h: failures.count ?? 0,
        approvedTemplates: templateRows.filter((row) => row.meta_status === "approved").length,
        pendingTemplates: templateRows.filter((row) => ["submitted", "pending", "in_appeal"].includes(row.meta_status ?? "")).length,
        rejectedTemplates: templateRows.filter((row) => row.meta_status === "rejected").length,
        latestWebhook,
        latestSync,
        audit: audit.data ?? [],
      };
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-care">Administração global</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-ink">Visão geral da infraestrutura</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Indicadores técnicos de canais, mensagens e templates {selectedInstitution ? `da instituição ${selectedInstitution}` : "de todas as instituições"}.
        </p>
      </header>

      {error && <Card className="border-destructive/30 p-4 text-sm text-destructive">Não foi possível carregar os indicadores globais.</Card>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Instituições" value={isLoading ? "—" : data?.institutionCount ?? 0} helper="No escopo atual" icon={Building2} />
        <MetricCard label="Canais ativos" value={isLoading ? "—" : data?.activeChannels ?? 0} helper={`${data?.totalChannels ?? 0} canal(is) configurado(s)`} icon={CheckCircle2} />
        <MetricCard label="Canais com atenção" value={isLoading ? "—" : data?.warningChannels ?? 0} helper="Inativos ou inconsistentes" icon={AlertTriangle} />
        <MetricCard label="Falhas em 24h" value={isLoading ? "—" : data?.failures24h ?? 0} helper="Mensagens de saída" icon={MessageSquareWarning} />
        <MetricCard label="Templates aprovados" value={isLoading ? "—" : data?.approvedTemplates ?? 0} helper={`${data?.pendingTemplates ?? 0} pendentes · ${data?.rejectedTemplates ?? 0} rejeitados`} icon={Radio} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center gap-2"><Activity className="h-4 w-4 text-care" /><h2 className="font-semibold text-ink">Saúde recente</h2></div>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-muted/40 p-4">
              <dt className="text-xs text-muted-foreground">Último webhook</dt>
              <dd className="mt-1 text-sm font-semibold text-ink">{data?.latestWebhook ? new Date(data.latestWebhook).toLocaleString("pt-BR") : "Nenhum evento registrado"}</dd>
            </div>
            <div className="rounded-xl bg-muted/40 p-4">
              <dt className="text-xs text-muted-foreground">Última sincronização</dt>
              <dd className="mt-1 text-sm font-semibold text-ink">{data?.latestSync ? new Date(data.latestSync).toLocaleString("pt-BR") : "Nenhuma sincronização registrada"}</dd>
            </div>
          </dl>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-care" /><h2 className="font-semibold text-ink">Ações administrativas recentes</h2></div>
          <div className="mt-4 divide-y divide-border">
            {!data?.audit.length ? (
              <p className="py-4 text-sm text-muted-foreground">Nenhuma ação administrativa registrada.</p>
            ) : data.audit.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{item.action}</p>
                  <p className="truncate text-xs text-muted-foreground">{item.institution || "Escopo global"} · {item.entity}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs font-medium text-muted-foreground">{item.result || "—"}</p>
                  <p className="text-[11px] text-muted-foreground">{new Date(item.created_at).toLocaleString("pt-BR")}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
