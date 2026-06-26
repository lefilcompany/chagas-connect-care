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
import { Info, Settings } from "lucide-react";
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
          <TabsTrigger value="templates" disabled>Templates Meta</TabsTrigger>
          <TabsTrigger value="channel" disabled>Canal</TabsTrigger>
          <TabsTrigger value="diagnostics" disabled>Diagnóstico</TabsTrigger>
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
                    Como ficará uma mensagem livre com a configuração atual.
                  </p>
                </div>
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
                <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                  <p className="mb-1 font-medium text-foreground">Mensagem interativa</p>
                  <p>
                    O rodapé{" "}
                    {form.use_native_interactive_footer && signaturePreview
                      ? `"${signaturePreview}"`
                      : "não será incluído"}{" "}
                    aparecerá em texto menor, separado do corpo.
                  </p>
                </div>
                <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                  <p className="mb-1 font-medium text-foreground">Template Meta</p>
                  <p>
                    O rodapé é parte da definição aprovada na Meta. Para alterar, será necessário
                    criar uma nova versão e aguardar nova aprovação.
                  </p>
                </div>
              </Card>
            </div>
          )}
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