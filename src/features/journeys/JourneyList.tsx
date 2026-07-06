import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Copy, GitBranch, MoreHorizontal, Pause, Pencil, Play, Plus, Search, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/care/EmptyState";
import { useJourneys, useJourneyMetrics } from "./useJourneys";
import type { Journey, JourneyStatus } from "./types";

const STATUS_LABEL: Record<JourneyStatus, string> = {
  rascunho: "Rascunho",
  pausada: "Pausada",
  ativa: "Ativa",
  arquivada: "Arquivada",
};

const STATUS_TONE: Record<JourneyStatus, string> = {
  rascunho: "bg-secondary text-ink border-border",
  pausada: "bg-muted text-muted-foreground border-border",
  ativa: "bg-mint-soft text-care border-care/30",
  arquivada: "bg-muted text-muted-foreground border-border",
};

function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function JourneyCard({ j, onDelete, onDuplicate, onPublish, onPause }: {
  j: Journey;
  onDelete: () => void;
  onDuplicate: () => void;
  onPublish: () => void;
  onPause: () => void;
}) {
  const { data: metrics } = useJourneyMetrics(j.id);
  const m = metrics ?? { active: 0, waiting: 0, completed: 0, failed: 0, stopped: 0, handoff: 0 };
  return (
    <Card className="p-5 shadow-soft transition hover:shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-lg font-semibold text-ink">{j.name}</h2>
            <Badge variant="outline" className={STATUS_TONE[j.status]}>{STATUS_LABEL[j.status]}</Badge>
          </div>
          {j.goal ? (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{j.goal}</p>
          ) : (
            <p className="mt-1 text-sm italic text-muted-foreground">Sem objetivo definido.</p>
          )}
          {j.audienceLabel ? (
            <p className="mt-2 text-xs text-muted-foreground">
              <span className="font-medium text-ink">Audiência:</span> {j.audienceLabel}
            </p>
          ) : null}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Ações da jornada">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link to={`/app/jornadas/${j.id}`}>
                <Pencil className="mr-2 h-4 w-4" /> Editar
              </Link>
            </DropdownMenuItem>
            {j.status !== "ativa" ? (
              <DropdownMenuItem onClick={onPublish}>
                <Play className="mr-2 h-4 w-4" /> Publicar
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={onPause}>
                <Pause className="mr-2 h-4 w-4" /> Pausar
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="mr-2 h-4 w-4" /> Duplicar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
              <Trash2 className="mr-2 h-4 w-4" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          ["Ativas", m.active],
          ["Aguardando", m.waiting],
          ["Concluídas", m.completed],
          ["Falhas", m.failed],
          ["Handoff", m.handoff],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-lg border border-border bg-secondary/60 p-2">
            <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
            <dd className="mt-0.5 font-display text-base font-semibold text-ink">{value as number}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>Última execução: {formatDate((m as any).lastRunAt)}</span>
        <Button asChild variant="ghost" size="sm">
          <Link to={`/app/jornadas/${j.id}`}>Abrir editor →</Link>
        </Button>
      </div>
    </Card>
  );
}

function NewJourneyDialog({ onCreate }: { onCreate: (data: { name: string; goal: string }) => Promise<any> | void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg">
          <Plus className="h-4 w-4" aria-hidden /> Nova jornada
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova jornada</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="j-name">Nome</Label>
            <Input id="j-name" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Confirmação de consulta" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="j-goal">Objetivo de cuidado</Label>
            <Textarea id="j-goal" value={goal} onChange={(e) => setGoal(e.target.value)}
              placeholder="Descreva o resultado desejado para a pessoa." rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            disabled={!name.trim()}
            onClick={async () => { await onCreate({ name: name.trim(), goal: goal.trim() }); setOpen(false); setName(""); setGoal(""); }}
          >
            Criar rascunho
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function JourneyList() {
  const { journeys, isLoading, create, remove, duplicate, publish, pause } = useJourneys();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<JourneyStatus | "todas">("todas");

  const filtered = useMemo(() => {
    return journeys.filter((j) => {
      if (status !== "todas" && j.status !== status) return false;
      if (!q.trim()) return true;
      const t = q.trim().toLowerCase();
      return j.name.toLowerCase().includes(t) || j.goal.toLowerCase().includes(t);
    });
  }, [journeys, q, status]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink md:text-3xl">
            Jornadas de cuidado
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Desenhe sequências de contato guiadas por eventos, audiências e canais.
          </p>
        </div>
        <NewJourneyDialog onCreate={(data) => create(data)} />
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou objetivo…" className="pl-9" />
        </div>
        <div className="flex flex-wrap gap-2">
          {(["todas", "rascunho", "ativa", "pausada", "arquivada"] as const).map((s) => (
            <Button key={s} type="button" variant={status === s ? "default" : "outline"} size="sm"
              onClick={() => setStatus(s)}>
              {s === "todas" ? "Todas" : STATUS_LABEL[s]}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0,1,2,3].map((i) => <Card key={i} className="h-40 animate-pulse bg-secondary/40" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={GitBranch}
          title={q || status !== "todas" ? "Nenhuma jornada com esses filtros" : "Ainda não há jornadas"}
          description="Crie um rascunho, desenhe o fluxo e publique para o motor executar."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((j) => (
            <JourneyCard key={j.id} j={j}
              onDelete={() => remove(j.id)}
              onDuplicate={() => duplicate(j.id)}
              onPublish={() => publish(j.id)}
              onPause={() => pause(j.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}