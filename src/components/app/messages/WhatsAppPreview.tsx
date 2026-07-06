import { CornerUpLeft, Copy, ExternalLink, Phone } from "lucide-react";
import { renderWithExamples } from "@/lib/metaVariables";

export type WhatsAppPreviewMessageType =
  | "text"
  | "interactive"
  | "template"
  | "authentication";

export type WhatsAppPreviewButton =
  | { type: "quick_reply"; text: string }
  | { type: "url"; text: string; url?: string }
  | { type: "phone_number"; text: string }
  | { type: "copy_code"; text: string };

/**
 * Visual WhatsApp-style chat preview with a single outbound bubble.
 * Variants:
 *  - "full": full phone frame with header + background tint, for editor/preview steps.
 *  - "compact": just the bubble, fits inside a template card.
 */
export function WhatsAppPreview({
  body,
  recipientName,
  variant = "full",
  highlightVars = true,
  header,
  footer,
  buttons,
  messageType = "text",
  templateStatus,
  resolveExamples = false,
  variableValues,
}: {
  body: string;
  recipientName?: string;
  variant?: "full" | "compact";
  highlightVars?: boolean;
  /** Optional header line (template HEADER component or interactive header). */
  header?: string;
  /** Footer rendered below the body in smaller, muted text. */
  footer?: string | null;
  /** Buttons appended below the bubble (interactive / template buttons). */
  buttons?: WhatsAppPreviewButton[];
  /** Drives subtle visual cues so the preview matches send-time behaviour. */
  messageType?: WhatsAppPreviewMessageType;
  /** When set, shows a small status chip (Aprovado/Em análise/etc.). */
  templateStatus?: string;
  /** When true, `{var}` placeholders are replaced by catalog examples. */
  resolveExamples?: boolean;
  variableValues?: Record<string, string>;
}) {
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const renderText = (text: string) => {
    const resolved = resolveExamples ? renderWithExamples(text, variableValues ?? {}) : text;
    if (!highlightVars || resolveExamples) return resolved;
    const parts = resolved.split(/(\{[a-zA-Z0-9_]+\})/g);
    return parts.map((p, i) =>
      /^\{[a-zA-Z0-9_]+\}$/.test(p) ? (
        <span
          key={i}
          className="rounded bg-emerald-200/70 px-1 text-emerald-900 dark:bg-emerald-500/30 dark:text-emerald-100"
        >
          {p}
        </span>
      ) : (
        <span key={i}>{p}</span>
      ),
    );
  };

  const buttonIcon = (b: WhatsAppPreviewButton) => {
    switch (b.type) {
      case "url":
        return <ExternalLink className="h-3.5 w-3.5" />;
      case "phone_number":
        return <Phone className="h-3.5 w-3.5" />;
      case "copy_code":
        return <Copy className="h-3.5 w-3.5" />;
      case "quick_reply":
      default:
        return <CornerUpLeft className="h-3.5 w-3.5" />;
    }
  };

  const chatBg: React.CSSProperties = {
    backgroundColor: "#e6dfd4",
    backgroundImage:
      "radial-gradient(circle at 1px 1px, rgba(0,0,0,0.05) 1px, transparent 0)",
    backgroundSize: "14px 14px",
  };

  if (variant === "compact") {
    return (
      <div className="rounded-lg p-2 dark:bg-zinc-800" style={chatBg}>
        <div className="ml-auto max-w-[92%] space-y-1">
          <div className="relative rounded-lg rounded-tl-sm bg-white dark:bg-zinc-900 px-2.5 py-2 shadow-sm">
            {header && (
              <p className="mb-1 text-[12px] font-bold text-zinc-900 dark:text-zinc-50 break-words">
                {header}
              </p>
            )}
            <p className="text-[11px] leading-snug text-zinc-800 dark:text-zinc-100 whitespace-pre-wrap break-words">
              {renderText(body || "Sua mensagem aparece aqui…")}
            </p>
            {footer && (
              <p className="mt-1 text-[10px] text-zinc-400 dark:text-zinc-500 italic break-words">
                {footer}
              </p>
            )}
            <div className="mt-0.5 flex items-center justify-end gap-0.5 text-[9px] text-zinc-400 dark:text-zinc-500">
              <span>{time}</span>
            </div>
          </div>
          {buttons && buttons.length > 0 && (
            <div className="space-y-1">
              {buttons.slice(0, 3).map((b, i) => (
                <div
                  key={i}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-white px-2 py-1.5 text-[11px] font-medium text-emerald-600 shadow-sm dark:bg-zinc-900 dark:text-emerald-300"
                >
                  {buttonIcon(b)}
                  <span className="truncate">{b.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-center gap-3 bg-emerald-700 dark:bg-emerald-800 px-4 py-2.5 text-white">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-sm font-semibold">
          {(recipientName ?? "P").trim().charAt(0).toUpperCase() || "P"}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight truncate">
            {recipientName || "Destinatário"}
          </p>
          <p className="text-[10px] text-white/90">online</p>
        </div>
      </div>
      <div className="min-h-[180px] p-4" style={chatBg}>
        <div className="ml-auto max-w-[85%] space-y-1.5">
          <div className="relative rounded-xl rounded-tl-sm bg-white dark:bg-zinc-900 px-3 py-2.5 shadow">
            {header && (
              <p className="mb-1.5 text-sm font-bold text-zinc-900 dark:text-zinc-50 break-words">
                {header}
              </p>
            )}
            <p className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-100 whitespace-pre-wrap break-words">
              {renderText(body || "Comece a escrever a mensagem…")}
            </p>
            {footer && (
              <p className="mt-1.5 text-[11px] text-zinc-400 dark:text-zinc-500 italic break-words">
                {footer}
              </p>
            )}
            <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-zinc-400 dark:text-zinc-500">
              {templateStatus && (
                <span className="mr-auto rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-medium uppercase text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                  {messageType === "template" ? `Template · ${templateStatus}` : templateStatus}
                </span>
              )}
              <span>{time}</span>
            </div>
          </div>
          {buttons && buttons.length > 0 && (
            <div className="space-y-1">
              {buttons.slice(0, 3).map((b, i) => (
                <button
                  key={i}
                  type="button"
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-medium text-emerald-600 shadow-sm dark:bg-zinc-900 dark:text-emerald-300"
                >
                  {buttonIcon(b)}
                  <span className="truncate">{b.text}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}