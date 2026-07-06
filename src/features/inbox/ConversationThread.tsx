import { useEffect, useRef } from "react";
import { AlertCircle, CheckCheck, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import { SkeletonState, EmptyState } from "@/components/care/EmptyState";
import type { ThreadMessage } from "./useInboxThread";

const URL_RE = /(https?:\/\/[^\s]+)/g;

function renderWithLinks(text: string) {
  if (!text) return null;
  return text.split(URL_RE).map((part, i) => {
    if (i % 2 === 1) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all font-medium underline"
        >
          {part}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function statusIcon(status: string | null) {
  if (!status) return null;
  if (status === "read") return <CheckCheck className="h-3 w-3" aria-label="Lida" />;
  if (status === "delivered") return <CheckCheck className="h-3 w-3 opacity-60" aria-label="Entregue" />;
  if (status === "failed") return <AlertCircle className="h-3 w-3 text-destructive" aria-label="Falha" />;
  return null;
}

export function ConversationThread({
  messages,
  isLoading,
}: {
  messages: ThreadMessage[] | undefined;
  isLoading: boolean;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages?.length]);

  if (isLoading) {
    return (
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        <SkeletonState className="h-14 w-2/3" />
        <SkeletonState className="ml-auto h-14 w-1/2" />
        <SkeletonState className="h-14 w-3/5" />
      </div>
    );
  }

  if (!messages || messages.length === 0) {
    return (
      <div className="flex-1 p-6">
        <EmptyState
          title="Sem mensagens ainda"
          description="Escreva a primeira resposta a esta pessoa."
        />
      </div>
    );
  }

  return (
    <div ref={scroller} className="flex-1 overflow-y-auto bg-background/40 p-4">
      <ol className="flex flex-col gap-2">
        {messages.map((m) => {
          const inbound = m.direction === "inbound";
          return (
            <li
              key={m.id}
              className={cn(
                "max-w-[80%] break-words rounded-2xl px-3 py-2 text-sm shadow-sm",
                inbound
                  ? "self-start rounded-bl-sm bg-card text-foreground border border-border"
                  : "self-end rounded-br-sm bg-primary text-primary-foreground",
              )}
            >
              {m.template_name && (
                <p className="mb-1 text-[10px] uppercase tracking-wide opacity-70">
                  Modelo Meta · {m.template_name}
                </p>
              )}
              {m.media_asset_id && (
                <div className="mb-1 flex items-center gap-1.5 border-b border-current/20 pb-1 text-xs opacity-90">
                  <Paperclip className="h-3 w-3" aria-hidden />
                  <span className="truncate">{m.media_filename || "Anexo"}</span>
                </div>
              )}
              {m.body && <p className="whitespace-pre-wrap">{renderWithLinks(m.body)}</p>}
              {m.last_error && (
                <p className="mt-1 text-[11px] text-destructive-foreground/90 rounded bg-destructive/40 px-1.5 py-0.5">
                  {m.last_error}
                </p>
              )}
              <div className={cn("mt-1 flex items-center gap-1 text-[10px]", inbound ? "text-muted-foreground" : "text-primary-foreground/70")}>
                <time dateTime={m.sent_at ?? ""}>
                  {m.sent_at ? new Date(m.sent_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"}
                </time>
                {!inbound && statusIcon(m.status)}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}