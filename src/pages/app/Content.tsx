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

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por título ou conteúdo"
            className="pl-9"
          />
        </div>
        <div className="w-48">
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as categorias</SelectItem>
              {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="w-40">
          <Select value={audFilter} onValueChange={setAudFilter}>
            <SelectTrigger><SelectValue placeholder="Público" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os públicos</SelectItem>
              {AUDIENCES.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={() => { setQ(""); setCatFilter("todos"); setAudFilter("todos"); }}>
            <X className="h-4 w-4" /> Limpar
          </Button>
        )}
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
  const [patientId, setPatientId] = useState<string>("");
  const [channel, setChannel] = useState<"whatsapp" | "sms">("whatsapp");
  const [sendToPatient, setSendToPatient] = useState(true);
  const [selectedContacts, setSelectedContacts] = useState<Record<string, boolean>>({});
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) {
      setPatientId("");
      setChannel("whatsapp");
      setSendToPatient(true);
      setSelectedContacts({});
    }
  }, [open]);

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

  const selectedContactIds = Object.entries(selectedContacts).filter(([, v]) => v).map(([k]) => k);
  const canSend = !!patientId && (sendToPatient || selectedContactIds.length > 0);

  const send = async () => {
    if (!item || !canSend) return;
    setSending(true);
    const rows: any[] = [];
    if (sendToPatient) {
      rows.push({
        patient_id: patientId, channel, direction: "outbound",
        body: `${item.title}\n\n${item.body}`, status: "sent", sent_at: new Date().toISOString(),
      });
    }
    for (const cid of selectedContactIds) {
      rows.push({
        patient_id: patientId, contact_id: cid, channel, direction: "outbound",
        body: `${item.title}\n\n${item.body}`, status: "sent", sent_at: new Date().toISOString(),
      });
    }
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