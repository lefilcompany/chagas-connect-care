import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { fetchers, qk } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus, Copy, Trash2, Pencil, Users, MoreVertical, Eye } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AUDIENCE_LABELS, AudienceType, SegmentDef, SegmentFilters,
  resolveRecipients,
} from "@/lib/segments";

export default function Segments() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: segments = [], isLoading } = useQuery<SegmentDef[]>({
    queryKey: qk.segments,
    queryFn: fetchers.segments as () => Promise<SegmentDef[]>,
  });

  const openNew = () => navigate("/app/segmentos/novo");
  const edit = (s: SegmentDef) => navigate(`/app/segmentos/${s.id}/editar`);
  const duplicate = (s: SegmentDef) => navigate(`/app/segmentos/${s.id}/duplicar`);

  const remove = async (id: string) => {
    if (!confirm("Excluir este segmento?")) return;
    const { error } = await supabase.from("audience_segments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Segmento excluído");
    queryClient.invalidateQueries({ queryKey: qk.segments });
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap md:flex-nowrap items-start md:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-bold text-brand">Segmentos</h1>
          <p className="text-muted-foreground mt-1">
            Crie audiências reutilizáveis combinando filtros sobre pacientes, familiares, cuidadores e médicos.
          </p>
        </div>
        <Button variant="hero" onClick={openNew}>
          <Plus className="h-4 w-4" /> Novo segmento
        </Button>
      </header>

      {isLoading ? (
        <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
          <div className="hidden md:grid grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_140px_160px_56px] gap-4 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border bg-muted/30">
            <div>Nome da segmentação</div>
            <div>Audiência / Filtros</div>
            <div>Destinatários</div>
            <div>Última atualização</div>
            <div className="text-right">Ações</div>
          </div>
          <ul className="divide-y divide-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <li
                key={i}
                className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_140px_160px_56px] gap-3 md:gap-4 px-5 py-4 items-center"
              >
                <div className="min-w-0 space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-3.5 w-1/2" />
                </div>
                <div className="min-w-0 flex flex-wrap gap-1.5">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-12" />
                </div>
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-4 w-28" />
                <div className="flex justify-end">
                  <Skeleton className="h-8 w-8 rounded-md" />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : segments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
          Nenhum segmento criado ainda. Clique em <span className="font-medium text-brand">Novo segmento</span> para começar.
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
          <div className="hidden md:grid grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_140px_160px_56px] gap-4 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border bg-muted/30">
            <div>Nome da segmentação</div>
            <div>Audiência / Filtros</div>
            <div>Destinatários</div>
            <div>Última atualização</div>
            <div className="text-right">Ações</div>
          </div>
          <ul className="divide-y divide-border">
            {(segments as SegmentDef[]).map((s) => (
              <li
                key={s.id}
                className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_140px_160px_56px] gap-3 md:gap-4 px-5 py-4 items-center hover:bg-muted/30 transition-colors"
              >
                <div className="min-w-0 flex items-center">
                  <div>
                    <button
                      onClick={() => edit(s)}
                      className="text-left font-display font-semibold text-brand hover:underline truncate block w-full"
                    >
                      {s.name}
                    </button>
                    {s.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{s.description}</p>
                    )}
                  </div>
                </div>
                <div className="min-w-0 flex flex-wrap items-center gap-1.5">
                  {(Array.isArray(s.audience_types) ? s.audience_types : []).map((a) => (
                    <Badge key={a} variant="secondary" className="text-[10px]">{AUDIENCE_LABELS[a]}</Badge>
                  ))}
                  <SegmentFilterSummary filters={s.filters} />
                </div>
                <SegmentCount audience_types={s.audience_types} filters={s.filters} />
                <div className="text-sm text-muted-foreground flex items-center">
                  {s.updated_at
                    ? new Date(s.updated_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
                    : "—"}
                </div>
                <div className="flex items-center justify-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="Mais ações">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem onClick={() => edit(s)}>
                        <Eye className="h-4 w-4 mr-2" /> Ver destinatários
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => edit(s)}>
                        <Pencil className="h-4 w-4 mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => duplicate(s)}>
                        <Copy className="h-4 w-4 mr-2" /> Duplicar
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => remove(s.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" /> Excluir segmento
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SegmentFilterSummary({ filters }: { filters: SegmentFilters }) {
  let count = 0;
  if (filters.stages?.length) count++;
  if (filters.city?.length) count++;
  if (filters.state?.length) count++;
  if (filters.age_min != null) count++;
  if (filters.age_max != null) count++;
  if (filters.status) count++;
  if (filters.channel) count++;

  if (count === 0) return <span className="text-[11px] text-muted-foreground italic">sem filtros</span>;

  return (
    <Badge variant="outline" className="text-[10px] font-normal">
      {count} filtro{count > 1 ? "s" : ""}
    </Badge>
  );
}

function SegmentCount({ audience_types, filters }: { audience_types: AudienceType[]; filters: SegmentFilters }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["segment-resolve", audience_types, filters],
    queryFn: () => resolveRecipients(audience_types, filters),
    staleTime: 30_000,
  });
  return (
    <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-muted/50 px-2.5 py-1 text-xs font-medium text-brand">
      <Users className="h-3.5 w-3.5" />
      {isLoading ? "..." : `${data.length} destinatário${data.length === 1 ? "" : "s"}`}
    </div>
  );
}