import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { fetchers, qk } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Copy, Trash2, Pencil, Users } from "lucide-react";
import {
  AUDIENCE_LABELS, AudienceType, SegmentDef, SegmentFilters,
  resolveRecipients,
} from "@/lib/segments";

export default function Segments() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: segments = [] } = useQuery<SegmentDef[]>({
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

      {segments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
          Nenhum segmento criado ainda. Clique em <span className="font-medium text-brand">Novo segmento</span> para começar.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(segments as SegmentDef[]).map((s) => (
            <article key={s.id} className="rounded-2xl border border-border bg-card p-5 shadow-card flex flex-col gap-3">
              <div>
                <h3 className="font-display text-lg font-bold text-brand truncate">{s.name}</h3>
                {s.description && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{s.description}</p>}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {s.audience_types.map((a) => (
                  <Badge key={a} variant="secondary">{AUDIENCE_LABELS[a]}</Badge>
                ))}
              </div>
              <SegmentChips filters={s.filters} />
              <SegmentCount audience_types={s.audience_types} filters={s.filters} />
              <div className="mt-auto flex items-center gap-2 pt-3 border-t border-border">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => edit(s)}>
                  <Pencil className="h-4 w-4" /> Editar
                </Button>
                <Button variant="ghost" size="sm" onClick={() => duplicate(s)} aria-label="Duplicar">
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => remove(s.id)} aria-label="Excluir">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function SegmentChips({ filters }: { filters: SegmentFilters }) {
  const chips: string[] = [];
  if (filters.stages?.length) chips.push(`Etapas: ${filters.stages.join(", ")}`);
  if (filters.city) chips.push(`Cidade: ${filters.city}`);
  if (filters.state) chips.push(`UF: ${filters.state}`);
  if (filters.age_min != null) chips.push(`≥ ${filters.age_min} anos`);
  if (filters.age_max != null) chips.push(`≤ ${filters.age_max} anos`);
  if (filters.status) chips.push(`Status: ${filters.status}`);
  if (filters.channel) chips.push(`Canal: ${filters.channel}`);
  
  if (!chips.length) return <p className="text-xs text-muted-foreground italic">Sem filtros (todos os registros).</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((c) => <Badge key={c} variant="outline" className="text-[10px] font-normal">{c}</Badge>)}
    </div>
  );
}

function SegmentCount({ audience_types, filters }: { audience_types: AudienceType[]; filters: SegmentFilters }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["segment-resolve", audience_types, filters],
    queryFn: () => resolveRecipients(audience_types, filters),
    staleTime: 30_000,
  });
  return (
    <div className="inline-flex items-center gap-1.5 self-start rounded-full bg-muted/50 px-2.5 py-1 text-xs font-medium text-brand">
      <Users className="h-3.5 w-3.5" />
      {isLoading ? "..." : `${data.length} destinatário${data.length === 1 ? "" : "s"}`}
    </div>
  );
}