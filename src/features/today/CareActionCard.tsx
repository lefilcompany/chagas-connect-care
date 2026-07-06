import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type Priority = "high" | "medium" | "low" | "ok";

const priorityLabel: Record<Priority, string> = {
  high: "Alta prioridade",
  medium: "Prioridade média",
  low: "Baixa prioridade",
  ok: "Em dia",
};

const priorityClass: Record<Priority, string> = {
  high: "border-destructive/30 bg-destructive/5",
  medium: "border-warning/30 bg-warning/5",
  low: "border-border bg-background",
  ok: "border-care/25 bg-mint-soft/50",
};

const priorityChip: Record<Priority, string> = {
  high: "bg-destructive/10 text-destructive",
  medium: "bg-warning/10 text-warning",
  low: "bg-secondary text-muted-foreground",
  ok: "bg-mint-soft text-care",
};

export function CareActionCard({
  icon: Icon,
  title,
  count,
  description,
  priority,
  to,
  ctaLabel,
  isLoading,
}: {
  icon: LucideIcon;
  title: string;
  count: number;
  description: string;
  priority: Priority;
  to: string;
  ctaLabel: string;
  isLoading?: boolean;
}) {
  const effective: Priority = count === 0 ? "ok" : priority;
  return (
    <article
      className={cn(
        "flex flex-col gap-3 rounded-2xl border p-4 transition-shadow hover:shadow-card",
        priorityClass[effective],
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-background text-ink">
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", priorityChip[effective])}>
          {priorityLabel[effective]}
        </span>
      </header>
      <div>
        <div className="flex items-baseline gap-2">
          <span className="font-display text-3xl font-bold text-ink">
            {isLoading ? "—" : count}
          </span>
          <h3 className="font-display text-sm font-semibold text-ink">{title}</h3>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <Link
        to={to}
        className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        {ctaLabel} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </article>
  );
}