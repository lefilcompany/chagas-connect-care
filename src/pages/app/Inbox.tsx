import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Inbox as InboxIcon,
  Info,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  const [listCollapsed, setListCollapsed] = useState(false);

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

  useEffect(() => {
    if (!activeIdentity && filtered.length > 0 && typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches) {
      setActiveIdentity(filtered[0].identity_id);
    }
  }, [filtered, activeIdentity]);

  useEffect(() => {
    setContextOpen(false);
  }, [activeIdentity]);

  const handleSelect = (id: string) => {
    setActiveIdentity(id);
    setMobileView("thread");
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">Caixa de cuidado</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            Conversas de WhatsApp com pacientes, familiares e cuidadores, organizadas para a equipe saber quem precisa de atenção.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="hidden lg:inline-flex"
            onClick={() => setListCollapsed((current) => !current)}
            aria-pressed={listCollapsed}
          >
            {listCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {listCollapsed ? "Mostrar conversas" : "Focar na conversa"}
          </Button>

          {activeConv && (
            <Button type="button" variant="outline" size="sm" onClick={() => setContextOpen(true)}>
              <Info className="h-4 w-4" />
              Ver contexto
            </Button>
          )}
        </div>
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
        <div
          className={cn(
            "grid min-h-[620px] overflow-hidden rounded-3xl border border-border bg-card shadow-card lg:h-[calc(100dvh-300px)] lg:max-h-[820px]",
            listCollapsed
              ? "lg:grid-cols-1"
              : "lg:grid-cols-[minmax(300px,360px)_minmax(0,1fr)]",
          )}
        >
          <section
            aria-label="Lista de conversas"
            className={cn(
              "min-h-0 flex-col overflow-hidden bg-card lg:border-r lg:border-border",
              mobileView === "list" ? "flex" : "hidden lg:flex",
              listCollapsed && "lg:hidden",
            )}
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3.5">
              <div>
                <h2 className="font-display text-sm font-semibold text-ink">Conversas</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {filtered.length} {filtered.length === 1 ? "resultado" : "resultados"}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="hidden lg:inline-flex"
                onClick={() => setListCollapsed(true)}
                aria-label="Recolher lista de conversas"
              >
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            </div>

            {filtered.length === 0 ? (
              <div className="p-5">
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
              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                <ConversationList conversations={filtered} activeId={activeIdentity} onSelect={handleSelect} />
              </div>
            )}
          </section>

          <section
            aria-label="Conversa"
            className={cn(
              "min-h-0 flex-col overflow-hidden bg-background",
              mobileView === "thread" ? "flex" : "hidden lg:flex",
            )}
          >
            {!activeConv ? (
              <div className="flex flex-1 items-center justify-center p-8">
                <EmptyState
                  icon={MessageSquare}
                  title="Selecione uma conversa"
                  description="Escolha uma pessoa na lista para ver o histórico e responder."
                  action={listCollapsed ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => setListCollapsed(false)}>
                      <PanelLeftOpen className="h-4 w-4" /> Mostrar conversas
                    </Button>
                  ) : undefined}
                />
              </div>
            ) : (
              <>
                <ConversationHeader
                  conversation={activeConv}
                  listCollapsed={listCollapsed}
                  onBack={() => setMobileView("list")}
                  onShowList={() => setListCollapsed(false)}
                  onOpenContext={() => setContextOpen(true)}
                />
                <ConversationThread messages={thread} isLoading={threadLoading} />
                <InboxComposer conversation={activeConv} userId={user?.id ?? null} />
              </>
            )}
          </section>
        </div>
      )}

      <Sheet open={contextOpen} onOpenChange={setContextOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
          <SheetHeader className="shrink-0 border-b border-border px-5 py-4 pr-14 text-left">
            <SheetTitle className="font-display text-lg text-ink">
              Contexto da conversa
            </SheetTitle>
            <SheetDescription>
              Dados da pessoa, rede de cuidado e notas internas da equipe.
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-hidden">
            {activeConv && (
              <ConversationContext
                conversation={activeConv}
                onInvite={() => setContextOpen(false)}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ConversationHeader({
  conversation,
  listCollapsed,
  onBack,
  onShowList,
  onOpenContext,
}: {
  conversation: InboxConversation;
  listCollapsed: boolean;
  onBack: () => void;
  onShowList: () => void;
  onOpenContext: () => void;
}) {
  const status = getWindowStatus(conversation.service_window_expires_at);
  const open = status.state === "open";

  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-4 py-3.5">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onBack} aria-label="Voltar para a lista">
        <ArrowLeft className="h-4 w-4" aria-hidden />
      </Button>

      {listCollapsed && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="hidden lg:inline-flex"
          onClick={onShowList}
          aria-label="Mostrar lista de conversas"
        >
          <PanelLeftOpen className="h-4 w-4" aria-hidden />
        </Button>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate font-display font-semibold text-ink">{conversation.display_name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {conversation.phone || "—"} · {formatWindowLabel(status)}
        </p>
      </div>

      <span
        className={cn(
          "hidden rounded-full border px-2.5 py-1 text-xs sm:inline-flex",
          open ? "border-care/30 bg-mint-soft text-care" : "border-border bg-secondary text-muted-foreground",
        )}
      >
        {open ? "Janela ativa" : "Janela encerrada"}
      </span>

      <Button type="button" variant="outline" size="sm" onClick={onOpenContext}>
        <Info className="h-4 w-4" />
        <span className="hidden sm:inline">Contexto</span>
      </Button>
    </div>
  );
}
