import { Link } from "react-router-dom";
import { ArrowRight, Clock, MessageCircle, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { getWindowStatus } from "@/lib/whatsapp";
import { formatDistanceToNowStrict } from "@/features/people/format";
import type { InboxConversation } from "./useInbox";

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

export function ConversationList({ conversations }: { conversations: InboxConversation[] }) {
  return (
    <ul className="care-card divide-y divide-border/70 p-0" aria-label="Lista de conversas">
      {conversations.map((c) => {
        const ws = getWindowStatus(c.service_window_expires_at);
        const target = c.patient_id ? `/app/pessoas/${c.patient_id}` : "#";
        const pending = c.last_direction === "inbound" && c.unread > 0;
        return (
          <li key={c.identity_id}>
            <Link
              to={target}
              className={cn(
                "flex items-start gap-3 px-4 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                target === "#" ? "cursor-default" : "hover:bg-secondary/40",
              )}
              onClick={(e) => {
                if (target === "#") e.preventDefault();
              }}
            >
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarFallback className="bg-secondary text-muted-foreground">
                  {c.is_known ? initials(c.display_name) : <User className="h-4 w-4" aria-hidden />}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="truncate font-display font-semibold text-ink">
                    {c.display_name}
                    {!c.is_known && (
                      <span className="ml-2 rounded-full border border-border bg-secondary px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
                        Desconhecido
                      </span>
                    )}
                  </p>
                  <time className="shrink-0 text-xs text-muted-foreground">
                    {c.last_message_at ? `há ${formatDistanceToNowStrict(c.last_message_at)}` : "—"}
                  </time>
                </div>
                <p className="mt-0.5 truncate text-sm text-muted-foreground">
                  {c.last_direction === "outbound" ? "Você: " : ""}
                  {c.last_body || "—"}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
                    <MessageCircle className="h-3 w-3" aria-hidden /> WhatsApp
                  </span>
                  {ws.state === "open" && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-care/30 bg-mint-soft px-2 py-0.5 text-[11px] text-care">
                      <Clock className="h-3 w-3" aria-hidden /> Janela ativa
                    </span>
                  )}
                  {ws.state === "closed" && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                      Janela encerrada
                    </span>
                  )}
                  {pending && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-coral-soft px-2 py-0.5 text-[11px] font-medium text-coral-strong">
                      Aguardando resposta · {c.unread}
                    </span>
                  )}
                  {c.phone && (
                    <span className="text-[11px] text-muted-foreground">{c.phone}</span>
                  )}
                </div>
              </div>
              {target !== "#" && (
                <ArrowRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}