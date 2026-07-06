import { Activity, MessageCircle, Pill, AlertTriangle, CheckCircle2, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { EmptyState, SkeletonState } from "@/components/care/EmptyState";
import { useCareTimeline } from "./usePeople";
import { formatDateTime } from "./format";

const toneStyles: Record<string, string> = {
  neutral: "bg-secondary text-muted-foreground",
  positive: "bg-mint-soft text-care",
  warning: "bg-coral-soft text-coral-strong",
  danger: "bg-destructive/10 text-destructive",
};

export function CareTimeline({ patientId }: { patientId: string }) {
  const { data, isLoading } = useCareTimeline(patientId);

  if (isLoading) return <SkeletonState className="h-64 w-full" />;
  const items = data ?? [];

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title="Ainda sem eventos registrados"
        description="Mensagens, medicações e adesão aparecerão aqui em ordem cronológica."
      />
    );
  }

  return (
    <ol className="care-card divide-y divide-border/70 p-0">
      {items.map((it) => {
        const Icon =
          it.kind === "message"
            ? it.title.startsWith("Mensagem recebida")
              ? ArrowDownLeft
              : ArrowUpRight
            : it.kind === "medication"
            ? Pill
            : it.tone === "positive"
            ? CheckCircle2
            : AlertTriangle;
        return (
          <li key={it.id} className="flex items-start gap-3 px-5 py-4">
            <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${toneStyles[it.tone ?? "neutral"]}`}>
              <Icon className="h-4 w-4" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium text-ink">{it.title}</p>
                <time className="text-xs text-muted-foreground" dateTime={it.at}>
                  {formatDateTime(it.at)}
                </time>
              </div>
              {it.detail && <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">{it.detail}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function MessageCircleIcon() { return <MessageCircle /> } // keep import used elsewhere if tree-shaken