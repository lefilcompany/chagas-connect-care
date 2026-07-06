import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchers, qk } from "@/lib/queries";
import type { SegmentDef } from "@/lib/segments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AudienceCard } from "@/features/audiences/AudienceCard";
import { EmptyState } from "@/components/care/EmptyState";

export default function Audiences() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  const { data: segments = [], isLoading } = useQuery<SegmentDef[]>({
    queryKey: qk.segments,
    queryFn: fetchers.segments as () => Promise<SegmentDef[]>,
  });

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return segments;
    return segments.filter((s) =>
      s.name.toLowerCase().includes(t) || (s.description ?? "").toLowerCase().includes(t),
    );
  }, [segments, q]);

  const remove = async (id: string) => {
    if (!confirm("Excluir esta audiência?")) return;
    const { error } = await supabase.from("audience_segments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Audiência excluída");
    queryClient.invalidateQueries({ queryKey: qk.segments });
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink md:text-3xl">Audiências</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Combine filtros sobre pessoas, familiares, cuidadores e médicos. Cada audiência
            é descrita como uma frase legível e pode ser usada em jornadas ou envios diretos.
          </p>
        </div>
        <Button size="lg" onClick={() => navigate("/app/segmentos/novo")}>
          <Plus className="h-4 w-4" aria-hidden /> Nova audiência
        </Button>
      </header>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou observação…" className="pl-9" />
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-56 animate-pulse rounded-2xl bg-secondary" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={q ? "Nenhuma audiência com esse termo" : "Ainda não há audiências salvas"}
          description="Crie uma audiência para reaproveitar filtros clínicos em jornadas e envios."
          action={<Button onClick={() => navigate("/app/segmentos/novo")}><Plus className="h-4 w-4" /> Nova audiência</Button>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((s) => (
            <AudienceCard
              key={s.id}
              segment={s}
              onDuplicate={() => navigate(`/app/segmentos/${s.id}/duplicar`)}
              onDelete={() => remove(s.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}