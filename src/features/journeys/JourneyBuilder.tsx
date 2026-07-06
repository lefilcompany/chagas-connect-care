import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft, GripVertical, Pencil, Plus, Save, Trash2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { PreviewBanner } from "./PreviewBanner";
import { useJourney } from "./useJourneys";
import { NODE_CATALOG, TONE_STYLES, nodeMeta } from "./nodeCatalog";
import type { JourneyNode, JourneyNodeKind, JourneyStatus } from "./types";

const STATUS_OPTIONS: { value: JourneyStatus; label: string }[] = [
  { value: "rascunho", label: "Rascunho" },
  { value: "ativa-preview", label: "Ativa (preview)" },
  { value: "pausada", label: "Pausada" },
  { value: "arquivada", label: "Arquivada" },
];

function AddNodeDialog({
  open, onOpenChange, onAdd,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAdd: (kind: JourneyNodeKind, title: string) => void;
}) {
  const [kind, setKind] = useState<JourneyNodeKind>("whatsapp");
  const [title, setTitle] = useState("");
  const meta = nodeMeta(kind);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar bloco</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="node-kind">Tipo</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as JourneyNodeKind)}>
              <SelectTrigger id="node-kind"><SelectValue /></SelectTrigger>
              <SelectContent>
                {NODE_CATALOG.map((n) => (
                  <SelectItem key={n.kind} value={n.kind}>{n.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{meta.hint}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="node-title">Rótulo curto</Label>
            <Input id="node-title" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder={`Ex.: ${meta.label} — descreva o passo`} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={!title.trim()}
            onClick={() => { onAdd(kind, title.trim()); onOpenChange(false); setTitle(""); }}
          >
            Adicionar bloco
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NodeCard({
  node, onEdit, onRemove,
}: { node: JourneyNode; onEdit: () => void; onRemove: () => void }) {
  const meta = nodeMeta(node.kind);
  const Icon = meta.icon;
  return (
    <div className={`group relative rounded-xl border p-3 shadow-sm ${TONE_STYLES[meta.tone]}`}>
      <div className="flex items-start gap-2">
        <GripVertical className="mt-0.5 h-4 w-4 opacity-40" aria-hidden />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4" aria-hidden />
            <span className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{meta.label}</span>
          </div>
          <p className="mt-1 text-sm font-medium">{node.title}</p>
          {node.description ? (
            <p className="mt-0.5 text-xs opacity-80">{node.description}</p>
          ) : null}
        </div>
        <div className="flex opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit} aria-label="Editar bloco">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRemove} aria-label="Remover bloco">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function EditNodeDialog({
  node, onSave, onOpenChange,
}: {
  node: JourneyNode | null;
  onSave: (patch: Partial<JourneyNode>) => void;
  onOpenChange: (v: boolean) => void;
}) {
  const [title, setTitle] = useState(node?.title ?? "");
  const [desc, setDesc] = useState(node?.description ?? "");
  if (!node) return null;
  return (
    <Dialog open={!!node} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar bloco</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-title">Título</Label>
            <Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-desc">Descrição</Label>
            <Textarea id="edit-desc" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={!title.trim()}
            onClick={() => { onSave({ title: title.trim(), description: desc.trim() || undefined }); onOpenChange(false); }}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function JourneyBuilder({ id }: { id: string }) {
  const navigate = useNavigate();
  const { journey, addNode, addColumn, renameColumn, removeColumn, patchNode, removeNode, update } = useJourney(id);
  const [addTarget, setAddTarget] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ columnId: string; node: JourneyNode } | null>(null);
  const [newColumnTitle, setNewColumnTitle] = useState("");

  if (!journey) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild>
          <Link to="/app/jornadas"><ArrowLeft className="h-4 w-4" /> Voltar</Link>
        </Button>
        <Card className="p-8 text-center text-muted-foreground">
          Jornada não encontrada. Ela pode ter sido excluída neste navegador.
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
            <Link to="/app/jornadas"><ArrowLeft className="h-4 w-4" /> Todas as jornadas</Link>
          </Button>
          <Input
            value={journey.name}
            onChange={(e) => update(journey.id, { name: e.target.value })}
            className="border-transparent bg-transparent px-0 font-display text-2xl font-bold text-ink shadow-none focus-visible:border-input focus-visible:bg-background md:text-3xl"
            aria-label="Nome da jornada"
          />
          <Textarea
            value={journey.goal}
            onChange={(e) => update(journey.id, { goal: e.target.value })}
            placeholder="Objetivo de cuidado desta jornada"
            rows={2}
            className="mt-2 max-w-2xl border-transparent bg-transparent px-0 text-sm text-muted-foreground shadow-none focus-visible:border-input focus-visible:bg-background"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={journey.status}
            onValueChange={(v) => update(journey.id, { status: v as JourneyStatus })}
          >
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() => {
              // Já salvamos a cada edição; este botão dá feedback explícito.
              update(journey.id, {});
              toast({ title: "Rascunho atualizado", description: "Estrutura salva localmente para revisão." });
            }}
          >
            <Save className="h-4 w-4" aria-hidden /> Salvar rascunho
          </Button>
          <Button variant="outline" onClick={() => navigate("/app/jornadas")}>
            Concluir
          </Button>
        </div>
      </div>

      <PreviewBanner />

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" className="border-border bg-secondary text-ink">
          {journey.columns.reduce((acc, c) => acc + c.nodes.length, 0)} blocos
        </Badge>
        <span>·</span>
        <span>Última alteração {new Date(journey.updatedAt).toLocaleString("pt-BR")}</span>
      </div>

      <div className="-mx-1 overflow-x-auto pb-4">
        <div className="flex min-w-full gap-4 px-1">
          {journey.columns.map((col) => (
            <section
              key={col.id}
              className="flex w-[300px] shrink-0 flex-col gap-3 rounded-2xl border border-border bg-background/60 p-3"
              aria-label={`Coluna ${col.title}`}
            >
              <header className="flex items-center gap-1">
                <Input
                  value={col.title}
                  onChange={(e) => renameColumn(col.id, e.target.value)}
                  className="h-8 border-transparent bg-transparent px-1 font-display text-sm font-semibold text-ink shadow-none focus-visible:border-input focus-visible:bg-background"
                  aria-label="Título da coluna"
                />
                <Button
                  variant="ghost" size="icon" className="h-7 w-7"
                  onClick={() => removeColumn(col.id)}
                  aria-label="Remover coluna"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </header>

              <div className="flex flex-col gap-2">
                {col.nodes.map((n) => (
                  <NodeCard
                    key={n.id}
                    node={n}
                    onEdit={() => setEditing({ columnId: col.id, node: n })}
                    onRemove={() => removeNode(col.id, n.id)}
                  />
                ))}
                {col.nodes.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                    Nenhum bloco.
                  </p>
                ) : null}
              </div>

              <Button
                variant="outline" size="sm"
                onClick={() => setAddTarget(col.id)}
              >
                <Plus className="h-3.5 w-3.5" /> Adicionar bloco
              </Button>
            </section>
          ))}

          <section className="flex w-[260px] shrink-0 flex-col gap-2 rounded-2xl border border-dashed border-border p-3">
            <Label htmlFor="new-col" className="text-xs text-muted-foreground">Nova coluna</Label>
            <Input
              id="new-col"
              value={newColumnTitle}
              onChange={(e) => setNewColumnTitle(e.target.value)}
              placeholder="Ex.: Follow-up"
            />
            <Button
              size="sm"
              disabled={!newColumnTitle.trim()}
              onClick={() => { addColumn(newColumnTitle.trim()); setNewColumnTitle(""); }}
            >
              <Plus className="h-4 w-4" /> Adicionar coluna
            </Button>
          </section>
        </div>
      </div>

      <AddNodeDialog
        open={!!addTarget}
        onOpenChange={(v) => { if (!v) setAddTarget(null); }}
        onAdd={(kind, title) => { if (addTarget) addNode(addTarget, kind, title); }}
      />

      <EditNodeDialog
        node={editing?.node ?? null}
        onOpenChange={(v) => { if (!v) setEditing(null); }}
        onSave={(patch) => { if (editing) patchNode(editing.columnId, editing.node.id, patch); }}
      />
    </div>
  );
}