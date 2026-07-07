import { useEffect, useRef } from "react";
import { AlertCircle, CheckCheck, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import { SkeletonState, EmptyState } from "@/components/care/EmptyState";
import type { ThreadMessage } from "./useInboxThread";

const URL_RE = /(https?:\/\/[^\s]+)/g;

function renderWithLinks(text: string) {
  if (!text) return null;
  return text.split(URL_RE).map((part, index) => {
    if (index % 2 === 1) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all font-medium underline"
        >
          {part}
        </a>
      );
    }
    return <span key={index}>{part}</span>;
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
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-secondary/30 p-5 sm:p-6">
        <SkeletonState className="h-16 w-2/3" />
        <SkeletonState className="ml-auto h-16 w-1/2" />
        <SkeletonState className="h-16 w-3/5" />
      </div>
    );
  }

  if (!messages || messages.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center bg-secondary/30 p-8">
        <EmptyState
          title="Sem mensagens ainda"
          description="Escreva a primeira resposta a esta pessoa."
        />
      </div>
    );
  }

  return (
    <div
      ref={scroller}
      tabIndex={0}
      role="log"
      aria-label="Histórico da conversa"
      className="min-h-0 flex-1 overflow-y-auto bg-secondary/30 p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-6"
    >
      <ol className="flex flex-col gap-3">
        {messages.map((message) => {
          const inbound = message.direction === "inbound";
          return (
            <li
              key={message.id}
              className={cn(
                "max-w-[86%] break-words rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm sm:max-w-[72%]",
                inbound
                  ? "self-start rounded-bl-sm border border-border bg-card text-foreground"
                  : "self-end rounded-br-sm bg-primary text-primary-foreground",
              )}
            >
              {message.template_name && (
                <p className="mb-1 text-[10px] uppercase tracking-wide opacity-70">
                  Modelo Meta · {message.template_name}
                </p>
              )}
              {message.media_asset_id && (
                <div className="mb-2 flex items-center gap-1.5 border-b border-current/20 pb-2 text-xs opacity-90">
                  <Paperclip className="h-3 w-3" aria-hidden />
                  <span className="truncate">{message.media_filename || "Anexo"}</span>
                </div>
              )}
              {message.body && <p className="whitespace-pre-wrap">{renderWithLinks(message.body)}</p>}
              {message.last_error && (
                <p className="mt-2 rounded bg-destructive px-1.5 py-0.5 text-[11px] font-medium text-destructive-foreground">
                  {message.last_error}
                </p>
              )}
              <div className={cn(
                "mt-1.5 flex items-center justify-end gap-1 text-[10px]",
                inbound ? "text-muted-foreground" : "text-primary-foreground/70",
              )}>
                <time dateTime={message.sent_at ?? ""}>
                  {message.sent_at
                    ? new Date(message.sent_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                    : "—"}
                </time>
                {!inbound && statusIcon(message.status)}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
