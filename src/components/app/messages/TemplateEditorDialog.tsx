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
import { ChevronLeft, ChevronRight, ChevronDown, Save, SendHorizontal, Trash2, Plus, CloudUpload } from "lucide-react";
import {
  TEMPLATE_CATEGORIES, META_STATUS_LABEL, VARIABLE_SUGGESTIONS,
  extractVariables, type MessageTemplate, type TemplateKind, type MetaStatus,
  type TemplateVariant, VARIANT_LABEL,
} from "@/lib/templates";
import { WhatsAppPreview } from "./WhatsAppPreview";
import { SegmentFiltersForm } from "@/components/app/SegmentFilters";
import {
  AudienceType, SegmentFilters, TargetingMode, emptyFilters,
} from "@/lib/segments";
import { useFolders } from "@/hooks/useFolders";
import { useAuth as _u } from "@/lib/auth";
import type { InstitutionWhatsAppSettings } from "@/lib/branding";
import { computeFooterCompatibility } from "@/lib/branding";
import { SEMANTIC_VARIABLES, semanticToPositional, renderWithExamples } from "@/lib/metaVariables";
void _u;

type HeaderType = "none" | "text" | "image" | "video" | "document";
type WizardButton =
  | { type: "quick_reply"; text: string }
  | { type: "url"; text: string; url: string }
  | { type: "phone_number"; text: string; phone_number: string }
  | { type: "copy_code"; text: string; example: string };

type Form = {
  name: string;
  description: string;
  category: string;
  body_patient: string;
  body_contact: string;
  body_segment: string;
  template_kind: TemplateKind;
  meta_template_name: string;
  meta_language: string;
  meta_category: string;
  meta_status: MetaStatus;
  meta_footer_source: "none" | "institution_default" | "custom" | "meta_synced";
  meta_footer_text: string;
  meta_header_type: HeaderType;
  meta_header_text: string;
  meta_header_media_url: string;
  meta_buttons: WizardButton[];
  targeting_mode: TargetingMode;
  audience_types: AudienceType[];
  filters: SegmentFilters;
};

const emptyForm = (): Form => ({
  name: "",
  description: "",
  category: "geral",
  body_patient: "",
  body_contact: "",
  body_segment: "",
  template_kind: "internal",
  meta_template_name: "",
  meta_language: "pt_BR",
  meta_category: "UTILITY",
  meta_status: "not_submitted",
  meta_footer_source: "institution_default",
  meta_footer_text: "",
  meta_header_type: "none",
  meta_header_text: "",
  meta_header_media_url: "",
  meta_buttons: [],
  targeting_mode: "all",
  audience_types: ["paciente"],
  filters: emptyFilters(),
});

const ALL_STEPS = [
  "Básico",
  "Config. Meta",
  "Cabeçalho",
  "Mensagem",
  "Rodapé",
  "Botões",
  "Segmentação",
  "Revisão",
] as const;
const INTERNAL_STEPS = ["Básico", "Mensagem", "Rodapé", "Segmentação", "Revisão"] as const;

