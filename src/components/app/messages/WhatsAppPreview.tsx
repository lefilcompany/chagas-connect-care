import { Check } from "lucide-react";

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
}: {
  body: string;
  recipientName?: string;
  variant?: "full" | "compact";
  highlightVars?: boolean;
}) {
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const renderText = (text: string) => {
    if (!highlightVars) return text;
    const parts = text.split(/(\{[a-zA-Z0-9_]+\})/g);
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

  if (variant === "compact") {
    return (
      <div className="rounded-lg bg-[#e6dfd4] dark:bg-zinc-800 p-2">
        <div className="relative ml-auto max-w-[90%] rounded-lg rounded-tr-sm bg-[#dcf8c6] dark:bg-emerald-900/60 px-2.5 py-1.5 shadow-sm">
          <p className="text-[11px] leading-snug text-zinc-800 dark:text-zinc-100 whitespace-pre-wrap line-clamp-4">
            {renderText(body || "Sua mensagem aparece aqui…")}
          </p>
          <div className="mt-0.5 flex items-center justify-end gap-0.5 text-[9px] text-zinc-500 dark:text-zinc-400">
            <span>{time}</span>
            <Check className="h-2.5 w-2.5" />
          </div>
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
          <p className="text-[10px] opacity-80">online</p>
        </div>
      </div>
      <div
        className="min-h-[180px] p-4"
        style={{
          backgroundColor: "#e6dfd4",
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(0,0,0,0.04) 1px, transparent 0)",
          backgroundSize: "14px 14px",
        }}
      >
        <div className="relative ml-auto max-w-[85%] rounded-xl rounded-tr-sm bg-[#dcf8c6] dark:bg-emerald-900/70 px-3 py-2 shadow">
          <p className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-100 whitespace-pre-wrap">
            {renderText(body || "Comece a escrever a mensagem…")}
          </p>
          <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-zinc-500 dark:text-zinc-400">
            <span>{time}</span>
            <Check className="h-3 w-3" />
          </div>
        </div>
      </div>
    </div>
  );
}