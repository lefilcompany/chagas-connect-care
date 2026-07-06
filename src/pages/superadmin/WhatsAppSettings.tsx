import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useSuperAdminScope } from "@/lib/superadmin-context";
import { APP_DISPLAY_NAME } from "@/config/application";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type SignatureMode = "none" | "institution_name" | "powered_by" | "custom";
type FormState = {
  brand_name: string;
  application_display_name: string;
  signature_enabled: boolean;
  signature_mode: SignatureMode;
  custom_signature_text: string;
  append_signature_to_text: boolean;
  use_native_interactive_footer: boolean;
  use_as_template_footer_default: boolean;
  default_template_footer_text: string;
};

const buildDefaults = (institution: string): FormState => ({
  brand_name: institution,
  application_display_name: APP_DISPLAY_NAME,
  signature_enabled: true,
  signature_mode: "powered_by",
  custom_signature_text: "",
  append_signature_to_text: true,
  use_native_interactive_footer: true,
  use_as_template_footer_default: true,
  default_template_footer_text: "",
});

export default function WhatsAppSettings() {
  const { user } = useAuth();
  const { selectedInstitution } = useSuperAdminScope();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  const settings = useQuery({
    queryKey: ["superadmin-whatsapp-settings", selectedInstitution],
    queryFn: async () => {
      if (!selectedInstitution) return null;
      const { data, error } = await supabase
        .from("institution_whatsapp_settings")
        .select("brand_name,application_display_name,signature_enabled,signature_mode,custom_signature_text,append_signature_to_text,use_native_interactive_footer,use_as_template_footer_default,default_template_footer_text")
        .eq("institution", selectedInstitution)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedInstitution,
  });

  const channel = useQuery({
    queryKey: ["superadmin-channel-summary", selectedInstitution],
    queryFn: async () => {
      if (!selectedInstitution) return null;
      const { data, error } = await supabase
        .from("whatsapp_channels")
        .select("display_name,status,mode,quality_rating,last_webhook_at,last_synced_at,phone_number_id")
        .eq("institution", selectedInstitution)
        .order("last_synced_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedInstitution,
  });

  useEffect(() => {
    if (!selectedInstitution) return setForm(null);
    const base = buildDefaults(selectedInstitution);
    const row = settings.data;
    setForm(row ? {
      brand_name: row.brand_name ?? base.brand_name,
      application_display_name: row.application_display_name ?? base.application_display_name,
      signature_enabled: row.signature_enabled,
      signature_mode: row.signature_mode as SignatureMode,
      custom_signature_text: row.custom_signature_text ?? "",
      append_signature_to_text: row.append_signature_to_text,
      use_native_interactive_footer: row.use_native_interactive_footer,
      use_as_template_footer_default: row.use_as_template_footer_default,
      default_template_footer_text: row.default_template_footer_text ?? "",
    } : base);
  }, [selectedInstitution, settings.data]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => current ? { ...current, [key]: value } : current);
  };

  const save = async () => {
    if (!selectedInstitution || !form) return;
    if (form.signature_mode === "custom" && form.signature_enabled && !form.custom_signature_text.trim()) {
      return toast.error("Informe a assinatura personalizada.");
    }
    if (form.default_template_footer_text.length > 60) {
      return toast.error("O rodapé deve ter no máximo 60 caracteres.");
    }
    setSaving(true);
    const { error } = await supabase.from("institution_whatsapp_settings").upsert({
      institution: selectedInstitution,
      brand_name: form.brand_name.trim() || selectedInstitution,
      application_display_name: form.application_display_name.trim() || APP_DISPLAY_NAME,
      signature_enabled: form.signature_enabled,
      signature_mode: form.signature_mode,
      custom_signature_text: form.signature_mode === "custom" ? form.custom_signature_text.trim() : null,
      append_signature_to_text: form.append_signature_to_text,
      use_native_interactive_footer: form.use_native_interactive_footer,
      use_as_template_footer_default: form.use_as_template_footer_default,
      default_template_footer_text: form.default_template_footer_text.trim() || null,
      updated_by: user?.id ?? null,
    }, { onConflict: "institution" });
    setSaving(false);
    if (error) return toast.error(error.message);
    await queryClient.invalidateQueries({ queryKey: ["superadmin-whatsapp-settings", selectedInstitution] });
    toast.success("Configurações atualizadas.");
  };

  if (!selectedInstitution) {
    return <Card className="mx-auto max-w-2xl p-8 text-center"><Building2 className="mx-auto h-9 w-9 text-muted-foreground" /><h1 className="mt-4 text-xl font-semibold text-ink">Selecione uma instituição</h1><p className="mt-2 text-sm text-muted-foreground">Use o seletor lateral para editar as configurações do WhatsApp.</p></Card>;
  }

  return (
    <div className="space-y-6">
      <header><p className="text-xs font-bold uppercase tracking-[0.16em] text-care">WhatsApp · {selectedInstitution}</p><h1 className="mt-1 font-display text-3xl font-bold text-ink">Configurações do canal</h1><p className="mt-2 text-sm text-muted-foreground">Identidade institucional e regras de assinatura.</p></header>

      <Card className="p-5">
        <h2 className="font-semibold text-ink">Resumo técnico</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div><dt className="text-xs text-muted-foreground">Canal</dt><dd className="mt-1 text-sm font-semibold text-ink">{channel.data?.display_name || "Não configurado"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Status</dt><dd className="mt-1 text-sm font-semibold text-ink">{channel.data?.status || "inativo"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Modo / qualidade</dt><dd className="mt-1 text-sm font-semibold text-ink">{channel.data ? `${channel.data.mode} · ${channel.data.quality_rating || "sem avaliação"}` : "—"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Último webhook</dt><dd className="mt-1 text-sm font-semibold text-ink">{channel.data?.last_webhook_at ? new Date(channel.data.last_webhook_at).toLocaleString("pt-BR") : "—"}</dd></div>
        </dl>
      </Card>

      {!form || settings.isLoading ? <Card className="p-6 text-sm text-muted-foreground">Carregando configurações…</Card> : (
        <Card className="space-y-5 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="brand">Nome institucional</Label><Input id="brand" value={form.brand_name} onChange={(event) => update("brand_name", event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="app-name">Nome da aplicação</Label><Input id="app-name" value={form.application_display_name} onChange={(event) => update("application_display_name", event.target.value)} /></div>
          </div>
          <div className="flex items-center justify-between rounded-xl border p-4"><div><Label>Exibir assinatura</Label><p className="text-xs text-muted-foreground">Identifica a instituição nas mensagens elegíveis.</p></div><Switch checked={form.signature_enabled} onCheckedChange={(value) => update("signature_enabled", value)} /></div>
          <div className="space-y-2"><Label>Tipo de assinatura</Label><Select value={form.signature_mode} onValueChange={(value) => update("signature_mode", value as SignatureMode)} disabled={!form.signature_enabled}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Sem assinatura</SelectItem><SelectItem value="institution_name">Nome da instituição</SelectItem><SelectItem value="powered_by">Powered by aplicação</SelectItem><SelectItem value="custom">Texto personalizado</SelectItem></SelectContent></Select></div>
          {form.signature_mode === "custom" && <div className="space-y-2"><Label htmlFor="custom">Texto personalizado</Label><Input id="custom" maxLength={120} value={form.custom_signature_text} onChange={(event) => update("custom_signature_text", event.target.value)} /></div>}
          <div className="grid gap-3 rounded-xl border p-4">
            <div className="flex items-center justify-between"><div><Label>Texto livre</Label><p className="text-xs text-muted-foreground">Adicionar assinatura ao corpo.</p></div><Switch checked={form.append_signature_to_text} onCheckedChange={(value) => update("append_signature_to_text", value)} /></div>
            <div className="flex items-center justify-between"><div><Label>Mensagens interativas</Label><p className="text-xs text-muted-foreground">Usar rodapé nativo.</p></div><Switch checked={form.use_native_interactive_footer} onCheckedChange={(value) => update("use_native_interactive_footer", value)} /></div>
            <div className="flex items-center justify-between"><div><Label>Novos Templates Meta</Label><p className="text-xs text-muted-foreground">Aplicar rodapé padrão.</p></div><Switch checked={form.use_as_template_footer_default} onCheckedChange={(value) => update("use_as_template_footer_default", value)} /></div>
          </div>
          <div className="space-y-2"><Label htmlFor="footer">Rodapé padrão de templates</Label><Input id="footer" maxLength={60} value={form.default_template_footer_text} onChange={(event) => update("default_template_footer_text", event.target.value)} disabled={!form.use_as_template_footer_default} /><p className="text-right text-xs text-muted-foreground">{form.default_template_footer_text.length}/60</p></div>
          <div className="flex justify-end"><Button onClick={save} disabled={saving}><Save className="h-4 w-4" />{saving ? "Salvando…" : "Salvar alterações"}</Button></div>
        </Card>
      )}
    </div>
  );
}
