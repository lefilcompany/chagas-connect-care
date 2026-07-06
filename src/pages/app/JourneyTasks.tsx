import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { apiListTasks, apiUpdateTask } from "@/features/journeys/api";
import type { JourneyTask } from "@/features/journeys/types";

const PRIORITY_TONE: Record<JourneyTask["priority"], string> = {
  alta: "bg-coral-soft text-primary border-coral/40",
  media: "bg-secondary text-ink border-border",
  baixa: "bg-muted text-muted-foreground border-border",
};

const STATUS_TONE: Record<JourneyTask["status"], string> = {
  aberta: "bg-mint-soft text-care border-care/30",
  concluida: "bg-muted text-muted-foreground border-border",
  cancelada: "bg-muted text-muted-foreground border-border",
};

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function JourneyTasks() {
  const qc = useQueryClient();
  const { data: tasks, isLoading } = useQuery({ queryKey: ["journey-tasks"], queryFn: apiListTasks, refetchInterval: 30_000 });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: JourneyTask["status"] }) => apiUpdateTask(id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["journey-tasks"] });
      toast({ title: "Tarefa atualizada" });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink md:text-3xl">Tarefas de jornadas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tarefas criadas pelos nós de jornadas ativas para a equipe.
        </p>
      </div>

      {isLoading ? (
        <Card className="p-8 text-center text-muted-foreground">Carregando…</Card>
      ) : !tasks?.length ? (
        <Card className="p-8 text-center text-muted-foreground">
          Nenhuma tarefa aberta no momento.
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-secondary/60 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Título</th>
                <th className="px-3 py-2">Pessoa</th>
                <th className="px-3 py-2">Prioridade</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Prazo</th>
                <th className="px-3 py-2">Criada</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id} className="border-t border-border">
                  <td className="px-3 py-2 text-ink">
                    <div className="font-medium">{t.title}</div>
                    {t.description ? <div className="text-xs text-muted-foreground">{t.description}</div> : null}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{t.patientName ?? "—"}</td>
                  <td className="px-3 py-2"><Badge variant="outline" className={PRIORITY_TONE[t.priority]}>{t.priority}</Badge></td>
                  <td className="px-3 py-2"><Badge variant="outline" className={STATUS_TONE[t.status]}>{t.status}</Badge></td>
                  <td className="px-3 py-2 text-muted-foreground">{fmt(t.dueAt)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{fmt(t.createdAt)}</td>
                  <td className="px-3 py-2 text-right">
                    {t.status === "aberta" ? (
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: t.id, status: "concluida" })}>
                          Concluir
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: t.id, status: "cancelada" })}>
                          Cancelar
                        </Button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}