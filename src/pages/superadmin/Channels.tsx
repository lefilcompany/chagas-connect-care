import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Activity, AlertTriangle, CheckCircle2, Radio, Settings2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSuperAdminScope } from "@/lib/superadmin-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function maskPhone(value: string | null): string {
  if (!value) return "—";
  if (value.length < 5) return value;
  return value.slice(0, -4).replace(/\d/g, "*") + value.slice(-4);
}

export default function Channels() {
  const navigate = useNavigate();
  const { selectedInstitution, setSelectedInstitution } = useSuperAdminScope();

  const { data = [], isLoading, error } = useQuery({
    queryKey: ["superadmin-channels", selectedInstitution],
    queryFn: async () => {
      const request = supabase
        .from("whatsapp_channels")
        .select("id,institution,display_name,display_phone_number,mode,status,quality_rating,last_synced_at,last_webhook_at,phone_number_id,notes")
        .order("institution", { ascending: true });
      const { data, error } = selectedInstitution ? await request.eq("institution", selectedInstitution) : await request;
      if (error) throw error;
      return data ?? [];
    },
  });

  const openTechnicalPage = (institution: string, path: string) => {
    setSelectedInstitution(institution);
    navigate(path);
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-care">Infraestrutura</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-ink">Canais</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Status técnico dos canais {selectedInstitution ? `de ${selectedInstitution}` : "de todas as instituições"}. Números e identificadores permanecem mascarados.
        </p>
      </header>

      {error ? (
        <Card className="border-destructive/30 p-5 text-sm text-destructive">Não foi possível carregar os canais.</Card>
      ) : isLoading ? (
        <Card className="p-5 text-sm text-muted-foreground">Carregando canais…</Card>
      ) : data.length === 0 ? (
        <Card className="p-8 text-center">
          <Radio className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-medium text-ink">Nenhum canal configurado</p>
          <p className="mt-1 text-sm text-muted-foreground">Selecione uma instituição e use a área de diagnóstico para verificar a configuração.</p>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {data.map((channel) => {
            const active = ["active", "connected"].includes(channel.status);
            const attention = !active || !channel.phone_number_id;
            return (
              <Card key={channel.id} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className={`rounded-xl p-2.5 ${active ? "bg-mint-soft text-care" : "bg-amber-100 text-amber-700"}`}>
                      {active ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink">{channel.display_name || "WhatsApp Business"}</p>
                      <p className="truncate text-sm text-muted-foreground">{channel.institution}</p>
                    </div>
                  </div>
                  <Badge variant={active ? "default" : "secondary"}>{channel.status}</Badge>
                </div>

                <dl className="mt-5 grid gap-3 rounded-xl bg-muted/30 p-4 text-sm sm:grid-cols-2">
                  <div><dt className="text-xs text-muted-foreground">Número</dt><dd className="mt-1 font-medium text-ink">{maskPhone(channel.display_phone_number)}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Modo</dt><dd className="mt-1 font-medium text-ink">{channel.mode || "—"}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Qualidade</dt><dd className="mt-1 font-medium text-ink">{channel.quality_rating || "Não informada"}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Vínculo</dt><dd className="mt-1 font-medium text-ink">{channel.phone_number_id ? "Configurado" : "Pendente"}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Última sincronização</dt><dd className="mt-1 font-medium text-ink">{channel.last_synced_at ? new Date(channel.last_synced_at).toLocaleString("pt-BR") : "—"}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Último webhook</dt><dd className="mt-1 font-medium text-ink">{channel.last_webhook_at ? new Date(channel.last_webhook_at).toLocaleString("pt-BR") : "—"}</dd></div>
                </dl>

                {attention && <p className="mt-3 text-xs text-amber-700">Este canal precisa de verificação técnica antes de ser considerado operacional.</p>}
                {channel.notes && <p className="mt-3 text-xs text-muted-foreground">{channel.notes}</p>}

                <div className="mt-5 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => openTechnicalPage(channel.institution, "/superadmin/whatsapp/configuracoes")}>
                    <Settings2 className="h-4 w-4" /> Configurar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openTechnicalPage(channel.institution, "/superadmin/whatsapp/diagnostico")}>
                    <Activity className="h-4 w-4" /> Diagnóstico
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
