import { useMemo, useState } from "react";
import { Inbox as InboxIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, SkeletonState } from "@/components/care/EmptyState";
import { InboxFilters } from "@/features/inbox/InboxFilters";
import { ConversationList } from "@/features/inbox/ConversationList";
import { useInboxConversations, useInstitution, type InboxConversation } from "@/features/inbox/useInbox";
import { getWindowStatus } from "@/lib/whatsapp";
import type { InboxChannelFilter, InboxStatusFilter } from "@/features/inbox/types";

function matchStatus(c: InboxConversation, s: InboxStatusFilter): boolean {
  const ws = getWindowStatus(c.service_window_expires_at);
  switch (s) {
    case "todas": return true;
    case "nao-lidas": return c.unread > 0;
    case "aguardando-resposta": return c.unread > 0 && c.last_direction === "inbound";
    case "janela-aberta": return ws.state === "open";
    case "janela-fechada": return ws.state !== "open";
    case "desconhecido": return !c.is_known;
  }
}

export default function Inbox() {
  const { data: institution = "" } = useInstitution();
  const { data: conversations, isLoading, error, refetch } = useInboxConversations(institution);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<InboxStatusFilter>("todas");
  const [channel, setChannel] = useState<InboxChannelFilter>("todos");
  const [patientId, setPatientId] = useState<string>("__all__");

  const list = conversations ?? [];

  const patients = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of list) {
      if (c.patient_id) map.set(c.patient_id, c.display_name);
    }
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [list]);

  const counts = useMemo(() => {
    const keys: InboxStatusFilter[] = [
      "todas", "nao-lidas", "aguardando-resposta", "janela-aberta", "janela-fechada", "desconhecido",
    ];
    const acc = {} as Record<InboxStatusFilter, number>;
    for (const k of keys) acc[k] = list.filter((c) => matchStatus(c, k)).length;
    return acc;
  }, [list]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((c) => {
      if (!matchStatus(c, status)) return false;
      if (channel !== "todos" && c.channel !== channel) return false;
      if (patientId !== "__all__" && c.patient_id !== patientId) return false;
      if (!q) return true;
      return (
        c.display_name.toLowerCase().includes(q) ||
        (c.phone ?? "").toLowerCase().includes(q) ||
        (c.last_body ?? "").toLowerCase().includes(q)
      );
    });
  }, [list, query, status, channel, patientId]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold text-ink">Caixa de cuidado</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Conversas ativas de WhatsApp com pacientes, famílias e cuidadores. Filtre por status, canal ou pessoa.
        </p>
      </header>

      <InboxFilters
        query={query}
        onQueryChange={setQuery}
        status={status}
        onStatusChange={setStatus}
        channel={channel}
        onChannelChange={setChannel}
        patientId={patientId}
        onPatientChange={setPatientId}
        patients={patients}
        counts={counts}
      />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonState key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : error ? (
        <ErrorState
          description="Não foi possível carregar as conversas. Verifique sua conexão e tente novamente."
          action={<Button variant="outline" size="sm" onClick={() => refetch()}>Tentar novamente</Button>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={InboxIcon}
          tone={list.length === 0 ? "positive" : "neutral"}
          title={list.length === 0 ? "Nenhuma conversa registrada" : "Nenhuma conversa nesse filtro"}
          description={
            list.length === 0
              ? "Mensagens recebidas ou enviadas por WhatsApp aparecerão aqui em tempo real."
              : "Ajuste os filtros de status, canal ou pessoa para ver mais conversas."
          }
        />
      ) : (
        <ConversationList conversations={filtered} />
      )}
    </div>
  );
}