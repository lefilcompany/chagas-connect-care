import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Info, Settings, RefreshCw, CheckCircle2, XCircle, HelpCircle, Clock, AlertTriangle, Wrench } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { WhatsAppPreview } from "@/components/app/messages/WhatsAppPreview";
import { APP_DISPLAY_NAME, DEFAULT_POWERED_BY_TEXT } from "@/config/application";

type SignatureMode = "none" | "institution_name" | "powered_by" | "custom";

type Settings = {
  id?: string;
  institution: string;
  brand_name: string | null;
  signature_mode: SignatureMode;
  custom_signature_text: string | null;
  application_display_name: string | null;
  append_signature_to_text: boolean;
  use_native_interactive_footer: boolean;
  use_as_template_footer_default: boolean;
  default_template_footer_text: string | null;
  signature_enabled: boolean;
};

function resolveSignaturePreview(s: Settings): string {
  if (!s.signature_enabled) return "";
  const appName = (s.application_display_name ?? "").trim() || APP_DISPLAY_NAME;
  const brand = (s.brand_name ?? "").trim() || s.institution;
  switch (s.signature_mode) {
    case "none": return "";
    case "institution_name": return brand;
    case "powered_by": return `Powered by ${appName}`;
    case "custom": return (s.custom_signature_text ?? "").trim();
  }
}

