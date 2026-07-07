import { Clock, MessageCircle, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { getWindowStatus } from "@/lib/whatsapp";
import { formatDistanceToNowStrict } from "@/features/people/format";
import type { InboxConversation } from "./useInbox";

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

export function ConversationList({
  conversations,
  activeId,
  onSelect,
}: {
  conversations: InboxConversation[];
  activeId: string | null;
  onSelect: (identityId: string) => void;
}) {
  return (
    <ul className="space-y-1" aria-label="Lista de conversas">
      {conversations.map((conversation) => {
        const windowStatus = getWindowStatus(conversation.service_window_expires_at);
        const pending = conversation.last_direction === "inbound" && conversation.unread > 0;
        const active = activeId === conversation.identity_id;

        return (
          <li key={conversation.identity_id}>
            <button
              type="button"
              onClick={() => onSelect(conversation.identity_id)}
              aria-current={active ? "true" : undefined}
              className={cn(
                "group relative flex w-full items-start gap-3 rounded-2xl border px-3 py-3.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "border-care/25 bg-mint-soft/70 shadow-sm"
                  : "border-transparent bg-transparent hover:border-border hover:bg-secondary/55",
              )}
            >
              <span
                className={cn(
                  "absolute inset-y-3 left-0 w-1 rounded-r-full bg-transparent transition-colors",
                  active && "bg-care",
                )}
                aria-hidden
              />

              <Avatar className="h-11 w-11 shrink-0">
                <AvatarFallback className={cn(
                  "bg-secondary text-muted-foreground transition-colors",
                  active && "bg-card text-care",
                )}>
                  {conversation.is_known ? initials(conversation.display_name) : <User className="h-4 w-4" aria-hidden />}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-display font-semibold text-ink">
                      {conversation.display_name}
                    </p>
                    {!conversation.is_known && (
                      <span className="mt-1 inline-flex rounded-full border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Desconhecido
                      </span>
                    )}
                  </div>
                  <time className="shrink-0 text-[11px] text-muted-foreground">
                    {conversation.last_message_at ? `há ${formatDistanceToNowStrict(conversation.last_message_at)}` : "—"}
                  </time>
                </div>

                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {conversation.last_direction === "outbound" ? "Você: " : ""}
                  {conversation.last_body || "—"}
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[11px] text-muted-foreground">
                    <MessageCircle className="h-3 w-3" aria-hidden /> WhatsApp
                  </span>

                  {windowStatus.state === "open" && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-care/30 bg-mint-soft px-2 py-0.5 text-[11px] text-care">
                      <Clock className="h-3 w-3" aria-hidden /> Janela ativa
                    </span>
                  )}

                  {windowStatus.state === "closed" && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                      Janela encerrada
                    </span>
                  )}

                  {pending && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-coral-soft px-2 py-0.5 text-[11px] font-medium text-coral-strong">
                      Aguardando resposta · {conversation.unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
