import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { toast } from "sonner";
import { RefreshCw, Search } from "lucide-react";
import { ChannelsTab } from "@/components/superadmin/ChannelsTab";
import { DiagnosticsTab } from "@/components/superadmin/DiagnosticsTab";

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
    <div className="space-y-4">
      <div className="flex justify-end">
        <SyncButton />
      </div>
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
    </div>
  );
}

function SyncButton() {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sync-whatsapp-templates", { body: {} });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      const n = data?.synced ?? data?.count ?? 0;
      toast.success(`Sincronização concluída${n ? ` — ${n} templates` : ""}.`);
      qc.invalidateQueries({ queryKey: ["superadmin-templates"] });
      qc.invalidateQueries({ queryKey: ["last-sync"] });
      qc.invalidateQueries({ queryKey: ["superadmin-count"] });
    },
    onError: (err: any) => toast.error(err?.message ?? "Falha ao sincronizar."),
  });
  return (
    <Button size="sm" variant="outline" disabled={m.isPending} onClick={() => m.mutate()}>
      <RefreshCw className={"h-4 w-4 mr-2 " + (m.isPending ? "animate-spin" : "")} />
      Sincronizar templates
    </Button>
  );
}

function TemplatesTab() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [selected, setSelected] = useState<any | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["superadmin-templates"],
    queryFn: async () => {
      const { data } = await supabase
        .from("message_templates")
        .select("id, institution, name, meta_template_name, meta_language, meta_category, meta_status, meta_version, meta_has_local_differences, meta_rejection_reason, meta_last_synced_at, meta_header_type, meta_header_text, meta_body_text, meta_footer_text, meta_buttons, meta_template_id")
        .eq("template_kind", "meta")
        .order("meta_last_synced_at", { ascending: false })
        .limit(200);
      return (data as any[]) ?? [];
    },
  });

  const filtered = useMemo(() => {
    const list = (data ?? []) as any[];
    const q = search.trim().toLowerCase();
    return list.filter((t) => {
      if (status !== "all" && t.meta_status !== status) return false;
      if (!q) return true;
      return [t.name, t.meta_template_name, t.institution, t.meta_language, t.meta_category]
        .some((v) => String(v ?? "").toLowerCase().includes(q));
    });
  }, [data, search, status]);

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, instituição, idioma…" className="pl-8" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="approved">Aprovados</SelectItem>
            <SelectItem value="submitted">Pendentes</SelectItem>
            <SelectItem value="rejected">Rejeitados</SelectItem>
            <SelectItem value="paused">Pausados</SelectItem>
            <SelectItem value="disabled">Desabilitados</SelectItem>
          </SelectContent>
        </Select>
        <SyncButton />
      </div>
      <div className="overflow-x-auto border rounded-md">
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
          {filtered.map((t: any) => (
            <TableRow key={t.id} className="cursor-pointer" onClick={() => setSelected(t)}>
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
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                Nenhum template corresponde ao filtro.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      </div>
      <TemplateDetailSheet template={selected} onOpenChange={(o) => !o && setSelected(null)} />
    </div>
  );
}

function TemplateDetailSheet({ template, onOpenChange }: { template: any | null; onOpenChange: (o: boolean) => void }) {
  return (
    <Sheet open={!!template} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        {template && (
          <>
            <SheetHeader>
              <SheetTitle className="font-mono text-base">{template.meta_template_name ?? template.name}</SheetTitle>
              <SheetDescription>
                {template.institution ?? "—"} · {template.meta_language ?? "—"} · {template.meta_category ?? "—"}
              </SheetDescription>
            </SheetHeader>
            <div className="mt-4 space-y-4 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant={template.meta_status === "approved" ? "default" : template.meta_status === "rejected" ? "destructive" : "secondary"}>
                  {template.meta_status ?? "—"}
                </Badge>
                {template.meta_has_local_differences && <Badge variant="destructive">Divergente da Meta</Badge>}
                {template.meta_version && <Badge variant="outline">v{template.meta_version}</Badge>}
              </div>
              {template.meta_rejection_reason && (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs">
                  <div className="font-medium text-destructive mb-1">Motivo da rejeição</div>
                  <div>{template.meta_rejection_reason}</div>
                </div>
              )}
              <Section label="Header">
                <div className="text-xs text-muted-foreground mb-1">Tipo: {template.meta_header_type ?? "—"}</div>
                <Pre>{template.meta_header_text ?? "—"}</Pre>
              </Section>
              <Section label="Body"><Pre>{template.meta_body_text ?? "—"}</Pre></Section>
              <Section label="Footer"><Pre>{template.meta_footer_text ?? "—"}</Pre></Section>
              <Section label="Botões">
                <Pre>{template.meta_buttons ? JSON.stringify(template.meta_buttons, null, 2) : "—"}</Pre>
              </Section>
              <div className="text-xs text-muted-foreground pt-2 border-t space-y-1">
                <div>ID Meta: <span className="font-mono">{template.meta_template_id ?? "—"}</span></div>
                <div>Sincronizado em: {template.meta_last_synced_at ? new Date(template.meta_last_synced_at).toLocaleString() : "—"}</div>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">{label}</div>
      {children}
    </div>
  );
}
function Pre({ children }: { children: React.ReactNode }) {
  return <pre className="bg-muted rounded-md p-2 text-xs whitespace-pre-wrap break-words">{children}</pre>;
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
            <TabsTrigger value="channels">Canais</TabsTrigger>
            <TabsTrigger value="diagnostics">Diagnóstico</TabsTrigger>
            <TabsTrigger value="webhook">Webhook</TabsTrigger>
            <TabsTrigger value="audit">Auditoria</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-6"><OverviewTab /></TabsContent>
          <TabsContent value="templates" className="mt-6"><TemplatesTab /></TabsContent>
          <TabsContent value="channels" className="mt-6"><ChannelsTab /></TabsContent>
          <TabsContent value="diagnostics" className="mt-6"><DiagnosticsTab /></TabsContent>
          <TabsContent value="webhook" className="mt-6"><WebhookTab /></TabsContent>
          <TabsContent value="audit" className="mt-6"><AuditTab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}