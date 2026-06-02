import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fetchers, qk } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Search, Copy, Archive, Trash2, ArchiveRestore, AlertTriangle } from "lucide-react";
import {
  TEMPLATE_CATEGORIES, META_STATUS_LABEL, extractVariables, renderTemplate,
  type MessageTemplate, type TemplateKind, type MetaStatus,
} from "@/lib/templates";

type Form = {
  name: string;
  description: string;
  category: string;
  body: string;
  template_kind: TemplateKind;
  meta_template_name: string;
  meta_language: string;
  meta_category: string;
  meta_status: MetaStatus;
};

const emptyForm = (): Form => ({
  name: "",
  description: "",
  category: "geral",
  body: "",
  template_kind: "internal",
  meta_template_name: "",
  meta_language: "pt_BR",
  meta_category: "UTILITY",
  meta_status: "not_submitted",
});

export default function TemplatesTab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: templates = [] } = useQuery<MessageTemplate[]>({
    queryKey: qk.templates,
    queryFn: fetchers.templates as () => Promise<MessageTemplate[]>,
  });

  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState("todos");
  const [kindFilter, setKindFilter] = useState("todos");
  const [showArchived, setShowArchived] = useState(false);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MessageTemplate | null>(null);
  const [form, setForm] = useState<Form>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [institution, setInstitution] = useState("");

  useEffect(() => {
    if (user) {
      supabase.from("profiles").select("institution").eq("id", user.id).maybeSingle()
        .then(({ data }) => setInstitution(data?.institution ?? ""));
    }
  }, [user]);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        name: editing.name,
        description: editing.description ?? "",
        category: editing.category,
        body: editing.body,
        template_kind: editing.template_kind,
        meta_template_name: editing.meta_template_name ?? "",
        meta_language: editing.meta_language ?? "pt_BR",
        meta_category: editing.meta_category ?? "UTILITY",
        meta_status: editing.meta_status,
      });
    } else {
      setForm(emptyForm());
    }
  }, [open, editing]);

  const variables = useMemo(() => extractVariables(form.body), [form.body]);
  const preview = useMemo(() => {
    const sample: Record<string, string> = {};
    variables.forEach((v) => (sample[v] = `[${v}]`));
    return renderTemplate(form.body, sample);
  }, [form.body, variables]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return templates.filter((t) => {
      if (!showArchived && !t.is_active) return false;
      if (catFilter !== "todos" && t.category !== catFilter) return false;
      if (kindFilter !== "todos" && t.template_kind !== kindFilter) return false;
      if (!term) return true;
      return (
        t.name.toLowerCase().includes(term) ||
        t.body.toLowerCase().includes(term) ||
        (t.description ?? "").toLowerCase().includes(term)
      );
    });
  }, [templates, q, catFilter, kindFilter, showArchived]);

  const save = async () => {
    if (!form.name.trim()) return toast.error("Nome obrigatório");
    if (form.body.trim().length < 3) return toast.error("Mensagem muito curta");
    if (form.template_kind === "meta" && !form.meta_template_name.trim()) {
      return toast.error("Informe o nome do template aprovado pela Meta");
    }
    setSaving(true);
    const payload: any = {
      name: form.name.trim(),
      description: form.description.trim(),
      category: form.category,
      body: form.body,
      variables,
      template_kind: form.template_kind,
      meta_template_name: form.template_kind === "meta" ? form.meta_template_name.trim() : null,
      meta_language: form.meta_language,
      meta_category: form.template_kind === "meta" ? form.meta_category : null,
      meta_status: form.template_kind === "meta" ? form.meta_status : "not_submitted",
      channel: "whatsapp",
    };
    let error;
    if (editing) {
      ({ error } = await supabase.from("message_templates").update(payload).eq("id", editing.id));
    } else {
      payload.created_by = user!.id;
      payload.institution = institution;
      ({ error } = await supabase.from("message_templates").insert(payload));
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Modelo atualizado" : "Modelo criado");
    setOpen(false);
    setEditing(null);
    qc.invalidateQueries({ queryKey: qk.templates });
  };

  const duplicate = async (t: MessageTemplate) => {
    const { error } = await supabase.from("message_templates").insert({
      name: `${t.name} (cópia)`,
      description: t.description,
      category: t.category,
      body: t.body,
      variables: t.variables,
      template_kind: "internal",
      meta_language: t.meta_language,
      channel: "whatsapp",
      created_by: user!.id,
      institution,
    } as any);
    if (error) return toast.error(error.message);
    toast.success("Modelo duplicado");
    qc.invalidateQueries({ queryKey: qk.templates });
  };

  const archive = async (t: MessageTemplate, active: boolean) => {
    const { error } = await supabase
      .from("message_templates")
      .update({ is_active: active })
      .eq("id", t.id);
    if (error) return toast.error(error.message);
    toast.success(active ? "Modelo reativado" : "Modelo arquivado");
    qc.invalidateQueries({ queryKey: qk.templates });
  };

  const remove = async (t: MessageTemplate) => {
    if (!confirm(`Excluir o modelo "${t.name}"?`)) return;
    const { error } = await supabase.from("message_templates").delete().eq("id", t.id);
    if (error) return toast.error(error.message);
    toast.success("Modelo excluído");
    qc.invalidateQueries({ queryKey: qk.templates });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-end gap-3 flex-wrap">
        <Button variant="hero" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="h-4 w-4" /> Novo modelo
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card p-3 grid gap-2 sm:grid-cols-[1fr_180px_180px_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar modelo..." className="pl-9" />
        </div>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas categorias</SelectItem>
            {TEMPLATE_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={kindFilter} onValueChange={setKindFilter}>
          <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            <SelectItem value="internal">Interno</SelectItem>
            <SelectItem value="meta">Meta</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" onClick={() => setShowArchived((v) => !v)}>
          {showArchived ? "Ocultar arquivados" : "Mostrar arquivados"}
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">
          Nenhum modelo encontrado. Crie um novo para padronizar comunicações frequentes.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => (
            <article
              key={t.id}
              className={`flex flex-col rounded-2xl border bg-card p-4 shadow-card ${
                t.is_active ? "border-border" : "border-dashed border-muted-foreground/30 opacity-70"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">
                  {TEMPLATE_CATEGORIES.find((c) => c.value === t.category)?.label ?? t.category}
                </Badge>
                {t.template_kind === "meta" ? (
                  <Badge variant="outline" className="border-emerald-500 text-emerald-600">
                    Meta · {META_STATUS_LABEL[t.meta_status]}
                  </Badge>
                ) : (
                  <Badge variant="outline">Interno</Badge>
                )}
                {!t.is_active && <Badge variant="outline">Arquivado</Badge>}
              </div>
              <h3 className="mt-2 font-display font-bold text-brand line-clamp-1">{t.name}</h3>
              {t.description && (
                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{t.description}</p>
              )}
              <p className="mt-2 text-sm text-foreground/80 line-clamp-3 whitespace-pre-wrap">{t.body}</p>
              {Array.isArray(t.variables) && t.variables.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {t.variables.map((v: string) => (
                    <span key={v} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {`{${v}}`}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-3 flex items-center gap-1 pt-3 border-t border-border">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => { setEditing(t); setOpen(true); }}>
                  Editar
                </Button>
                <Button variant="ghost" size="icon" onClick={() => duplicate(t)} aria-label="Duplicar">
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => archive(t, !t.is_active)} aria-label="Arquivar">
                  {t.is_active ? <Archive className="h-4 w-4" /> : <ArchiveRestore className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => remove(t)} aria-label="Excluir">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar modelo" : "Novo modelo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>Nome</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={form.template_kind} onValueChange={(v) => setForm({ ...form, template_kind: v as TemplateKind })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal">Interno</SelectItem>
                    <SelectItem value="meta">Template Meta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Quando usar este modelo"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Mensagem</Label>
              <Textarea
                rows={6}
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder="Use {nome_paciente}, {medicacao}, {data_consulta} para variáveis..."
              />
              {variables.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  Variáveis detectadas:{" "}
                  {variables.map((v) => (
                    <span key={v} className="font-mono bg-muted px-1 rounded mr-1">{`{${v}}`}</span>
                  ))}
                </div>
              )}
              {preview && (
                <div className="rounded-md border border-border bg-muted/30 p-2 text-xs whitespace-pre-wrap">
                  <span className="font-semibold text-muted-foreground">Preview:</span>
                  <br />
                  {preview}
                </div>
              )}
            </div>

            {form.template_kind === "meta" && (
              <div className="space-y-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                <div className="text-xs text-emerald-700 dark:text-emerald-300">
                  Templates Meta exigem aprovação prévia no WhatsApp Business Manager.
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5 col-span-2">
                    <Label>Nome do template na Meta</Label>
                    <Input
                      value={form.meta_template_name}
                      onChange={(e) => setForm({ ...form, meta_template_name: e.target.value })}
                      placeholder="ex: confirmacao_consulta"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Idioma</Label>
                    <Input
                      value={form.meta_language}
                      onChange={(e) => setForm({ ...form, meta_language: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Categoria Meta</Label>
                    <Select value={form.meta_category} onValueChange={(v) => setForm({ ...form, meta_category: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UTILITY">UTILITY</SelectItem>
                        <SelectItem value="MARKETING">MARKETING</SelectItem>
                        <SelectItem value="AUTHENTICATION">AUTHENTICATION</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <Label>Status na Meta</Label>
                    <Select value={form.meta_status} onValueChange={(v) => setForm({ ...form, meta_status: v as MetaStatus })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(META_STATUS_LABEL) as MetaStatus[]).map((s) => (
                          <SelectItem key={s} value={s}>{META_STATUS_LABEL[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="hero" onClick={save} disabled={saving}>
              {saving ? "Salvando..." : editing ? "Salvar" : "Criar modelo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
