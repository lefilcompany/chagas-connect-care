import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchers, qk } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Search, Send, Trash2, X } from "lucide-react";
import { z } from "zod";
import { SegmentFiltersForm } from "@/components/app/SegmentFilters";
import { RecipientPreview } from "@/components/app/RecipientPreview";
import {
  AudienceType, Recipient, SegmentDef, SegmentFilters,
  emptyFilters, resolveRecipients,
} from "@/lib/segments";

const CATEGORIES = [
  { value: "medicacao", label: "Medicação" },
  { value: "alimentacao", label: "Alimentação" },
  { value: "sono", label: "Sono" },
  { value: "atividade", label: "Atividade física" },
  { value: "familia", label: "Família" },
  { value: "geral", label: "Geral" },
];
const AUDIENCES = [
  { value: "paciente", label: "Paciente" },
  { value: "familia", label: "Família" },
  { value: "cuidador", label: "Cuidadores" },
  { value: "ambos", label: "Todos" },
];

const contentSchema = z.object({
  title: z.string().trim().min(2).max(160),
  category: z.string().min(1),
  audience: z.string().min(1),
  body: z.string().trim().min(5).max(5000),
});

type ContentRow = {
  id: string; title: string; category: string; audience: string; body: string;
};

const labelOf = (arr: { value: string; label: string }[], v: string) =>
  arr.find((x) => x.value === v)?.label ?? v;

export default function Content() {
  const queryClient = useQueryClient();
  const { data: items = [] } = useQuery({ queryKey: qk.content, queryFn: fetchers.content });

  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState<string>("todos");
  const [audFilter, setAudFilter] = useState<string>("todos");

  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<ContentRow | null>(null);
  const [sendItem, setSendItem] = useState<ContentRow | null>(null);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (items as ContentRow[]).filter((c) =>
      (catFilter === "todos" || c.category === catFilter) &&
      (audFilter === "todos" || c.audience === audFilter) &&
      (!term || c.title.toLowerCase().includes(term) || c.body.toLowerCase().includes(term)),
    );
  }, [items, q, catFilter, audFilter]);

  const hasFilters = q || catFilter !== "todos" || audFilter !== "todos";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-brand">Conteúdos educativos</h1>
          <p className="text-muted-foreground mt-1">Biblioteca de orientações para pacientes, famílias e cuidadores.</p>
        </div>
        <Button variant="hero" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Novo conteúdo
        </Button>
      </header>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_220px_200px_auto] lg:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por título ou conteúdo"
              className="pl-9 w-full"
            />
          </div>
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as categorias</SelectItem>
              {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={audFilter} onValueChange={setAudFilter}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Público" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os públicos</SelectItem>
              {AUDIENCES.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {hasFilters ? (
            <Button
              variant="ghost"
              size="sm"
              className="justify-self-start sm:justify-self-end"
              onClick={() => { setQ(""); setCatFilter("todos"); setAudFilter("todos"); }}
            >
              <X className="h-4 w-4" /> Limpar
            </Button>
          ) : <div className="hidden lg:block" />}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
          Nenhum conteúdo encontrado.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <article
              key={c.id}
              className="group flex flex-col rounded-2xl border border-border bg-card p-6 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-soft cursor-pointer"
              onClick={() => setEditItem(c)}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{labelOf(CATEGORIES, c.category)}</Badge>
                <Badge variant="outline">{labelOf(AUDIENCES, c.audience)}</Badge>
              </div>
              <h3 className="mt-3 font-display text-lg font-bold text-brand line-clamp-2">{c.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground line-clamp-3 flex-1">{c.body}</p>
              <div className="mt-4 flex items-center gap-2 pt-3 border-t border-border">
                <Button
                  variant="hero"
                  size="sm"
                  className="flex-1"
                  onClick={(e) => { e.stopPropagation(); setSendItem(c); }}
                >
                  <Send className="h-4 w-4" /> Enviar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); setEditItem(c); }}
                >
                  Editar
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <ContentFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={() => queryClient.invalidateQueries({ queryKey: qk.content })}
      />
      <ContentFormDialog
        open={!!editItem}
        onOpenChange={(v) => !v && setEditItem(null)}
        initial={editItem ?? undefined}
        onSaved={() => queryClient.invalidateQueries({ queryKey: qk.content })}
      />
      <SendContentDialog
        item={sendItem}
        onOpenChange={(v) => !v && setSendItem(null)}
        onSent={() => queryClient.invalidateQueries({ queryKey: qk.messages })}
      />
    </div>
  );
}

