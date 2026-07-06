import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState, SkeletonState } from "@/components/care/EmptyState";
import { PatientSummaryHeader } from "@/features/people/PatientSummaryHeader";
import { CareOrbit } from "@/features/people/CareOrbit";
import { CareTimeline } from "@/features/people/CareTimeline";
import { NextBestAction } from "@/features/people/NextBestAction";
import { usePeopleWithDerived } from "@/features/people/usePeople";
import { cn } from "@/lib/utils";

type Tab = "resumo" | "linha-do-tempo" | "proxima-acao";

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "resumo", label: "Resumo" },
  { id: "linha-do-tempo", label: "Linha do tempo" },
  { id: "proxima-acao", label: "Próxima melhor ação" },
];

export default function PersonDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error } = usePeopleWithDerived();
  const [tab, setTab] = useState<Tab>("resumo");

  const person = useMemo(() => data?.find((p) => p.id === id), [data, id]);

  if (isLoading) return <SkeletonState className="h-64 w-full" />;
  if (error || !person) {
    return (
      <ErrorState
        title="Pessoa não encontrada"
        description="A pessoa pode ter sido removida ou você não tem acesso."
        action={<Button variant="outline" onClick={() => navigate("/app/pessoas")}>Voltar para Pessoas</Button>}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PatientSummaryHeader person={person} onCommunicate={() => navigate("/app/caixa")} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Seções do perfil" className="inline-flex rounded-full border border-border bg-card p-1">
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate(`/app/pacientes/${person.id}`)}>
          <FileText className="h-4 w-4" /> Ficha clínica completa
        </Button>
      </div>

      {tab === "resumo" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <CareOrbit patientId={person.id} patientName={person.full_name} />
          </div>
          <div className="space-y-4">
            <NextBestAction person={person} />
          </div>
        </div>
      )}

      {tab === "linha-do-tempo" && <CareTimeline patientId={person.id} />}

      {tab === "proxima-acao" && <NextBestAction person={person} />}
    </div>
  );
}