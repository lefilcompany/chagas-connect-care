import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  tone = "neutral",
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  tone?: "neutral" | "positive";
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed p-8 text-center",
        tone === "positive" ? "border-care/30 bg-mint-soft/40" : "border-border bg-background",
        className,
      )}
    >
      {Icon && (
        <div className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full",
          tone === "positive" ? "bg-mint-soft text-care" : "bg-secondary text-muted-foreground",
        )}>
          <Icon className="h-5 w-5" aria-hidden />
        </div>
      )}
      <div>
        <p className="font-display text-base font-semibold text-ink">{title}</p>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({ title = "Não foi possível carregar", description, action }: { title?: string; description?: string; action?: React.ReactNode }) {
  return (
    <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm">
      <p className="font-display font-semibold text-destructive">{title}</p>
      {description && <p className="mt-1 text-destructive/80">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function SkeletonState({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-2xl bg-secondary", className)} />;
}