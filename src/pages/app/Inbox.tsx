import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Inbox as InboxIcon, Info, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EmptyState, ErrorState, SkeletonState } from "@/components/care/EmptyState";
import { InboxFilters } from "@/features/inbox/InboxFilters";
import { ConversationList } from "@/features/inbox/ConversationList";
import { ConversationThread } from "@/features/inbox/ConversationThread";
import { ConversationContext } from "@/features/inbox/ConversationContext";
import { InboxComposer } from "@/features/inbox/InboxComposer";
import { useInboxConversations, useInstitution, type InboxConversation } from "@/features/inbox/useInbox";
import { useInboxThread } from "@/features/inbox/useInboxThread";
import { formatWindowLabel, getWindowStatus } from "@/lib/whatsapp";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
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
  const { user } = useAuth();
  const { data: institution = "" } = useInstitution();
  const { data: conversations, isLoading, error, refetch } = useInboxConversations(institution);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<InboxStatusFilter>("todas");
  const [channel, setChannel] = useState<InboxChannelFilter>("todos");
  const [patientId, setPatientId] = useState<string>("__all__");
  const [activeIdentity, setActiveIdentity] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "thread">("list");
  const [contextOpen, setContextOpen] = useState(false);

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

  const activeConv = useMemo(
    () => list.find((c) => c.identity_id === activeIdentity) ?? null,
    [list, activeIdentity],
  );
  const { data: thread, isLoading: threadLoading } = useInboxThread(activeIdentity, institution);

  // Auto-select first conversation on desktop when nothing is selected
  useEffect(() => {
    if (!activeIdentity && filtered.length > 0 && typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches) {
      setActiveIdentity(filtered[0].identity_id);
    }
  }, [filtered, activeIdentity]);

  const handleSelect = (id: string) => {
    setActiveIdentity(id);
    setMobileView("thread");
  };

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
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)_minmax(280px,340px)] lg:h-[calc(100vh-260px)]">
          {/* Column 1 — list */}
          <section
            aria-label="Lista de conversas"
            className={cn(
              "care-card flex min-h-[420px] flex-col overflow-hidden p-0 lg:min-h-0",
              mobileView !== "list" && "hidden lg:flex",
            )}
          >
            {filtered.length === 0 ? (
              <div className="p-4">
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
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                <ConversationList conversations={filtered} activeId={activeIdentity} onSelect={handleSelect} />
              </div>
            )}
          </section>

          {/* Column 2 — thread + composer */}
          <section
            aria-label="Conversa"
            className={cn(
              "care-card flex min-h-[420px] flex-col overflow-hidden p-0 lg:min-h-0",
              mobileView !== "thread" && "hidden lg:flex",
            )}
          >
            {!activeConv ? (
              <div className="flex flex-1 items-center justify-center p-6">
                <EmptyState
                  icon={MessageSquare}
                  title="Selecione uma conversa"
                  description="Escolha uma pessoa na lista para ver o histórico e responder."
                />
              </div>
            ) : (
              <>
                <ConversationHeader
                  conversation={activeConv}
                  onBack={() => setMobileView("list")}
                  onOpenContext={() => setContextOpen(true)}
                />
                <ConversationThread messages={thread} isLoading={threadLoading} />
                <InboxComposer conversation={activeConv} userId={user?.id ?? null} />
              </>
            )}
          </section>

          {/* Column 3 — context (desktop only) */}
          <section
            aria-label="Contexto da conversa"
            className="care-card hidden overflow-hidden p-0 lg:flex lg:flex-col"
          >
            {activeConv ? (
              <ConversationContext conversation={activeConv} onInvite={() => {}} />
            ) : (
              <div className="p-6">
                <EmptyState icon={Info} title="Contexto aparece aqui" description="Ao selecionar uma conversa, mostramos dados do paciente, órbita de cuidado e notas internas." />
              </div>
            )}
          </section>
        </div>
      )}

      {/* Mobile context sheet */}
      <Sheet open={contextOpen} onOpenChange={setContextOpen}>
        <SheetContent side="right" className="w-full p-0 sm:max-w-md">
          <SheetHeader className="border-b border-border px-4 py-3">
            <SheetTitle>Contexto da conversa</SheetTitle>
          </SheetHeader>
          {activeConv && <ConversationContext conversation={activeConv} onInvite={() => setContextOpen(false)} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ConversationHeader({
  conversation,
  onBack,
  onOpenContext,
}: {
  conversation: InboxConversation;
  onBack: () => void;
  onOpenContext: () => void;
}) {
  const status = getWindowStatus(conversation.service_window_expires_at);
  const open = status.state === "open";
  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-3">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onBack} aria-label="Voltar para a lista">
        <ArrowLeft className="h-4 w-4" aria-hidden />
      </Button>
      <div className="min-w-0 flex-1">
        <p className="truncate font-display font-semibold text-ink">{conversation.display_name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {conversation.phone || "—"} · {formatWindowLabel(status)}
        </p>
      </div>
      <span
        className={cn(
          "hidden rounded-full border px-2 py-0.5 text-xs sm:inline-flex",
          open ? "border-care/30 bg-mint-soft text-care" : "border-border bg-secondary text-muted-foreground",
        )}
      >
        {open ? "Janela ativa" : "Janela encerrada"}
      </span>
      <Button variant="outline" size="sm" className="lg:hidden" onClick={onOpenContext}>
        <Info className="h-4 w-4" /> Contexto
      </Button>
    </div>
  );
}