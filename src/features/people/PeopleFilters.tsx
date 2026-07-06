import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { quickFilterLabels, type QuickFilter } from "./types";

export function PeopleFilters({
  query,
  onQueryChange,
  filter,
  onFilterChange,
  counts,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  filter: QuickFilter;
  onFilterChange: (f: QuickFilter) => void;
  counts: Record<QuickFilter, number>;
}) {
  const chips: QuickFilter[] = ["todos", "atencao", "sem-contato", "sem-consentimento", "sem-canal", "sem-cuidador", "falha-envio"];
  return (
    <div className="space-y-3">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
        <Input
          className="pl-9 tap-target"
          placeholder="Buscar por nome ou cidade..."
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          aria-label="Buscar pessoa"
        />
      </div>
      <div role="tablist" aria-label="Filtros rápidos" className="flex flex-wrap gap-2">
        {chips.map((k) => {
          const active = filter === k;
          return (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onFilterChange(k)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              <span>{quickFilterLabels[k]}</span>
              <span
                className={cn(
                  "rounded-full px-1.5 text-[10px] font-semibold",
                  active ? "bg-primary-foreground/20" : "bg-secondary text-muted-foreground",
                )}
              >
                {counts[k] ?? 0}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}