function ContentFormDialog({
  open, onOpenChange, initial, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: ContentRow;
  onSaved: () => void;
}) {
  const isEdit = !!initial;
  const [form, setForm] = useState({
    title: "", category: "medicacao", audience: "ambos", body: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        title: initial?.title ?? "",
        category: initial?.category ?? "medicacao",
        audience: initial?.audience ?? "ambos",
        body: initial?.body ?? "",
      });
    }
  }, [open, initial]);

  const valid = contentSchema.safeParse(form).success;

  const save = async () => {
    const parsed = contentSchema.safeParse(form);
    if (!parsed.success) return toast.error("Verifique os campos");
    setSaving(true);
    const { error } = isEdit
      ? await supabase.from("content_library").update(parsed.data).eq("id", initial!.id)
      : await supabase.from("content_library").insert(parsed.data as any);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(isEdit ? "Conteúdo atualizado" : "Conteúdo adicionado");
    onOpenChange(false);
    onSaved();
  };

  const remove = async () => {
    if (!initial) return;
    if (!confirm("Excluir este conteúdo?")) return;
    const { error } = await supabase.from("content_library").delete().eq("id", initial.id);
    if (error) return toast.error(error.message);
    toast.success("Conteúdo excluído");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar conteúdo" : "Adicionar conteúdo"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Título</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Ex: Como tomar o medicamento corretamente"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Público</Label>
              <Select value={form.audience} onValueChange={(v) => setForm({ ...form, audience: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AUDIENCES.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Conteúdo</Label>
            <Textarea
              rows={6}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder="Escreva a orientação completa..."
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          {isEdit && (
            <Button variant="destructive" onClick={remove} className="mr-auto">
              <Trash2 className="h-4 w-4" /> Excluir
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="hero" onClick={save} disabled={!valid || saving}>
            {isEdit ? "Salvar" : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SendContentDialog({
  item, onOpenChange, onSent,
}: {
  item: ContentRow | null;
  onOpenChange: (v: boolean) => void;
  onSent: () => void;
}) {
  const open = !!item;
  const [mode, setMode] = useState<"bulk" | "single" | "segment">("bulk");
  const [patientId, setPatientId] = useState<string>("");
  const [channel, setChannel] = useState<"whatsapp" | "sms">("whatsapp");
  const [sendToPatient, setSendToPatient] = useState(true);
  const [selectedContacts, setSelectedContacts] = useState<Record<string, boolean>>({});
  const [bulkGroups, setBulkGroups] = useState<Record<string, boolean>>({});
  const [sending, setSending] = useState(false);
  // Segment mode
  const [segMode, setSegMode] = useState<"saved" | "adhoc">("saved");
  const [savedSegmentId, setSavedSegmentId] = useState<string>("");
  const [adhocAudiences, setAdhocAudiences] = useState<AudienceType[]>(["paciente"]);
  const [adhocFilters, setAdhocFilters] = useState<SegmentFilters>(emptyFilters());
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [channelOverride, setChannelOverride] = useState<"auto" | "whatsapp" | "sms">("auto");

  useEffect(() => {
    if (open) {
      const aud = item?.audience ?? "ambos";
      setMode("bulk");
      setPatientId("");
      setChannel("whatsapp");
      setSendToPatient(true);
      setSelectedContacts({});
      setBulkGroups({
        paciente: aud === "paciente" || aud === "ambos",
        familiar: aud === "familia" || aud === "ambos",
        cuidador: aud === "cuidador" || aud === "ambos",
        medico: false,
      });
      setSegMode("saved");
      setSavedSegmentId("");
      setAdhocAudiences(["paciente"]);
      setAdhocFilters(emptyFilters());
      setChannelOverride("auto");
      setSelectedKeys(new Set());
    }
  }, [open, item]);

  const { data: patients = [] } = useQuery({
    queryKey: qk.patients,
    queryFn: fetchers.patients,
    enabled: open,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts", patientId],
    enabled: open && !!patientId,
    queryFn: async () => {
      const { data } = await supabase
        .from("contacts")
        .select("id, full_name, phone, relation, channel_pref")
        .eq("patient_id", patientId);
      return data ?? [];
    },
  });

  // For bulk: load all contacts across all patients (RLS scopes to institution)
  const { data: allContacts = [] } = useQuery({
    queryKey: ["all-contacts"],
    enabled: open && mode === "bulk",
    queryFn: async () => {
      const { data } = await supabase
        .from("contacts")
        .select("id, patient_id, relation");
      return data ?? [];
    },
  });

  const { data: savedSegments = [] } = useQuery<SegmentDef[]>({
    queryKey: qk.segments,
    queryFn: fetchers.segments as () => Promise<SegmentDef[]>,
    enabled: open && mode === "segment",
  });

  const activeSegment = mode === "segment" && segMode === "saved"
    ? (savedSegments as SegmentDef[]).find((s) => s.id === savedSegmentId) ?? null
    : null;
  const activeAudiences = mode === "segment"
    ? (segMode === "saved" ? (activeSegment?.audience_types ?? []) : adhocAudiences)
    : [];
  const activeFilters = mode === "segment"
    ? (segMode === "saved" ? (activeSegment?.filters ?? emptyFilters()) : adhocFilters)
    : emptyFilters();

  const { data: segmentRecipients = [], isLoading: segLoading } = useQuery<Recipient[]>({
    queryKey: ["segment-resolve-send", activeAudiences, activeFilters],
    queryFn: () => resolveRecipients(activeAudiences, activeFilters),
    enabled: open && mode === "segment" && activeAudiences.length > 0,
  });

  const selectedContactIds = Object.entries(selectedContacts).filter(([, v]) => v).map(([k]) => k);

  const bulkPreview = useMemo(() => {
    if (mode !== "bulk") return { patients: 0, contacts: 0, total: 0 };
    const pCount = bulkGroups.paciente ? (patients as any[]).length : 0;
    const relations = ["familiar", "cuidador", "medico"].filter((r) => bulkGroups[r]);
    const cCount = (allContacts as any[]).filter((c) => relations.includes(c.relation)).length;
    return { patients: pCount, contacts: cCount, total: pCount + cCount };
  }, [mode, bulkGroups, patients, allContacts]);

  const canSend = mode === "single"
    ? !!patientId && (sendToPatient || selectedContactIds.length > 0)
    : mode === "segment"
      ? selectedKeys.size > 0
      : bulkPreview.total > 0;

  const send = async () => {
    if (!item || !canSend) return;
    setSending(true);
    const body = `${item.title}\n\n${item.body}`;
    const now = new Date().toISOString();
    const rows: any[] = [];

    if (mode === "single") {
      if (sendToPatient) {
        rows.push({ patient_id: patientId, channel, direction: "outbound", body, status: "sent", sent_at: now });
      }
      for (const cid of selectedContactIds) {
        rows.push({ patient_id: patientId, contact_id: cid, channel, direction: "outbound", body, status: "sent", sent_at: now });
      }
    } else if (mode === "bulk") {
      if (bulkGroups.paciente) {
        for (const p of patients as any[]) {
          rows.push({ patient_id: p.id, channel, direction: "outbound", body, status: "sent", sent_at: now });
        }
      }
      const relations = ["familiar", "cuidador", "medico"].filter((r) => bulkGroups[r]);
      for (const c of allContacts as any[]) {
        if (relations.includes(c.relation)) {
          rows.push({ patient_id: c.patient_id, contact_id: c.id, channel, direction: "outbound", body, status: "sent", sent_at: now });
        }
      }
    } else {
      // segment mode
      for (const r of segmentRecipients) {
        if (!selectedKeys.has(r.key)) continue;
        rows.push({
          patient_id: r.patient_id,
          contact_id: r.contact_id ?? null,
          channel: channelOverride === "auto" ? r.channel : channelOverride,
          direction: "outbound",
          body,
          status: "sent",
          sent_at: now,
        });
      }
    }

    if (rows.length === 0) { setSending(false); return; }
    const { error } = await supabase.from("messages").insert(rows);
    setSending(false);
    if (error) return toast.error(error.message);
    toast.success(`Conteúdo enviado (${rows.length} ${rows.length === 1 ? "destinatário" : "destinatários"})`);
    onOpenChange(false);
    onSent();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar conteúdo</DialogTitle>
        </DialogHeader>
        {item && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <div className="text-sm font-semibold text-brand">{item.title}</div>
              <p className="mt-1 text-xs text-muted-foreground line-clamp-3">{item.body}</p>
            </div>

            <div className="flex gap-1 rounded-lg border border-border p-1 overflow-x-auto">
              <button
                type="button"
                onClick={() => setMode("bulk")}
                className={`flex-1 whitespace-nowrap rounded-md py-2 px-2 text-xs sm:text-sm font-medium transition-colors ${mode === "bulk" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
              >
                Por grupo
              </button>
              <button
                type="button"
                onClick={() => setMode("single")}
                className={`flex-1 whitespace-nowrap rounded-md py-2 px-2 text-xs sm:text-sm font-medium transition-colors ${mode === "single" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
              >
                Paciente específico
              </button>
              <button
                type="button"
                onClick={() => setMode("segment")}
                className={`flex-1 whitespace-nowrap rounded-md py-2 px-2 text-xs sm:text-sm font-medium transition-colors ${mode === "segment" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
              >
                Segmentado
              </button>
            </div>

            {mode === "segment" ? (
              <div className="space-y-4">
                <div className="flex gap-1 rounded-lg border border-border p-1">
                  <button
                    type="button"
                    onClick={() => setSegMode("saved")}
                    className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${segMode === "saved" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                  >
                    Usar segmento salvo
                  </button>
                  <button
                    type="button"
                    onClick={() => setSegMode("adhoc")}
                    className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${segMode === "adhoc" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                  >
                    Montar filtros agora
                  </button>
                </div>

                {segMode === "saved" ? (
                  <div className="space-y-2">
                    <Label>Segmento</Label>
                    <Select value={savedSegmentId} onValueChange={setSavedSegmentId}>
                      <SelectTrigger><SelectValue placeholder="Selecione um segmento" /></SelectTrigger>
                      <SelectContent>
                        {(savedSegments as SegmentDef[]).length === 0 ? (
                          <div className="px-3 py-2 text-xs text-muted-foreground">Nenhum segmento salvo. Crie em Segmentos.</div>
                        ) : (
                          (savedSegments as SegmentDef[]).map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {activeSegment?.description && (
                      <p className="text-xs text-muted-foreground">{activeSegment.description}</p>
                    )}
                  </div>
                ) : (
                  <SegmentFiltersForm
                    audienceTypes={adhocAudiences}
                    onAudienceChange={setAdhocAudiences}
                    filters={adhocFilters}
                    onFiltersChange={setAdhocFilters}
                  />
                )}

                {activeAudiences.length > 0 && (
                  <RecipientPreview
                    recipients={segmentRecipients}
                    loading={segLoading}
                    selectedKeys={selectedKeys}
                    onChange={setSelectedKeys}
                  />
                )}

                <div className="space-y-2">
                  <Label>Canal de envio</Label>
                  <Select value={channelOverride} onValueChange={(v) => setChannelOverride(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Canal preferido de cada destinatário</SelectItem>
                      <SelectItem value="whatsapp">Forçar WhatsApp</SelectItem>
                      <SelectItem value="sms">Forçar SMS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : mode === "bulk" ? (
              <div className="space-y-2">
                <Label>Para quem enviar</Label>
                <div className="space-y-2 rounded-lg border border-border p-3">
                  {[
                    { key: "paciente", label: "Todos os pacientes" },
                    { key: "familiar", label: "Todos os familiares" },
                    { key: "cuidador", label: "Todos os cuidadores" },
                    { key: "medico", label: "Todos os médicos" },
                  ].map((g) => (
                    <label key={g.key} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={!!bulkGroups[g.key]}
                        onCheckedChange={(v) => setBulkGroups((s) => ({ ...s, [g.key]: !!v }))}
                      />
                      <span>{g.label}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {bulkPreview.total > 0
                    ? `Será enviado para ${bulkPreview.total} ${bulkPreview.total === 1 ? "destinatário" : "destinatários"}.`
                    : "Selecione ao menos um grupo."}
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Paciente</Label>
                  <Select value={patientId} onValueChange={setPatientId}>
                    <SelectTrigger><SelectValue placeholder="Selecione o paciente" /></SelectTrigger>
                    <SelectContent>
                      {(patients as any[]).map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {patientId && (
                  <div className="space-y-2">
                    <Label>Para quem enviar</Label>
                    <div className="space-y-2 rounded-lg border border-border p-3">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox checked={sendToPatient} onCheckedChange={(v) => setSendToPatient(!!v)} />
                        <span>Paciente</span>
                      </label>
                      {(contacts as any[]).map((c) => (
                        <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={!!selectedContacts[c.id]}
                            onCheckedChange={(v) =>
                              setSelectedContacts((s) => ({ ...s, [c.id]: !!v }))
                            }
                          />
                          <span>{c.full_name} <span className="text-muted-foreground">· {c.relation}</span></span>
                        </label>
                      ))}
                      {contacts.length === 0 && (
                        <p className="text-xs text-muted-foreground">Nenhum contato cadastrado para este paciente.</p>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {mode !== "segment" && (
              <div className="space-y-2">
                <Label>Canal</Label>
                <Select value={channel} onValueChange={(v) => setChannel(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="hero" onClick={send} disabled={!canSend || sending}>
            <Send className="h-4 w-4" /> Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}