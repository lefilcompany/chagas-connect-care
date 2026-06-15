import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { qk } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, ChevronDown, Save, SendHorizontal } from "lucide-react";
import {
  TEMPLATE_CATEGORIES, META_STATUS_LABEL, VARIABLE_SUGGESTIONS,
  extractVariables, type MessageTemplate, type TemplateKind, type MetaStatus,
} from "@/lib/templates";
import { WhatsAppPreview } from "./WhatsAppPreview";
import { SegmentFiltersForm } from "@/components/app/SegmentFilters";
import {
  AudienceType, SegmentFilters, TargetingMode, emptyFilters,
} from "@/lib/segments";

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
  targeting_mode: TargetingMode;
  audience_types: AudienceType[];
  filters: SegmentFilters;
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
  targeting_mode: "all",
  audience_types: ["paciente"],
  filters: emptyFilters(),
});

const STEPS = ["Básico", "Mensagem", "Segmentação", "Salvar"] as const;

export function TemplateEditorDialog({
  open,
  onOpenChange,
  editing,
  onSavedUse,
  defaultCategory,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: MessageTemplate | null;
  /** Called with the newly saved template id when the user clicks "Salvar e usar agora". */
  onSavedUse?: (template: MessageTemplate) => void;
  /** Pre-selected category when creating a new template (ignored when editing). */
  defaultCategory?: string;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
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
    setStep(0);
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
        targeting_mode: editing.targeting_mode ?? "all",
        audience_types: (editing.audience_types as AudienceType[]) ?? ["paciente"],
        filters: (editing.filters as SegmentFilters) ?? emptyFilters(),
      });
    } else {
      setForm({ ...emptyForm(), category: defaultCategory ?? "geral" });
    }
  }, [open, editing, defaultCategory]);

  const variables = useMemo(() => extractVariables(form.body), [form.body]);

  const insertVar = (key: string) => {
    setForm((f) => ({ ...f, body: `${f.body}${f.body.endsWith(" ") || !f.body ? "" : " "}{${key}}` }));
  };

  const stepValid = (i: number): boolean => {
    if (i === 0) return form.name.trim().length > 1 && !!form.category;
    if (i === 1) {
      if (form.body.trim().length < 3) return false;
      if (form.template_kind === "meta" && !form.meta_template_name.trim()) return false;
      return true;
    }
    return true;
  };

  const save = async (alsoUse: boolean) => {
    if (!stepValid(0)) return toast.error("Informe nome e categoria");
    if (!stepValid(1)) return toast.error("Mensagem incompleta");
    setSaving(true);
    const payload: Record<string, unknown> = {
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
      targeting_mode: form.targeting_mode,
      audience_types: form.audience_types,
      filters: form.filters,
    };
    let savedId: string | null = editing?.id ?? null;
    let error: any = null;
    if (editing) {
      ({ error } = await supabase.from("message_templates").update(payload as any).eq("id", editing.id));
    } else {
      payload.created_by = user!.id;
      payload.institution = institution;
      const { data, error: e } = await supabase
        .from("message_templates")
        .insert(payload as any)
        .select("*")
        .maybeSingle();
      error = e;
      savedId = (data as any)?.id ?? null;
      if (alsoUse && data) {
        onSavedUse?.(data as unknown as MessageTemplate);
      }
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Modelo atualizado" : "Modelo criado");
    qc.invalidateQueries({ queryKey: qk.templates });
    onOpenChange(false);
    if (alsoUse && editing) {
      onSavedUse?.(editing);
    }
    void savedId;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar modelo" : "Novo modelo de mensagem"}</DialogTitle>
        </DialogHeader>

        <Stepper step={step} />

        {step === 0 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome do modelo</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Lembrete de consulta"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Descrição curta</Label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Quando usar este modelo"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tipo de modelo</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                <KindOption
                  selected={form.template_kind === "internal"}
                  title="Modelo interno"
                  desc="Para organizar textos e enviar em conversas permitidas."
                  onClick={() => setForm({ ...form, template_kind: "internal" })}
                />
                <KindOption
                  selected={form.template_kind === "meta"}
                  title="Template Meta"
                  desc="Use quando este texto já estiver aprovado na Meta para iniciar conversas."
                  onClick={() => setForm({ ...form, template_kind: "meta" })}
                />
              </div>
            </div>

            {form.template_kind === "meta" && (
              <Collapsible defaultOpen>
                <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm font-medium">
                  <span>Configurações da Meta</span>
                  <ChevronDown className="h-4 w-4" />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                  <div className="space-y-1.5">
                    <Label>Nome do template na Meta</Label>
                    <Input
                      value={form.meta_template_name}
                      onChange={(e) => setForm({ ...form, meta_template_name: e.target.value })}
                      placeholder="ex: confirmacao_consulta"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Idioma</Label>
                      <Input
                        value={form.meta_language}
                        onChange={(e) => setForm({ ...form, meta_language: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Status</Label>
                      <Select
                        value={form.meta_status}
                        onValueChange={(v) => setForm({ ...form, meta_status: v as MetaStatus })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(Object.keys(META_STATUS_LABEL) as MetaStatus[]).map((s) => (
                            <SelectItem key={s} value={s}>{META_STATUS_LABEL[s]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Mensagem</Label>
                <Textarea
                  rows={8}
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  placeholder="Olá, {nome_destinatario}. Lembramos que você tem uma consulta em {data_consulta}..."
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase">Variáveis sugeridas (clique para inserir)</Label>
                <div className="flex flex-wrap gap-1.5">
                  {VARIABLE_SUGGESTIONS.map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => insertVar(v.key)}
                      className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-mono hover:bg-muted"
                      title={v.hint}
                    >
                      {`{${v.key}}`}
                    </button>
                  ))}
                </div>
                {variables.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    Detectadas:{" "}
                    {variables.map((v) => (
                      <Badge key={v} variant="secondary" className="mr-1 text-[10px] font-mono">
                        {`{${v}}`}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase">Pré-visualização</Label>
              <WhatsAppPreview body={form.body} recipientName="Paciente" />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Opcional: defina um público padrão sugerido sempre que este modelo for usado em envio segmentado.
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { v: "all", label: "Todos" },
                { v: "audiences", label: "Tipos de público" },
                { v: "filters", label: "Filtros personalizados" },
              ].map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setForm({ ...form, targeting_mode: opt.v as TargetingMode })}
                  className={`rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                    form.targeting_mode === opt.v
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {(form.targeting_mode === "audiences" || form.targeting_mode === "filters") && (
              <div className="rounded-lg border border-border bg-card p-3">
                <SegmentFiltersForm
                  filters={form.filters}
                  onFiltersChange={(f) => setForm({ ...form, filters: f })}
                />
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2 text-sm">
                <h4 className="font-semibold text-brand">Revisão</h4>
                <p><span className="text-muted-foreground">Nome:</span> {form.name}</p>
                <p><span className="text-muted-foreground">Categoria:</span> {TEMPLATE_CATEGORIES.find(c => c.value === form.category)?.label}</p>
                <p>
                  <span className="text-muted-foreground">Tipo:</span>{" "}
                  {form.template_kind === "meta" ? "Template Meta" : "Modelo interno"}
                </p>
                {variables.length > 0 && (
                  <p>
                    <span className="text-muted-foreground">Variáveis:</span>{" "}
                    {variables.map((v) => (
                      <Badge key={v} variant="secondary" className="mr-1 text-[10px] font-mono">{`{${v}}`}</Badge>
                    ))}
                  </p>
                )}
              </div>
              <WhatsAppPreview body={form.body} recipientName={form.name || "Paciente"} />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
          <Button
            variant="ghost"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
          >
            <ChevronLeft className="h-4 w-4" /> Voltar
          </Button>
          <div className="flex items-center gap-2">
            {step < STEPS.length - 1 ? (
              <Button
                variant="hero"
                onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
                disabled={!stepValid(step)}
              >
                Avançar <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => save(false)} disabled={saving}>
                  <Save className="h-4 w-4" /> Salvar modelo
                </Button>
                {!editing && (
                  <Button variant="hero" onClick={() => save(true)} disabled={saving}>
                    <SendHorizontal className="h-4 w-4" /> Salvar e usar agora
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <ol className="flex items-center gap-2 pb-2">
      {STEPS.map((label, i) => {
        const active = i === step;
        const done = i < step;
        return (
          <li key={label} className="flex flex-1 items-center gap-2">
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                active
                  ? "bg-primary text-primary-foreground"
                  : done
                    ? "bg-emerald-500 text-white"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {i + 1}
            </div>
            <span
              className={`text-xs font-medium ${
                active ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && <div className="ml-1 h-px flex-1 bg-border" />}
          </li>
        );
      })}
    </ol>
  );
}

function KindOption({
  selected, title, desc, onClick,
}: { selected: boolean; title: string; desc: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-lg border-2 p-3 transition-colors ${
        selected ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted/50"
      }`}
    >
      <div className="font-semibold text-sm text-brand">{title}</div>
      <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
    </button>
  );
}