export function TemplateEditorDialog({
  open,
  onOpenChange,
  editing,
  onSavedUse,
  defaultCategory,
  parentTemplate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: MessageTemplate | null;
  /** Called with the newly saved template id when the user clicks "Salvar e usar agora". */
  onSavedUse?: (template: MessageTemplate) => void;
  /** Pre-selected category when creating a new template (ignored when editing). */
  defaultCategory?: string;
  /** When provided, the new template will be saved as a new version of this one. */
  parentTemplate?: MessageTemplate | null;
}) {
  const { categories: folderCategories } = useFolders();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [submittingMeta, setSubmittingMeta] = useState(false);
  const [institution, setInstitution] = useState("");
  const [activeVariant, setActiveVariant] = useState<TemplateVariant>("patient");
  const [brandingSettings, setBrandingSettings] = useState<InstitutionWhatsAppSettings | null>(null);

  const steps = form.template_kind === "meta" ? ALL_STEPS : INTERNAL_STEPS;

  useEffect(() => {
    if (user) {
      supabase.from("profiles").select("institution").eq("id", user.id).maybeSingle()
        .then(({ data }) => setInstitution(data?.institution ?? ""));
    }
  }, [user]);

  useEffect(() => {
    if (!institution) return;
    supabase
      .from("institution_whatsapp_settings" as any)
      .select("*")
      .eq("institution", institution)
      .maybeSingle()
      .then(({ data }) => setBrandingSettings(((data as unknown) as InstitutionWhatsAppSettings | null) ?? null));
  }, [institution]);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    const source = editing ?? parentTemplate ?? null;
    if (source) {
      setForm({
        name: parentTemplate && !editing ? `${source.name} (nova versão)` : source.name,
        description: source.description ?? "",
        category: source.category,
        body_patient: source.body_patient ?? source.body ?? "",
        body_contact: source.body_contact ?? "",
        body_segment: source.body_segment ?? "",
        template_kind: source.template_kind,
        meta_template_name: source.meta_template_name ?? "",
        meta_language: source.meta_language ?? "pt_BR",
        meta_category: source.meta_category ?? "UTILITY",
        meta_status: parentTemplate && !editing ? "not_submitted" : source.meta_status,
        meta_footer_source: (source.meta_footer_source as Form["meta_footer_source"]) ?? "institution_default",
        meta_footer_text: source.meta_footer_text ?? "",
        meta_header_type: (((source as any).meta_header_type as HeaderType) ?? "none"),
        meta_header_text: ((source as any).meta_header_text as string) ?? "",
        meta_header_media_url: "",
        meta_buttons: Array.isArray((source as any).meta_buttons) ? (source as any).meta_buttons : [],
        targeting_mode: source.targeting_mode ?? "all",
        audience_types: (source.audience_types as AudienceType[]) ?? ["paciente"],
        filters: (source.filters as SegmentFilters) ?? emptyFilters(),
      });
    } else {
      setForm({ ...emptyForm(), category: defaultCategory ?? "geral" });
    }
    setActiveVariant("patient");
  }, [open, editing, defaultCategory, parentTemplate]);

  const currentBody =
    activeVariant === "patient" ? form.body_patient :
    activeVariant === "contact" ? form.body_contact :
    form.body_segment;

  const variables = useMemo(
    () => extractVariables(
      `${form.body_patient}\n${form.body_contact}\n${form.body_segment}`,
    ),
    [form.body_patient, form.body_contact, form.body_segment],
  );

  const insertVar = (key: string) => {
    const field =
      activeVariant === "patient" ? "body_patient" :
      activeVariant === "contact" ? "body_contact" : "body_segment";
    setForm((f) => {
      const cur = (f as any)[field] as string;
      const next = `${cur}${cur.endsWith(" ") || !cur ? "" : " "}{${key}}`;
      return { ...f, [field]: next } as Form;
    });
  };

  const stepValid = (i: number): boolean => {
    const label = steps[i];
    if (label === "Básico") return form.name.trim().length > 1 && !!form.category;
    if (label === "Config. Meta") return !!form.meta_template_name.trim() && !!form.meta_language && !!form.meta_category;
    if (label === "Cabeçalho") {
      if (form.meta_header_type === "none") return true;
      if (form.meta_header_type === "text") return form.meta_header_text.trim().length > 0;
      return true; // media url is optional sample
    }
    if (label === "Mensagem") return form.body_patient.trim().length >= 3;
    if (label === "Botões") {
      for (const b of form.meta_buttons) {
        if (!b.text.trim()) return false;
        if (b.type === "url" && !/^https?:\/\//i.test(b.url)) return false;
        if (b.type === "phone_number" && !b.phone_number.trim()) return false;
      }
      return form.meta_buttons.length <= 10;
    }
    return true;
  };

  const save = async (alsoUse: boolean) => {
    const basicIdx = steps.indexOf("Básico" as any);
    const msgIdx = steps.indexOf("Mensagem" as any);
    if (!stepValid(basicIdx)) return toast.error("Informe nome e categoria");
    if (!stepValid(msgIdx)) return toast.error("Preencha pelo menos a variante 'Paciente'");
    setSaving(true);
    // Fallback: variantes vazias herdam o texto do paciente
    const bodyPatient = form.body_patient.trim();
    const bodyContact = form.body_contact.trim() || bodyPatient;
    const bodySegment = form.body_segment.trim() || bodyPatient;
    const { order: bodyOrder } = semanticToPositional(bodyPatient);
    const headerOrder = form.meta_header_type === "text"
      ? semanticToPositional(form.meta_header_text).order
      : [];
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      description: form.description.trim(),
      category: form.category,
      body: bodyPatient,
      body_patient: bodyPatient,
      body_contact: bodyContact,
      body_segment: bodySegment,
      variables,
      template_kind: form.template_kind,
      meta_template_name: form.template_kind === "meta" ? form.meta_template_name.trim() : null,
      meta_language: form.meta_language,
      meta_category: form.template_kind === "meta" ? form.meta_category : null,
      meta_status: form.template_kind === "meta" ? form.meta_status : "not_submitted",
      meta_footer_source: form.meta_footer_source,
      meta_footer_text:
        form.meta_footer_source === "none"
          ? null
          : form.meta_footer_source === "institution_default"
            ? brandingSettings?.default_template_footer_text ?? null
            : form.meta_footer_text.trim() || null,
      meta_header_type: form.template_kind === "meta" ? form.meta_header_type : null,
      meta_header_text: form.template_kind === "meta" && form.meta_header_type === "text"
        ? form.meta_header_text.trim() || null : null,
      meta_buttons: form.template_kind === "meta" && form.meta_buttons.length > 0
        ? form.meta_buttons : null,
      meta_body_parameter_order: form.template_kind === "meta" ? bodyOrder : null,
      meta_header_parameter_order: form.template_kind === "meta" && headerOrder.length > 0
        ? headerOrder : null,
      meta_parent_template_id: parentTemplate?.id ?? editing?.meta_parent_template_id ?? null,
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
    toast.success(editing ? "Objetivo atualizado" : "Objetivo criado");
    qc.invalidateQueries({ queryKey: qk.templates });
    onOpenChange(false);
    if (alsoUse && editing) {
      onSavedUse?.(editing);
    }
    void savedId;
  };

  const submitToMeta = async () => {
    if (form.template_kind !== "meta") return;
    const basicIdx = steps.indexOf("Básico" as any);
    const msgIdx = steps.indexOf("Mensagem" as any);
    if (!stepValid(basicIdx) || !stepValid(msgIdx)) {
      return toast.error("Revise os campos básicos e a mensagem antes de submeter.");
    }
    setSubmittingMeta(true);
    try {
      const bodyPatient = form.body_patient.trim();
      const { positional: bodyPos } = semanticToPositional(bodyPatient);
      const components: any[] = [];
      if (form.meta_header_type !== "none") {
        if (form.meta_header_type === "text") {
          const { positional: hp, order: ho } = semanticToPositional(form.meta_header_text);
          components.push({
            type: "HEADER",
            format: "TEXT",
            text: hp,
            ...(ho.length > 0 && {
              example: { header_text: ho.map((k) => SEMANTIC_VARIABLES.find((v) => v.key === k)?.example ?? k) },
            }),
          });
        } else {
          components.push({
            type: "HEADER",
            format: form.meta_header_type.toUpperCase(),
            ...(form.meta_header_media_url && {
              example: { header_handle: [form.meta_header_media_url] },
            }),
          });
        }
      }
      const { order: bodyOrder } = semanticToPositional(bodyPatient);
      components.push({
        type: "BODY",
        text: bodyPos,
        ...(bodyOrder.length > 0 && {
          example: { body_text: [bodyOrder.map((k) => SEMANTIC_VARIABLES.find((v) => v.key === k)?.example ?? k)] },
        }),
      });
      const footerText =
        form.meta_footer_source === "none"
          ? null
          : form.meta_footer_source === "institution_default"
            ? brandingSettings?.default_template_footer_text ?? null
            : form.meta_footer_text.trim() || null;
      if (footerText) components.push({ type: "FOOTER", text: footerText });
      if (form.meta_buttons.length > 0) {
        components.push({
          type: "BUTTONS",
          buttons: form.meta_buttons.map((b) => {
            if (b.type === "url") return { type: "URL", text: b.text, url: b.url };
            if (b.type === "phone_number") return { type: "PHONE_NUMBER", text: b.text, phone_number: b.phone_number };
            if (b.type === "copy_code") return { type: "COPY_CODE", text: b.text, example: [b.example || "ABC123"] };
            return { type: "QUICK_REPLY", text: b.text };
          }),
        });
      }
      const { data, error } = await supabase.functions.invoke("create-whatsapp-template", {
        body: {
          name: form.meta_template_name.trim(),
          language: form.meta_language,
          category: form.meta_category,
          components,
          parent_template_id: parentTemplate?.id ?? editing?.meta_parent_template_id ?? null,
          local_template_id: editing?.id ?? null,
          institution,
        },
      });
      if (error) throw new Error(error.message);
      if (!(data as any)?.ok) {
        throw new Error((data as any)?.error ?? "Falha ao submeter à Meta");
      }
      toast.success(`Template enviado à Meta (status: ${(data as any).meta_status})`);
      qc.invalidateQueries({ queryKey: qk.templates });
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao submeter");
    } finally {
      setSubmittingMeta(false);
    }
  };

  const currentStepLabel = steps[step];
  const previewBody = form.body_patient || form.body_contact || form.body_segment;
  const previewExamples = Object.fromEntries(
    SEMANTIC_VARIABLES.map((v) => [v.key, v.example]),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing
              ? "Editar objetivo"
              : parentTemplate
                ? `Nova versão de "${parentTemplate.name}"`
                : "Novo objetivo de mensagem"}
          </DialogTitle>
        </DialogHeader>

        <Stepper step={step} labels={steps as unknown as string[]} />

        {currentStepLabel === "Básico" && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome do objetivo</Label>
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
                    {folderCategories.map((c) => (
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
              <Label>Tipo de objetivo</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                <KindOption
                  selected={form.template_kind === "internal"}
                  title="Objetivo interno"
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
              {form.template_kind === "meta" && (
                <p className="text-[11px] text-muted-foreground">
                  Templates Meta usam um único texto aprovado — apenas a variante <b>Paciente</b> será considerada.
                </p>
              )}
            </div>
          </div>
        )}

        {currentStepLabel === "Config. Meta" && (
          <div className="space-y-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
            <div className="space-y-1.5">
              <Label>Nome do template na Meta</Label>
              <Input
                value={form.meta_template_name}
                onChange={(e) => setForm({ ...form, meta_template_name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })}
                placeholder="ex: confirmacao_consulta"
              />
              <p className="text-[11px] text-muted-foreground">Apenas minúsculas, números e underscore.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Idioma</Label>
                <Select value={form.meta_language} onValueChange={(v) => setForm({ ...form, meta_language: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pt_BR">Português (BR)</SelectItem>
                    <SelectItem value="en_US">Inglês (US)</SelectItem>
                    <SelectItem value="es_ES">Espanhol (ES)</SelectItem>
                  </SelectContent>
                </Select>
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
              <div className="space-y-1.5">
                <Label>Status local</Label>
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

        {currentStepLabel === "Cabeçalho" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Cabeçalho opcional do template. Use texto curto (até 60 caracteres) ou mídia.
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {(["none", "text", "image", "video", "document"] as HeaderType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm({ ...form, meta_header_type: t })}
                  className={`rounded-md border px-3 py-2 text-xs font-medium capitalize transition-colors ${
                    form.meta_header_type === t
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {t === "none" ? "Sem cabeçalho" : t}
                </button>
              ))}
            </div>
            {form.meta_header_type === "text" && (
              <div className="space-y-1.5">
                <Label>Texto do cabeçalho</Label>
                <Input
                  value={form.meta_header_text}
                  maxLength={60}
                  onChange={(e) => setForm({ ...form, meta_header_text: e.target.value })}
                  placeholder="Ex: Confirmação de consulta"
                />
                <p className="text-right text-[11px] text-muted-foreground">{form.meta_header_text.length}/60</p>
              </div>
            )}
            {form.meta_header_type !== "none" && form.meta_header_type !== "text" && (
              <div className="space-y-1.5">
                <Label>URL de exemplo (handle de mídia para aprovação)</Label>
                <Input
                  value={form.meta_header_media_url}
                  onChange={(e) => setForm({ ...form, meta_header_media_url: e.target.value })}
                  placeholder="https://..."
                />
                <p className="text-[11px] text-muted-foreground">
                  Em produção, faça upload com a função <code>upload-whatsapp-media</code> e cole o handle aqui.
                </p>
              </div>
            )}
          </div>
        )}

        {currentStepLabel === "Mensagem" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase">Variante por destinatário</Label>
                <div className="inline-flex rounded-full border border-border bg-card p-1 text-xs">
                  {(["patient", "contact", "segment"] as TemplateVariant[]).map((v) => {
                    const disabled = form.template_kind === "meta" && v !== "patient";
                    return (
                      <button
                        key={v}
                        type="button"
                        disabled={disabled}
                        onClick={() => setActiveVariant(v)}
                        className={`rounded-full px-3 py-1.5 font-medium transition-colors ${
                          activeVariant === v
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
                      >
                        {VARIANT_LABEL[v]}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Cada variante define o texto enviado conforme o destinatário escolhido. As variantes em branco herdam o texto do paciente.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Mensagem — {VARIANT_LABEL[activeVariant]}</Label>
                <Textarea
                  rows={8}
                  value={currentBody}
                  onChange={(e) => {
                    const field =
                      activeVariant === "patient" ? "body_patient" :
                      activeVariant === "contact" ? "body_contact" : "body_segment";
                    setForm({ ...form, [field]: e.target.value } as Form);
                  }}
                  placeholder={
                    activeVariant === "patient"
                      ? "Olá, {nome_paciente}. Lembramos que você tem uma consulta em {data_consulta}..."
                      : activeVariant === "contact"
                        ? "Olá, {nome_contato}. {nome_paciente} tem uma consulta em {data_consulta}..."
                        : "Olá, {nome_destinatario}. Aviso coletivo: ..."
                  }
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
              <WhatsAppPreview
                body={currentBody}
                recipientName={VARIANT_LABEL[activeVariant]}
                header={form.template_kind === "meta" && form.meta_header_type === "text" ? form.meta_header_text : undefined}
                buttons={form.template_kind === "meta" && form.meta_buttons.length > 0
                  ? form.meta_buttons.map((b) => ({ type: b.type, text: b.text } as any)) : undefined}
                resolveExamples
                variableValues={previewExamples}
              />
            </div>
          </div>
        )}

        {currentStepLabel === "Rodapé" && (
          <FooterStep
            form={form}
            setForm={setForm}
            branding={brandingSettings}
          />
        )}

        {currentStepLabel === "Botões" && (
          <ButtonsStep form={form} setForm={setForm} />
        )}

        {currentStepLabel === "Segmentação" && (
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

        {currentStepLabel === "Revisão" && (
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2 text-sm">
                <h4 className="font-semibold text-brand">Revisão</h4>
                <p><span className="text-muted-foreground">Nome:</span> {form.name}</p>
                <p><span className="text-muted-foreground">Pasta:</span> {TEMPLATE_CATEGORIES.find(c => c.value === form.category)?.label ?? form.category}</p>
                <p>
                  <span className="text-muted-foreground">Tipo:</span>{" "}
                  {form.template_kind === "meta" ? "Template Meta" : "Objetivo interno"}
                </p>
                {form.template_kind === "meta" && (
                  <>
                    <p className="text-xs"><span className="text-muted-foreground">Meta:</span> {form.meta_template_name} • {form.meta_language} • {form.meta_category}</p>
                    <p className="text-xs"><span className="text-muted-foreground">Cabeçalho:</span> {form.meta_header_type === "none" ? "—" : form.meta_header_type}</p>
                    <p className="text-xs"><span className="text-muted-foreground">Botões:</span> {form.meta_buttons.length || "—"}</p>
                    {parentTemplate && (
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        ⚠ Será criado como nova versão de "{parentTemplate.name}".
                      </p>
                    )}
                  </>
                )}
                <p className="text-muted-foreground text-xs pt-2">Variantes preenchidas:</p>
                <ul className="text-xs space-y-0.5">
                  <li>• Paciente: {form.body_patient.trim() ? "✓" : "—"}</li>
                  <li>• Familiar/Cuidador: {form.body_contact.trim() ? "✓" : "herda do paciente"}</li>
                  <li>• Segmento: {form.body_segment.trim() ? "✓" : "herda do paciente"}</li>
                </ul>
                <p className="text-xs">
                  <span className="text-muted-foreground">Rodapé:</span>{" "}
                  {form.meta_footer_source === "none"
                    ? "Sem rodapé"
                    : form.meta_footer_source === "institution_default"
                      ? `Padrão da instituição (${brandingSettings?.default_template_footer_text ?? "não configurado"})`
                      : form.meta_footer_source === "meta_synced"
                        ? `Sincronizado da Meta (${form.meta_footer_text || "—"})`
                        : `Personalizado (${form.meta_footer_text || "—"})`}
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
              <WhatsAppPreview
                body={previewBody}
                recipientName={form.name || "Paciente"}
                messageType={form.template_kind === "meta" ? "template" : "text"}
                templateStatus={form.template_kind === "meta" ? META_STATUS_LABEL[form.meta_status] : undefined}
                header={form.template_kind === "meta" && form.meta_header_type === "text" ? form.meta_header_text : undefined}
                buttons={form.template_kind === "meta" && form.meta_buttons.length > 0
                  ? form.meta_buttons.map((b) => ({ type: b.type, text: b.text } as any)) : undefined}
                resolveExamples
                variableValues={previewExamples}
                footer={
                  form.meta_footer_source === "none"
                    ? null
                    : form.meta_footer_source === "institution_default"
                      ? brandingSettings?.default_template_footer_text ?? null
                      : form.meta_footer_text || null
                }
              />
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
            {step < steps.length - 1 ? (
              <Button
                variant="hero"
                onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
                disabled={!stepValid(step)}
              >
                Avançar <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => save(false)} disabled={saving || submittingMeta}>
                  <Save className="h-4 w-4" /> Salvar objetivo
                </Button>
                {form.template_kind === "meta" && (
                  <Button variant="default" onClick={submitToMeta} disabled={saving || submittingMeta}>
                    <CloudUpload className="h-4 w-4" />
                    {submittingMeta ? "Enviando..." : parentTemplate ? "Submeter nova versão" : "Submeter à Meta"}
                  </Button>
                )}
                {!editing && (
                  <Button variant="hero" onClick={() => save(true)} disabled={saving || submittingMeta}>
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

function Stepper({ step, labels }: { step: number; labels: string[] }) {
  return (
    <ol className="flex flex-wrap items-center gap-2 pb-2">
      {labels.map((label, i) => {
        const active = i === step;
        const done = i < step;
        return (
          <li key={label} className="flex min-w-[100px] flex-1 items-center gap-1.5">
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
              className={`text-[11px] font-medium truncate ${
                active ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {label}
            </span>
            {i < labels.length - 1 && <div className="ml-1 h-px flex-1 bg-border" />}
          </li>
        );
      })}
    </ol>
  );
}

function ButtonsStep({ form, setForm }: { form: Form; setForm: (f: Form) => void }) {
  const add = (type: WizardButton["type"]) => {
    if (form.meta_buttons.length >= 10) return;
    const base: WizardButton =
      type === "quick_reply" ? { type, text: "" } :
      type === "url" ? { type, text: "", url: "https://" } :
      type === "phone_number" ? { type, text: "", phone_number: "" } :
      { type: "copy_code", text: "Copiar código", example: "ABC123" };
    setForm({ ...form, meta_buttons: [...form.meta_buttons, base] });
  };
  const update = (i: number, patch: Partial<WizardButton>) => {
    const next = form.meta_buttons.slice();
    next[i] = { ...next[i], ...(patch as any) } as WizardButton;
    setForm({ ...form, meta_buttons: next });
  };
  const remove = (i: number) => {
    setForm({ ...form, meta_buttons: form.meta_buttons.filter((_, idx) => idx !== i) });
  };
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Adicione até 10 botões. URLs precisam começar com <code>https://</code>.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => add("quick_reply")}>
          <Plus className="h-3.5 w-3.5" /> Quick reply
        </Button>
        <Button size="sm" variant="outline" onClick={() => add("url")}>
          <Plus className="h-3.5 w-3.5" /> URL
        </Button>
        <Button size="sm" variant="outline" onClick={() => add("phone_number")}>
          <Plus className="h-3.5 w-3.5" /> Telefone
        </Button>
        <Button size="sm" variant="outline" onClick={() => add("copy_code")}>
          <Plus className="h-3.5 w-3.5" /> Copy code
        </Button>
      </div>
      <div className="space-y-2">
        {form.meta_buttons.length === 0 && (
          <p className="text-xs text-muted-foreground italic">Nenhum botão adicionado.</p>
        )}
        {form.meta_buttons.map((b, i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Badge variant="secondary" className="text-[10px] uppercase">{b.type}</Badge>
              <Button size="icon" variant="ghost" onClick={() => remove(i)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Rótulo do botão (máx 25)</Label>
                <Input
                  value={b.text}
                  maxLength={25}
                  onChange={(e) => update(i, { text: e.target.value })}
                />
              </div>
              {b.type === "url" && (
                <div className="space-y-1">
                  <Label className="text-xs">URL</Label>
                  <Input
                    value={(b as any).url}
                    onChange={(e) => update(i, { url: e.target.value } as any)}
                    placeholder="https://..."
                  />
                </div>
              )}
              {b.type === "phone_number" && (
                <div className="space-y-1">
                  <Label className="text-xs">Telefone (E.164)</Label>
                  <Input
                    value={(b as any).phone_number}
                    onChange={(e) => update(i, { phone_number: e.target.value } as any)}
                    placeholder="+5581999990000"
                  />
                </div>
              )}
              {b.type === "copy_code" && (
                <div className="space-y-1">
                  <Label className="text-xs">Exemplo do código</Label>
                  <Input
                    value={(b as any).example}
                    onChange={(e) => update(i, { example: e.target.value } as any)}
                    placeholder="ABC123"
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
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

function FooterStep({
  form,
  setForm,
  branding,
}: {
  form: Form;
  setForm: (f: Form) => void;
  branding: InstitutionWhatsAppSettings | null;
}) {
  const institutionDefault = (branding?.default_template_footer_text ?? "").trim();
  const compat = computeFooterCompatibility(
    form.meta_footer_source === "custom" || form.meta_footer_source === "meta_synced"
      ? form.meta_footer_text
      : form.meta_footer_source === "institution_default"
        ? institutionDefault
        : "",
    branding,
  );
  const options = [
    { v: "none", label: "Sem rodapé", desc: "Nada é exibido abaixo da mensagem." },
    {
      v: "institution_default",
      label: "Padrão da instituição",
      desc: institutionDefault
        ? `"${institutionDefault}" — definido em Configurações > WhatsApp.`
        : "Configure o padrão na aba Identidade e assinatura.",
    },
    { v: "custom", label: "Personalizado", desc: "Você escreve um rodapé específico (até 60 caracteres)." },
    {
      v: "meta_synced",
      label: "Sincronizado da Meta",
      desc: "Use o rodapé exatamente como foi aprovado na Meta. Edite criando uma nova versão.",
    },
  ] as const;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        O rodapé aparece em texto menor abaixo da mensagem. Para Templates Meta ele faz parte
        da definição aprovada e não pode ser alterado em runtime.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((opt) => (
          <button
            key={opt.v}
            type="button"
            onClick={() => setForm({ ...form, meta_footer_source: opt.v })}
            className={`text-left rounded-lg border-2 p-3 transition-colors ${
              form.meta_footer_source === opt.v
                ? "border-primary bg-primary/5"
                : "border-border bg-card hover:bg-muted/50"
            }`}
          >
            <div className="font-semibold text-sm text-brand">{opt.label}</div>
            <p className="mt-1 text-xs text-muted-foreground">{opt.desc}</p>
          </button>
        ))}
      </div>

      {(form.meta_footer_source === "custom" || form.meta_footer_source === "meta_synced") && (
        <div className="space-y-1.5">
          <Label>Texto do rodapé</Label>
          <Input
            value={form.meta_footer_text}
            maxLength={60}
            onChange={(e) => setForm({ ...form, meta_footer_text: e.target.value })}
            placeholder="Ex: Mensagem oficial do Hospital Central"
          />
          <p className="text-right text-[11px] text-muted-foreground">
            {form.meta_footer_text.length}/60
          </p>
        </div>
      )}

      {form.template_kind === "meta" && (
        <div
          className={`rounded-lg border p-3 text-xs ${
            compat === "differs_from_institution_default"
              ? "border-amber-500/40 bg-amber-500/5 text-amber-900 dark:text-amber-200"
              : "border-border bg-muted/30 text-muted-foreground"
          }`}
        >
          {compat === "matches_institution_default" &&
            "✓ Rodapé idêntico ao padrão configurado para a instituição."}
          {compat === "differs_from_institution_default" &&
            "⚠ Este rodapé difere do padrão da instituição. Para conciliá-los, será necessário criar uma nova versão na Meta."}
          {compat === "no_local_footer" &&
            "Nenhum rodapé local. O envio usará o padrão da instituição quando aplicável."}
          {compat === "no_institution_default" &&
            "Sem padrão institucional configurado — configure em Configurações > WhatsApp."}
        </div>
      )}
    </div>
  );
}