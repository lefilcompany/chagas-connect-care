import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchers, qk } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Copy, Trash2, Pencil, Users } from "lucide-react";
import { z } from "zod";
import { SegmentFiltersForm } from "@/components/app/SegmentFilters";
import { RecipientPreview } from "@/components/app/RecipientPreview";
import {
  AUDIENCE_LABELS, AudienceType, SegmentDef, SegmentFilters,
  emptyFilters, resolveRecipients,
} from "@/lib/segments";

const nameSchema = z.string().trim().min(2, "Nome muito curto").max(80);

export default function Segments() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<SegmentDef | null>(null);
  const [open, setOpen] = useState(false);
  const { data: segments = [] } = useQuery<SegmentDef[]>({
    queryKey: qk.segments,
    queryFn: fetchers.segments as () => Promise<SegmentDef[]>,
  });

  const openNew = () => {
    setEditing({
      id: "",
      name: "",
      description: "",
      audience_types: ["paciente"],
      filters: emptyFilters(),
    });
    setOpen(true);
  };

  const duplicate = (s: SegmentDef) => {
    setEditing({ ...s, id: "", name: `${s.name} (cópia)` });
    setOpen(true);
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este segmento?")) return;
    const { error } = await supabase.from("audience_segments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Segmento excluído");
    queryClient.invalidateQueries({ queryKey: qk.segments });
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
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
                <Button variant="outline" size="sm" className="flex-1" onClick={() => { setEditing(s); setOpen(true); }}>
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

      <SegmentDialog
        open={open}
        onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}
        initial={editing}
        ownerId={user?.id ?? null}
        onSaved={() => queryClient.invalidateQueries({ queryKey: qk.segments })}
      />
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
  if (filters.institution) chips.push(`Instituição: ${filters.institution}`);
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

function SegmentDialog({
  open, onOpenChange, initial, ownerId, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: SegmentDef | null;
  ownerId: string | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [audienceTypes, setAudienceTypes] = useState<AudienceType[]>(["paciente"]);
  const [filters, setFilters] = useState<SegmentFilters>(emptyFilters());
  const [saving, setSaving] = useState(false);
  const [institution, setInstitution] = useState("");

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setDescription(initial?.description ?? "");
      setAudienceTypes(initial?.audience_types?.length ? initial.audience_types : ["paciente"]);
      setFilters(initial?.filters ?? emptyFilters());
    }
  }, [open, initial]);

  useEffect(() => {
    if (!ownerId) return;
    supabase.from("profiles").select("institution").eq("id", ownerId).maybeSingle()
      .then(({ data }) => setInstitution(data?.institution ?? ""));
  }, [ownerId]);

  const { data: recipients = [], isLoading } = useQuery({
    queryKey: ["segment-resolve-edit", audienceTypes, filters, open],
    queryFn: () => resolveRecipients(audienceTypes, filters),
    enabled: open,
  });

  const isEdit = !!initial?.id;
  const valid = nameSchema.safeParse(name).success && audienceTypes.length > 0;

  const save = async () => {
    const parsed = nameSchema.safeParse(name);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    if (!audienceTypes.length) return toast.error("Selecione ao menos um tipo de público.");
    setSaving(true);
    const payload = {
      name: parsed.data,
      description,
      audience_types: audienceTypes,
      filters: filters as any,
      institution,
      owner_id: ownerId,
    };
    const { error } = isEdit
      ? await supabase.from("audience_segments").update(payload).eq("id", initial!.id)
      : await supabase.from("audience_segments").insert(payload as any);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(isEdit ? "Segmento atualizado" : "Segmento criado");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar segmento" : "Novo segmento"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Crônicos do Recife" />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Como esse segmento será usado" />
            </div>
          </div>

          <SegmentFiltersForm
            audienceTypes={audienceTypes}
            onAudienceChange={setAudienceTypes}
            filters={filters}
            onFiltersChange={setFilters}
          />

          <div className="space-y-2">
            <Label>Prévia de destinatários</Label>
            <RecipientPreview
              recipients={recipients}
              loading={isLoading}
              selectedKeys={new Set(recipients.map((r) => r.key))}
              onChange={() => { /* read-only preview here */ }}
            />
            <p className="text-xs text-muted-foreground">A seleção individual fica disponível no momento do envio do conteúdo.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="hero" onClick={save} disabled={!valid || saving}>
            {isEdit ? "Salvar" : "Criar segmento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}