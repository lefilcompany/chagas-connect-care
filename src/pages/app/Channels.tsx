import { useQuery } from "@tanstack/react-query";
import { MessageCircle, Smartphone, Mail, ShieldCheck, Phone, FileHeart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ChannelCard, type ChannelStatus } from "@/features/channels/ChannelCard";

type WhatsAppHealth = {
  configured: boolean;
  sender?: string;
  lastSync?: string;
  recentFailures: number;
  status: ChannelStatus;
};

function useWhatsAppHealth() {
  return useQuery<WhatsAppHealth>({
    queryKey: ["channels-whatsapp-health"],
    queryFn: async () => {
      const since24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const [settings, health, failures] = await Promise.all([
        supabase.from("institution_whatsapp_settings").select("display_name, phone_number, updated_at").maybeSingle(),
        supabase.from("whatsapp_integration_health").select("last_success_at, last_error").maybeSingle(),
        supabase.from("messages").select("id", { count: "exact", head: true })
          .eq("status", "failed").eq("direction", "out").gte("created_at", since24h),
      ]);
      const configured = !!settings.data?.phone_number;
      const lastSyncISO = health.data?.last_success_at ?? settings.data?.updated_at ?? null;
      const recentFailures = failures.count ?? 0;
      let status: ChannelStatus = "inativo";
      if (configured) status = recentFailures > 5 ? "atencao" : "operacional";
      return {
        configured,
        sender: settings.data?.display_name ?? settings.data?.phone_number ?? undefined,
        lastSync: lastSyncISO ? new Date(lastSyncISO).toLocaleString("pt-BR") : undefined,
        recentFailures,
        status,
      };
    },
    staleTime: 60_000,
  });
}

export default function Channels() {
  const { data: wa } = useWhatsAppHealth();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink md:text-3xl">Canais e integrações</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Centro de saúde dos canais de comunicação. Cada card mostra status, remetente,
          última sincronização e falhas recentes.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChannelCard
          name="WhatsApp Business"
          icon={MessageCircle}
          status={wa?.status ?? "inativo"}
          description="Canal principal para conversas 1:1 e envios com janela de 24h."
          sender={wa?.sender}
          lastSync={wa?.lastSync}
          recentFailures={wa?.recentFailures}
          actions={[
            { label: "Configurar", href: "/app/configuracoes/whatsapp", variant: "default" },
            { label: "Diagnóstico", href: "/app/configuracoes/whatsapp?tab=diagnostics" },
          ]}
        />

        <ChannelCard
          name="SMS"
          icon={Smartphone}
          status="planejado"
          description="Fallback para pessoas sem WhatsApp ou fora do horário do serviço."
          actions={[{ label: "Solicitar habilitação", disabled: true }]}
          disabled
        />

        <ChannelCard
          name="E-mail transacional"
          icon={Mail}
          status="planejado"
          description="Confirmações, materiais educativos e recibos de consulta."
          actions={[{ label: "Solicitar habilitação", disabled: true }]}
          disabled
        />

        <ChannelCard
          name="Página segura"
          icon={ShieldCheck}
          status="planejado"
          description="Link autenticado para conteúdos sensíveis fora do WhatsApp."
          actions={[{ label: "Solicitar habilitação", disabled: true }]}
          disabled
        />

        <ChannelCard
          name="Voz / URA"
          icon={Phone}
          status="planejado"
          description="Ligações programadas com equipe humana ou script guiado."
          actions={[{ label: "Solicitar habilitação", disabled: true }]}
          disabled
        />

        <ChannelCard
          name="Prontuário FHIR"
          icon={FileHeart}
          status="planejado"
          description="Sincronização bidirecional com o prontuário eletrônico da instituição."
          actions={[{ label: "Solicitar habilitação", disabled: true }]}
          disabled
        />
      </div>
    </div>
  );
}