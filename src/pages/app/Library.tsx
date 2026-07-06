import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/care/EmptyState";
import { useFolders, iconByName } from "@/hooks/useFolders";
import { useLibrary } from "@/features/library/useLibrary";
import { LibraryFilters, type LibraryFiltersValue } from "@/features/library/LibraryFilters";
import { LibraryDetail } from "@/features/library/LibraryDetail";
import { STATUS_LABEL, STATUS_TONE, type LibraryItem } from "@/features/library/types";

function formatSeconds(s: number) {
  if (s < 60) return `${s}s de leitura`;
  return `${Math.round(s / 60)} min de leitura`;
}

function LibraryCard({
  item, folderIconName, folderLabel, onOpen,
}: {
  item: LibraryItem;
  folderIconName: string;
  folderLabel: string;
  onOpen: () => void;
}) {
  const Icon = iconByName(folderIconName);
  const excerpt = (item.body ?? "").slice(0, 180);
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
      className="cursor-pointer p-4 shadow-soft transition hover:shadow-card focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon className="h-3.5 w-3.5" aria-hidden /> {folderLabel}
        </div>
        <Badge variant="outline" className={STATUS_TONE[item.status]}>
          {STATUS_LABEL[item.status]}
        </Badge>
      </div>
      <h3 className="mt-2 font-display text-base font-semibold leading-tight text-ink">{item.title}</h3>
      <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{excerpt || "Sem corpo definido."}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>{formatSeconds(item.readingSeconds)}</span>
        <span>·</span>
        <span>Público: {item.audience || "não informado"}</span>
      </div>
    </Card>
  );
}

export default function Library() {
  const { data: items = [], isLoading } = useLibrary();
  const { folders } = useFolders();
  const [filters, setFilters] = useState<LibraryFiltersValue>({
    q: "", folder: "todas", audience: "todas", status: "todas",
  });
  const [selected, setSelected] = useState<LibraryItem | null>(null);

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return items.filter((it) => {
      if (filters.folder !== "todas" && it.category !== filters.folder) return false;
      if (filters.audience !== "todas" && it.audience !== filters.audience) return false;
      if (filters.status !== "todas" && it.status !== filters.status) return false;
      if (!q) return true;
      return it.title.toLowerCase().includes(q) || it.body.toLowerCase().includes(q);
    });
  }, [items, filters]);

  const grouped = useMemo(() => {
    const map = new Map<string, LibraryItem[]>();
    for (const it of filtered) {
      const arr = map.get(it.category) ?? [];
      arr.push(it);
      map.set(it.category, arr);
    }
    return map;
  }, [filtered]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink md:text-3xl">Biblioteca de cuidado</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Repositório de conteúdos aprovados para envios e jornadas. Cada peça carrega público,
            pasta, estimativa de leitura e status de ciclo clínico.
          </p>
        </div>
        <Button asChild size="lg">
          <Link to="/app/conteudos">
            <Plus className="h-4 w-4" aria-hidden /> Novo conteúdo
          </Link>
        </Button>
      </header>

      <LibraryFilters value={filters} onChange={setFilters} folders={folders} />

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-secondary" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Nenhum conteúdo encontrado"
          description="Ajuste os filtros ou crie uma nova peça a partir do editor completo."
          action={
            <Button asChild>
              <Link to="/app/conteudos"><Plus className="h-4 w-4" /> Novo conteúdo</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-8">
          {[...grouped.entries()].map(([category, list]) => {
            const folder = folders.find((f) => f.value === category);
            const iconName = folder?.icon.displayName ?? "FolderOpen";
            const Icon = iconByName(iconName);
            return (
              <section key={category} aria-label={`Pasta ${folder?.label ?? "Geral"}`}>
                <header className="mb-3 flex items-center gap-2 text-sm">
                  <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
                  <span className="font-display font-semibold text-ink">{folder?.label ?? "Geral"}</span>
                  <span className="text-muted-foreground">· {list.length}</span>
                </header>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {list.map((it) => (
                    <LibraryCard
                      key={it.id}
                      item={it}
                      folderIconName={iconName}
                      folderLabel={folder?.label ?? "Geral"}
                      onOpen={() => setSelected(it)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <LibraryDetail
        item={selected}
        folders={folders}
        open={!!selected}
        onOpenChange={(v) => { if (!v) setSelected(null); }}
      />
    </div>
  );
}