import {
  AlertTriangle, MessageCircleOff, CalendarClock, UserX,
  GitBranch, FileX, Clock, Inbox as InboxIcon,
} from "lucide-react";
import { CareActionCard } from "./CareActionCard";
import { EmptyState } from "@/components/care/EmptyState";
import { useTodayStats } from "./useTodayStats";

export function AttentionQueue() {
  const { data, isLoading, isError } = useTodayStats();
  const a = data?.attention;

  const items = [
    { key: "replies", icon: MessageCircleOff, title: "Respostas aguardando equipe", count: a?.pendingReplies ?? 0, description: "Conversas com paciente ou familiar sem resposta há mais de 1h.", priority: "high" as const, to: "/app/caixa", cta: "Abrir caixa" },
    { key: "unconfirmed", icon: CalendarClock, title: "Consultas sem confirmação", count: a?.unconfirmedAppointments ?? 0, description: "Consultas nas próximas 48h ainda não confirmadas.", priority: "high" as const, to: "/app/pessoas", cta: "Revisar pessoas" },
    { key: "failed", icon: AlertTriangle, title: "Falhas de envio", count: a?.failedSends ?? 0, description: "Mensagens que não chegaram nas últimas 24h.", priority: "high" as const, to: "/app/caixa", cta: "Ver falhas" },
    { key: "stale", icon: Clock, title: "Pessoas sem contato recente", count: a?.staleContacts ?? 0, description: "Sem interação registrada nos últimos 14 dias.", priority: "medium" as const, to: "/app/pessoas", cta: "Filtrar pessoas" },
    { key: "journeys", icon: GitBranch, title: "Jornadas interrompidas", count: a?.interruptedJourneys ?? 0, description: "Fluxos automáticos que pararam antes de concluir.", priority: "medium" as const, to: "/app/jornadas", cta: "Ver jornadas" },
    { key: "rejected", icon: FileX, title: "Templates rejeitados", count: a?.rejectedTemplates ?? 0, description: "Modelos Meta com rejeição pendente de correção.", priority: "medium" as const, to: "/app/admin/modelos-meta", cta: "Ver modelos" },
    { key: "incomplete", icon: UserX, title: "Cadastros incompletos", count: a?.incompletePatients ?? 0, description: "Pessoas sem nome ou canal válido.", priority: "low" as const, to: "/app/pessoas", cta: "Completar cadastros" },
  ];

  if (isError) {
    return <EmptyState icon={AlertTriangle} title="Não foi possível carregar sua fila" description="Recarregue a página em alguns instantes." />;
  }

  const total = items.reduce((s, i) => s + i.count, 0);
  if (!isLoading && total === 0) {
    return (
      <EmptyState
        icon={InboxIcon}
        tone="positive"
        title="Nada aguardando você agora"
        description="Sua fila de cuidado está em dia. Aproveite para revisar jornadas ou preparar comunicações."
      />
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {items.map((it) => (
        <CareActionCard
          key={it.key}
          icon={it.icon}
          title={it.title}
          count={it.count}
          description={it.description}
          priority={it.priority}
          to={it.to}
          ctaLabel={it.cta}
          isLoading={isLoading}
        />
      ))}
    </div>
  );
}