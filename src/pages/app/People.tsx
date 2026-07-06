import { useMemo, useState } from "react";
import { Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewPatientWizard } from "@/components/app/patients/NewPatientWizard";
import { EmptyState, ErrorState, SkeletonState } from "@/components/care/EmptyState";
import { PeopleFilters } from "@/features/people/PeopleFilters";
import { PeopleList } from "@/features/people/PeopleList";
import { usePeopleWithDerived } from "@/features/people/usePeople";
import type { QuickFilter } from "@/features/people/types";

function matchFilter(p: ReturnType<typeof usePeopleWithDerived>["data"] extends (infer T)[] | undefined ? T : never, f: QuickFilter) {
  const d = p.derived;
  switch (f) {
    case "todos": return true;
    case "atencao": return d.pendencies.length > 0;
    case "sem-contato": return d.pendencies.includes("sem-contato");
    case "sem-consentimento": return d.pendencies.includes("consentimento");
    case "sem-canal": return d.pendencies.includes("canal");
    case "sem-cuidador": return d.pendencies.includes("cuidador");
    case "falha-envio": return d.pendencies.includes("falha");
  }
}

export default function People() {
  const { data, isLoading, error, refetch } = usePeopleWithDerived();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<QuickFilter>("todos");
  const [newOpen, setNewOpen] = useState(false);

  const people = data ?? [];

  const counts = useMemo(() => {
    const keys: QuickFilter[] = ["todos", "atencao", "sem-contato", "sem-consentimento", "sem-canal", "sem-cuidador", "falha-envio"];
    const acc = {} as Record<QuickFilter, number>;
    for (const k of keys) acc[k] = people.filter((p) => matchFilter(p, k)).length;
    return acc;
  }, [people]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return people.filter((p) => {
      if (!matchFilter(p, filter)) return false;
      if (!q) return true;
      return (
        p.full_name.toLowerCase().includes(q) ||
        (p.city ?? "").toLowerCase().includes(q)
      );
    });
  }, [people, query, filter]);

  const handleWizardOpenChange = (nextOpen: boolean) => {
    setNewOpen(nextOpen);
    if (!nextOpen) void refetch();
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">Pessoas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pacientes, famílias e cuidadores acompanhados pela sua equipe.
          </p>
        </div>
        <Button variant="hero" onClick={() => setNewOpen(true)} className="tap-target">
          <Plus className="h-4 w-4" /> Nova pessoa
        </Button>
        <NewPatientWizard open={newOpen} onOpenChange={handleWizardOpenChange} />
      </header>

      <PeopleFilters query={query} onQueryChange={setQuery} filter={filter} onFilterChange={setFilter} counts={counts} />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonState key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : error ? (
        <ErrorState
          description="Recarregue em alguns instantes ou verifique sua conexão."
          action={<Button variant="outline" size="sm" onClick={() => refetch()}>Tentar novamente</Button>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={people.length === 0 ? "Ninguém cadastrado ainda" : "Nenhuma pessoa nesse filtro"}
          description={people.length === 0
            ? "Cadastre a primeira pessoa para começar o acompanhamento."
            : "Ajuste os filtros rápidos ou a busca para ver mais pessoas."}
          action={people.length === 0 ? (
            <Button variant="hero" onClick={() => setNewOpen(true)}>
              <Plus className="h-4 w-4" /> Cadastrar pessoa
            </Button>
          ) : undefined}
        />
      ) : (
        <PeopleList people={filtered} />
      )}
    </div>
  );
}
