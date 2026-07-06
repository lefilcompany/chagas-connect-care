import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSuperAdminScope } from "@/lib/superadmin-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function WhatsAppTemplates() {
  const { selectedInstitution } = useSuperAdminScope();
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);

  const templates = useQuery({
    queryKey: ["superadmin-whatsapp-templates", selectedInstitution],
    queryFn: async () => {
      if (!selectedInstitution) return [];
      const { data, error } = await supabase
        .from("message_templates")
        .select("id,name,meta_template_name,meta_language,meta_status,meta_category,meta_footer_text,meta_has_local_differences,meta_last_synced_at")
        .eq("template_kind", "meta")
        .eq("institution", selectedInstitution)
        .order("meta_last_synced_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!selectedInstitution,
  });

  const sync = async () => {
    if (!selectedInstitution) return;
    setSyncing(true);
    const { data, error } = await supabase.functions.invoke("sync-whatsapp-templates", {
      body: { institution: selectedInstitution },
    });
    setSyncing(false);
    if (error || !(data as { ok?: boolean } | null)?.ok) {
      toast.error(error?.message ?? (data as { error?: string } | null)?.error ?? "Falha ao sincronizar templates.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["superadmin-whatsapp-templates", selectedInstitution] });
    toast.success(`Sincronização concluída: ${(data as { updated?: number }).updated ?? 0} template(s) atualizado(s).`);
  };

  if (!selectedInstitution) {
    return <Card className="mx-auto max-w-2xl p-8 text-center"><Building2 className="mx-auto h-9 w-9 text-muted-foreground" /><h1 className="mt-4 text-xl font-semibold text-ink">Selecione uma instituição</h1><p className="mt-2 text-sm text-muted-foreground">A sincronização deve ser executada em um escopo institucional específico.</p></Card>;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-care">WhatsApp · {selectedInstitution}</p><h1 className="mt-1 font-display text-3xl font-bold text-ink">Templates e sincronização</h1><p className="mt-2 text-sm text-muted-foreground">Status oficial, categoria, idioma e divergências entre o modelo local e a Meta.</p></div>
        <Button onClick={sync} disabled={syncing}><RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />{syncing ? "Sincronizando…" : "Sincronizar agora"}</Button>
      </header>

      <Card className="overflow-hidden">
        {templates.isLoading ? <p className="p-6 text-sm text-muted-foreground">Carregando templates…</p> : templates.error ? <p className="p-6 text-sm text-destructive">Não foi possível carregar os templates.</p> : !templates.data?.length ? <p className="p-6 text-sm text-muted-foreground">Nenhum Template Meta encontrado para esta instituição.</p> : (
          <div className="divide-y divide-border">
            {templates.data.map((template) => (
              <div key={template.id} className="flex flex-wrap items-center gap-4 p-4">
                <div className="min-w-[240px] flex-1">
                  <p className="font-semibold text-ink">{template.meta_template_name || template.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{template.meta_language || "—"} · {template.meta_category || "—"}{template.meta_footer_text ? ` · rodapé: ${template.meta_footer_text}` : ""}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Última sincronização: {template.meta_last_synced_at ? new Date(template.meta_last_synced_at).toLocaleString("pt-BR") : "nunca"}</p>
                </div>
                <Badge variant={template.meta_status === "approved" ? "default" : "secondary"}>{template.meta_status || "sem status"}</Badge>
                {template.meta_has_local_differences && <Badge variant="outline" className="border-amber-300 text-amber-700">Divergente</Badge>}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
