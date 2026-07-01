import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

function useCount(table: string, filters: Array<[string, unknown]> = []) {
  return useQuery({
    queryKey: ["superadmin-count", table, filters],
    queryFn: async () => {
      let q: any = supabase.from(table as any).select("*", { count: "exact", head: true });
      for (const [k, v] of filters) q = q.eq(k, v);
      const { count } = await q;
      return count ?? 0;
    },
  });
}

function OverviewTab() {
  const approved = useCount("message_templates", [["template_kind", "meta"], ["meta_status", "approved"]]);
  const pending = useCount("message_templates", [["template_kind", "meta"], ["meta_status", "submitted"]]);
  const rejected = useCount("message_templates", [["template_kind", "meta"], ["meta_status", "rejected"]]);
  const paused = useCount("message_templates", [["template_kind", "meta"], ["meta_status", "paused"]]);
  const channels = useCount("whatsapp_channels");
  const settings = useCount("institution_whatsapp_settings");

  const { data: lastWebhook } = useQuery({
    queryKey: ["last-webhook"],
    queryFn: async () => {
      const { data } = await supabase
        .from("whatsapp_webhook_activity")
        .select("received_at, event_type")
        .order("received_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as any;
    },
  });
  const { data: lastSync } = useQuery({
    queryKey: ["last-sync"],
    queryFn: async () => {
      const { data } = await supabase
        .from("message_templates")
        .select("meta_last_synced_at")
        .not("meta_last_synced_at", "is", null)
        .order("meta_last_synced_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data as any)?.meta_last_synced_at ?? null;
    },
  });

  const cards: Array<{ label: string; value: number | string | null | undefined }> = [
    { label: "Templates aprovados", value: approved.data },
    { label: "Templates pendentes", value: pending.data },
    { label: "Templates rejeitados", value: rejected.data },
    { label: "Templates pausados", value: paused.data },
    { label: "Canais configurados", value: channels.data },
    { label: "Instituições com config.", value: settings.data },
    { label: "Última sincronização", value: lastSync ? new Date(lastSync).toLocaleString() : "—" },
    { label: "Último webhook", value: lastWebhook?.received_at ? new Date(lastWebhook.received_at).toLocaleString() : "—" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {c.value === undefined ? <Skeleton className="h-7 w-16" /> : c.value ?? "—"}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TemplatesTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["superadmin-templates"],
    queryFn: async () => {
      const { data } = await supabase
        .from("message_templates")
        .select("id, institution, name, meta_template_name, meta_language, meta_category, meta_status, meta_version, meta_has_local_differences, meta_rejection_reason, meta_last_synced_at")
        .eq("template_kind", "meta")
        .order("meta_last_synced_at", { ascending: false })
        .limit(200);
      return (data as any[]) ?? [];
    },
  });

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Instituição</TableHead>
            <TableHead>Nome Meta</TableHead>
            <TableHead>Idioma</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Divergente</TableHead>
            <TableHead>Sincronizado em</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(data ?? []).map((t: any) => (
            <TableRow key={t.id}>
              <TableCell>{t.institution ?? "—"}</TableCell>
              <TableCell className="font-mono text-xs">{t.meta_template_name ?? t.name}</TableCell>
              <TableCell>{t.meta_language ?? "—"}</TableCell>
              <TableCell>{t.meta_category ?? "—"}</TableCell>
              <TableCell>
                <Badge variant={t.meta_status === "approved" ? "default" : t.meta_status === "rejected" ? "destructive" : "secondary"}>
                  {t.meta_status ?? "—"}
                </Badge>
              </TableCell>
              <TableCell>{t.meta_has_local_differences ? <Badge variant="destructive">Sim</Badge> : "Não"}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {t.meta_last_synced_at ? new Date(t.meta_last_synced_at).toLocaleString() : "—"}
              </TableCell>
            </TableRow>
          ))}
          {(data ?? []).length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                Nenhum template Meta encontrado.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function WebhookTab() {
  const { data: activity, isLoading } = useQuery({
    queryKey: ["webhook-activity"],
    queryFn: async () => {
      const { data } = await supabase
        .from("whatsapp_webhook_activity")
        .select("received_at, event_type, phone_number_id, institution, processed, error_code")
        .order("received_at", { ascending: false })
        .limit(50);
      return (data as any[]) ?? [];
    },
  });

  const callbackUrl = `${window.location.origin.replace(/\/$/, "")}/functions/v1/whatsapp-webhook`;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Callback URL</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-1">
          <p className="font-mono break-all">https://czrstjmhgfewlsetsrvl.functions.supabase.co/whatsapp-webhook</p>
          <p className="text-xs text-muted-foreground">
            Configure este endpoint no App Meta com o mesmo Verify Token armazenado como
            secret de servidor.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Últimos eventos</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-40 w-full" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recebido</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>Phone ID</TableHead>
                  <TableHead>Instituição</TableHead>
                  <TableHead>Processado</TableHead>
                  <TableHead>Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(activity ?? []).map((a: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs">{new Date(a.received_at).toLocaleString()}</TableCell>
                    <TableCell className="font-mono text-xs">{a.event_type}</TableCell>
                    <TableCell className="font-mono text-xs">{a.phone_number_id ?? "—"}</TableCell>
                    <TableCell>{a.institution ?? "—"}</TableCell>
                    <TableCell>{a.processed ? "Sim" : "Não"}</TableCell>
                    <TableCell className="text-xs text-destructive">{a.error_code ?? ""}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AuditTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["audit"],
    queryFn: async () => {
      const { data } = await supabase
        .from("whatsapp_admin_audit_log")
        .select("id, created_at, user_id, actor_role, institution, entity, action, result, error_code")
        .order("created_at", { ascending: false })
        .limit(200);
      return (data as any[]) ?? [];
    },
  });
  if (isLoading) return <Skeleton className="h-64 w-full" />;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Data</TableHead>
          <TableHead>Usuário</TableHead>
          <TableHead>Papel</TableHead>
          <TableHead>Instituição</TableHead>
          <TableHead>Entidade</TableHead>
          <TableHead>Ação</TableHead>
          <TableHead>Resultado</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {(data ?? []).map((r: any) => (
          <TableRow key={r.id}>
            <TableCell className="text-xs">{new Date(r.created_at).toLocaleString()}</TableCell>
            <TableCell className="font-mono text-xs">{r.user_id?.slice(0, 8)}…</TableCell>
            <TableCell>{r.actor_role}</TableCell>
            <TableCell>{r.institution ?? "—"}</TableCell>
            <TableCell>{r.entity}</TableCell>
            <TableCell>{r.action}</TableCell>
            <TableCell>{r.result ?? ""}</TableCell>
          </TableRow>
        ))}
        {(data ?? []).length === 0 && (
          <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">Sem eventos.</TableCell></TableRow>
        )}
      </TableBody>
    </Table>
  );
}

export default function WhatsAppAdmin() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "overview";
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Central Superadmin — WhatsApp</h1>
            <p className="text-xs text-muted-foreground">Administração global da integração Meta Cloud API.</p>
          </div>
          <Button asChild variant="outline" size="sm"><Link to="/app">Voltar ao app</Link></Button>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-6">
        <Tabs value={tab} onValueChange={(v) => setParams({ tab: v })}>
          <TabsList>
            <TabsTrigger value="overview">Visão geral</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="webhook">Webhook</TabsTrigger>
            <TabsTrigger value="audit">Auditoria</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-6"><OverviewTab /></TabsContent>
          <TabsContent value="templates" className="mt-6"><TemplatesTab /></TabsContent>
          <TabsContent value="webhook" className="mt-6"><WebhookTab /></TabsContent>
          <TabsContent value="audit" className="mt-6"><AuditTab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}