export default function WhatsAppSettings() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [institution, setInstitution] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: prof }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("institution").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);
      setInstitution((prof as any)?.institution ?? "");
      setIsAdmin(((roles as any[]) ?? []).some((r) => r.role === "admin"));
    })();
  }, [user]);

  const { data: row, isLoading, isError, refetch } = useQuery({
    queryKey: ["institutionWhatsAppSettings", institution],
    queryFn: async (): Promise<Settings | null> => {
      if (!institution) return null;
      const { data, error } = await supabase
        .from("institution_whatsapp_settings" as any)
        .select("*")
        .eq("institution", institution)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as Settings | null) ?? null;
    },
    enabled: !!institution,
  });

  const [form, setForm] = useState<Settings | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!institution) return;
    if (row) setForm({ ...row });
    else {
      setForm({
        institution,
        brand_name: institution,
        signature_mode: "powered_by",
        custom_signature_text: null,
        application_display_name: APP_DISPLAY_NAME,
        append_signature_to_text: true,
        use_native_interactive_footer: true,
        use_as_template_footer_default: true,
        default_template_footer_text: null,
        signature_enabled: true,
      });
    }
    setDirty(false);
  }, [row, institution]);

  const update = <K extends keyof Settings>(k: K, v: Settings[K]) => {
    setForm((f) => (f ? { ...f, [k]: v } : f));
    setDirty(true);
  };

  const signaturePreview = useMemo(() => (form ? resolveSignaturePreview(form) : ""), [form]);

  async function onSave() {
    if (!form || !isAdmin) return;
    if (form.signature_mode === "custom" && !(form.custom_signature_text ?? "").trim()) {
      toast.error("Texto da assinatura personalizada não pode ficar vazio.");
      return;
    }
    if ((form.default_template_footer_text ?? "").length > 60) {
      toast.error("Rodapé padrão de Template Meta excede 60 caracteres.");
      return;
    }
    setSaving(true);
    const payload = {
      institution,
      brand_name: form.brand_name,
      signature_mode: form.signature_mode,
      custom_signature_text:
        form.signature_mode === "custom" ? form.custom_signature_text : null,
      application_display_name: form.application_display_name,
      append_signature_to_text: form.append_signature_to_text,
      use_native_interactive_footer: form.use_native_interactive_footer,
      use_as_template_footer_default: form.use_as_template_footer_default,
      default_template_footer_text: form.default_template_footer_text,
      signature_enabled: form.signature_enabled,
      updated_by: user?.id ?? null,
    };
    const { error } = row?.id
      ? await supabase
          .from("institution_whatsapp_settings" as any)
          .update(payload)
          .eq("id", row.id)
      : await supabase
          .from("institution_whatsapp_settings" as any)
          .insert({ ...payload, created_by: user?.id ?? null });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Configurações salvas.");
    setDirty(false);
    qc.invalidateQueries({ queryKey: ["institutionWhatsAppSettings", institution] });
    refetch();
  }

  if (!institution) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="flex items-center gap-3">
        <div className="rounded-lg bg-muted p-2">
          <Settings className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">WhatsApp</h1>
          <p className="text-sm text-muted-foreground">
            Configure o canal, a identidade institucional e como sua marca aparece nas mensagens.
          </p>
        </div>
      </header>

      {!isAdmin && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Apenas administradores podem alterar estas configurações. Você está em modo somente leitura.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="identity">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="identity">Identidade e assinatura</TabsTrigger>
          <TabsTrigger value="templates">Templates Meta</TabsTrigger>
          <TabsTrigger value="channel">Canal</TabsTrigger>
          <TabsTrigger value="diagnostics">Diagnóstico</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">
              Use a aba <strong>Identidade e assinatura</strong> para definir como sua instituição
              aparece nas mensagens. As demais abas serão liberadas em breve.
            </p>
          </Card>
        </TabsContent>

        <TabsContent value="identity">
          {isLoading || !form ? (
            <div className="grid gap-6 md:grid-cols-2">
              <Skeleton className="h-[480px] w-full" />
              <Skeleton className="h-[480px] w-full" />
            </div>
          ) : isError ? (
            <Alert variant="destructive">
              <AlertDescription>
                Não foi possível carregar a configuração.{" "}
                <button className="underline" onClick={() => refetch()}>Tentar novamente</button>
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {/* ===================== Form ===================== */}
              <Card className="space-y-5 p-5">
                <div className="space-y-2">
                  <Label htmlFor="brand_name">Nome institucional</Label>
                  <Input
                    id="brand_name"
                    value={form.brand_name ?? ""}
                    onChange={(e) => update("brand_name", e.target.value)}
                    placeholder={institution}
                    disabled={!isAdmin}
                  />
                  <p className="text-xs text-muted-foreground">Como sua marca aparece para o destinatário.</p>
                </div>

                <div className="flex items-center justify-between rounded-md border border-border p-3">
                  <div>
                    <Label className="text-sm">Exibir identidade nas mensagens</Label>
                    <p className="text-xs text-muted-foreground">Quando desligado, nenhum texto é adicionado.</p>
                  </div>
                  <Switch
                    checked={form.signature_enabled}
                    onCheckedChange={(v) => update("signature_enabled", v)}
                    disabled={!isAdmin}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Tipo de assinatura</Label>
                  <RadioGroup
                    value={form.signature_mode}
                    onValueChange={(v) => update("signature_mode", v as SignatureMode)}
                    disabled={!isAdmin || !form.signature_enabled}
                    className="grid gap-2"
                  >
                    {[
                      { v: "none", l: "Sem assinatura", d: "Nenhum texto adicional." },
                      { v: "institution_name", l: "Nome da instituição", d: form.brand_name || institution },
                      { v: "powered_by", l: "Powered by aplicação", d: DEFAULT_POWERED_BY_TEXT },
                      { v: "custom", l: "Texto personalizado", d: "Você define o texto abaixo." },
                    ].map((o) => (
                      <Label
                        key={o.v}
                        htmlFor={`sm-${o.v}`}
                        className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 hover:bg-muted/40"
                      >
                        <RadioGroupItem id={`sm-${o.v}`} value={o.v} className="mt-1" />
                        <span>
                          <span className="block text-sm font-medium">{o.l}</span>
                          <span className="block text-xs text-muted-foreground">{o.d}</span>
                        </span>
                      </Label>
                    ))}
                  </RadioGroup>
                </div>

                {form.signature_mode === "custom" && (
                  <div className="space-y-2">
                    <Label htmlFor="custom_signature_text">Texto personalizado</Label>
                    <Textarea
                      id="custom_signature_text"
                      value={form.custom_signature_text ?? ""}
                      onChange={(e) => update("custom_signature_text", e.target.value)}
                      rows={2}
                      maxLength={120}
                      disabled={!isAdmin || !form.signature_enabled}
                    />
                  </div>
                )}

                <div className="space-y-3 rounded-md border border-border p-3">
                  <p className="text-sm font-medium">Onde aplicar</p>

                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Label className="text-sm">Mensagens de texto livre</Label>
                        <p className="text-xs text-muted-foreground">
                          A assinatura é adicionada dentro do balão da mensagem.
                        </p>
                      </div>
                      <Switch
                        checked={form.append_signature_to_text}
                        onCheckedChange={(v) => update("append_signature_to_text", v)}
                        disabled={!isAdmin || !form.signature_enabled}
                      />
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Label className="text-sm">Mensagens interativas</Label>
                        <p className="text-xs text-muted-foreground">
                          O WhatsApp exibe o texto como rodapé nativo (até 60 caracteres).
                        </p>
                      </div>
                      <Switch
                        checked={form.use_native_interactive_footer}
                        onCheckedChange={(v) => update("use_native_interactive_footer", v)}
                        disabled={!isAdmin || !form.signature_enabled}
                      />
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Label className="text-sm">Rodapé padrão para novos Templates Meta</Label>
                        <p className="text-xs text-muted-foreground">
                          O rodapé faz parte do template aprovado e não pode ser alterado em runtime.
                        </p>
                      </div>
                      <Switch
                        checked={form.use_as_template_footer_default}
                        onCheckedChange={(v) => update("use_as_template_footer_default", v)}
                        disabled={!isAdmin}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="default_template_footer_text">Rodapé padrão de novos Templates Meta</Label>
                  <Input
                    id="default_template_footer_text"
                    value={form.default_template_footer_text ?? ""}
                    onChange={(e) => update("default_template_footer_text", e.target.value)}
                    maxLength={60}
                    disabled={!isAdmin || !form.use_as_template_footer_default}
                  />
                  <p className="text-right text-[11px] text-muted-foreground">
                    {(form.default_template_footer_text ?? "").length}/60
                  </p>
                </div>
              </Card>

              {/* ===================== Preview ===================== */}
              <Card className="space-y-4 p-5">
                <div>
                  <p className="text-sm font-medium">Pré-visualização</p>
                  <p className="text-xs text-muted-foreground">
                    Como cada tipo de mensagem aparecerá com a configuração atual.
                  </p>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold text-muted-foreground">Texto livre</p>
                <WhatsAppPreview
                  recipientName="João"
                  body={
                    "Olá, João. Sua consulta está confirmada para amanhã às 10h." +
                    (form.append_signature_to_text && form.signature_enabled && signaturePreview
                      ? `\n\n_${signaturePreview}_`
                      : "")
                  }
                  highlightVars={false}
                />
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold text-muted-foreground">Interativa (botões)</p>
                  <WhatsAppPreview
                    recipientName="João"
                    messageType="interactive"
                    body={"Como podemos ajudar você hoje?"}
                    footer={
                      form.use_native_interactive_footer && form.signature_enabled && signaturePreview
                        ? signaturePreview.slice(0, 60)
                        : null
                    }
                    buttons={[
                      { type: "quick_reply", text: "Falar com a equipe" },
                      { type: "quick_reply", text: "Confirmar consulta" },
                    ]}
                    highlightVars={false}
                  />
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold text-muted-foreground">
                    Template Meta (rodapé estático aprovado)
                  </p>
                  <WhatsAppPreview
                    recipientName="João"
                    messageType="template"
                    templateStatus="Aprovado"
                    body={"Olá, João. Confirmamos sua consulta para 03/07 às 10h."}
                    footer={(form.default_template_footer_text ?? "").trim() || null}
                    highlightVars={false}
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    O rodapé do template não pode ser alterado em runtime — exige uma nova versão aprovada pela Meta.
                  </p>
                </div>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="templates">
          <TemplatesMetaTab institution={institution} isAdmin={isAdmin} />
        </TabsContent>

        <TabsContent value="channel">
          <ChannelTab institution={institution} isAdmin={isAdmin} />
        </TabsContent>

        <TabsContent value="diagnostics">
          <DiagnosticsTab isAdmin={isAdmin} />
        </TabsContent>
      </Tabs>

      {dirty && isAdmin && (
        <div className="sticky bottom-0 flex items-center justify-between rounded-md border border-border bg-card p-3 shadow">
          <p className="text-sm text-muted-foreground">Há alterações não salvas.</p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => { setForm(row ? { ...row } : form); setDirty(false); }}>
              Cancelar
            </Button>
            <Button onClick={onSave} disabled={saving}>
              {saving ? "Salvando…" : "Salvar alterações"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================================
// Templates Meta tab — list + sync trigger
// =========================================================
function TemplatesMetaTab({ institution, isAdmin }: { institution: string; isAdmin: boolean }) {
  const qc = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["whatsappTemplates", institution],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("message_templates")
        .select("id,name,meta_template_name,meta_language,meta_status,meta_category,meta_footer_text,meta_has_local_differences,meta_last_synced_at")
        .eq("template_kind", "meta")
        .order("meta_last_synced_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!institution,
  });

  async function onSync() {
    if (!isAdmin) return;
    setSyncing(true);
    const { data: res, error } = await supabase.functions.invoke("sync-whatsapp-templates", { body: {} });
    setSyncing(false);
    if (error || !(res as any)?.ok) {
      toast.error((error?.message ?? (res as any)?.error) || "Falha ao sincronizar templates");
      return;
    }
    toast.success(`Sincronizados: ${(res as any).updated} | Não mapeados: ${(res as any).unmapped}`);
    qc.invalidateQueries({ queryKey: ["whatsappTemplates", institution] });
    refetch();
  }

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Templates aprovados na Meta</p>
          <p className="text-xs text-muted-foreground">
            Sincronize para trazer status, categoria, rodapé oficial e divergências locais.
          </p>
        </div>
        <Button size="sm" onClick={onSync} disabled={!isAdmin || syncing}>
          <RefreshCw className={"h-4 w-4 " + (syncing ? "animate-spin" : "")} />
          {syncing ? "Sincronizando…" : "Sincronizar agora"}
        </Button>
      </div>
      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : !data || data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum template Meta encontrado ainda.</p>
      ) : (
        <div className="divide-y divide-border rounded-md border border-border">
          {(data as any[]).map((t) => (
            <div key={t.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{t.meta_template_name ?? t.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {t.meta_language ?? "—"} · {t.meta_category ?? "—"}
                  {t.meta_footer_text ? ` · rodapé: "${t.meta_footer_text}"` : ""}
                </p>
              </div>
              <span className={
                "rounded-full px-2 py-0.5 text-xs " +
                (t.meta_status === "approved"
                  ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
                  : t.meta_status === "rejected"
                    ? "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200"
                    : "bg-muted text-muted-foreground")
              }>
                {t.meta_status ?? "—"}
              </span>
              {t.meta_has_local_differences && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                  Divergente
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// =========================================================
// Channel tab
// =========================================================
function ChannelTab({ institution }: { institution: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["whatsappChannels", institution],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_channels" as any)
        .select("*")
        .eq("institution", institution);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!institution,
  });

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  const channels = (data as any[]) ?? [];

  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-5">
        <p className="text-sm font-medium">Canal compartilhado</p>
        {channels.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum canal cadastrado para esta instituição.
          </p>
        ) : (
          channels.map((c) => (
            <div key={c.id} className="rounded-md border border-border p-3 text-sm">
              <p className="font-medium">{c.display_name ?? c.display_phone_number ?? "Sem nome"}</p>
              <p className="text-xs text-muted-foreground">
                Modo: {c.mode} · Status: {c.status}
                {c.last_webhook_at ? ` · Último webhook: ${new Date(c.last_webhook_at).toLocaleString()}` : ""}
              </p>
              {c.notes && <p className="mt-1 text-xs text-muted-foreground">{c.notes}</p>}
            </div>
          ))
        )}
      </Card>
      <Card className="space-y-2 p-5 opacity-70">
        <p className="text-sm font-medium">Canal dedicado</p>
        <p className="text-xs text-muted-foreground">
          Canal dedicado por instituição ainda não está disponível. O armazenamento seguro de credenciais
          será habilitado em uma evolução futura.
        </p>
      </Card>
    </div>
  );
}

// =========================================================
// Diagnostics tab
// =========================================================
function DiagnosticsTab({ isAdmin }: { isAdmin: boolean }) {
  const [running, setRunning] = useState(false);
  const [checks, setChecks] = useState<Array<{ id: string; label: string; state: string; detail?: string }>>([]);

  async function onRun() {
    setRunning(true);
    const { data, error } = await supabase.functions.invoke("whatsapp-diagnostics", { body: {} });
    setRunning(false);
    if (error || !(data as any)?.ok) {
      toast.error(error?.message ?? "Falha ao executar diagnóstico");
      return;
    }
    setChecks((data as any).checks ?? []);
  }

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Diagnóstico da integração</p>
          <p className="text-xs text-muted-foreground">
            Mostra apenas o estado de cada item — nunca exibe valores sensíveis.
          </p>
        </div>
        <Button size="sm" onClick={onRun} disabled={!isAdmin || running}>
          <RefreshCw className={"h-4 w-4 " + (running ? "animate-spin" : "")} />
          {running ? "Executando…" : "Executar diagnóstico"}
        </Button>
      </div>
      {checks.length === 0 ? (
        <p className="text-sm text-muted-foreground">Clique em "Executar diagnóstico" para começar.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {checks.map((c) => (
            <li key={c.id} className="flex items-center gap-3 p-3 text-sm">
              {c.state === "configurado" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : c.state === "nao_configurado" ? (
                <XCircle className="h-4 w-4 text-red-600" />
              ) : (
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="flex-1">{c.label}</span>
              <span className="text-xs text-muted-foreground">
                {c.state}{c.detail ? ` · ${c.detail}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}