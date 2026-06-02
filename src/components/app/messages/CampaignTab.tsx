import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fetchers, qk } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Send, AlertTriangle, ChevronLeft, ChevronRight, CheckCircle2,
} from "lucide-react";
import { SegmentFiltersForm } from "@/components/app/SegmentFilters";
import { RecipientPreview } from "@/components/app/RecipientPreview";
import {
  ALL_AUDIENCES, AUDIENCE_LABELS, AudienceType, Recipient, SegmentDef,
  SegmentFilters, TargetingMode, emptyFilters, resolveRecipients,
} from "@/lib/segments";
import {
  extractVariables, renderTemplate, type MessageTemplate,
} from "@/lib/templates";
import { createBatch } from "@/lib/whatsapp";
import { TemplateCard, StartBlankCard } from "./TemplateCard";
import { WhatsAppPreview } from "./WhatsAppPreview";

const STEPS = ["Modelo", "Público", "Destinatários", "Revisar", "Enviar"] as const;

export default function CampaignTab({
  initialTemplateId,
  onConsumeInitial,
}: {
  initialTemplateId?: string | null;
  onConsumeInitial?: () => void;
} = {}) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: templates = [] } = useQuery<MessageTemplate[]>({
    queryKey: qk.templates,
    queryFn: fetchers.templates as () => Promise<MessageTemplate[]>,
  });
  const { data: segments = [] } = useQuery<SegmentDef[]>({
    queryKey: qk.segments,
    queryFn: fetchers.segments as () => Promise<SegmentDef[]>,
  });

  const [step, setStep] = useState(0);
  const [templateId, setTemplateId] = useState<string>("");
  const [freeBody, setFreeBody] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [vars, setVars] = useState<Record<string, string>>({});

  const [mode, setMode] = useState<TargetingMode>("audiences");
  const [aud, setAud] = useState<AudienceType[]>(["paciente"]);
  const [segmentId, setSegmentId] = useState<string | null>(null);
  const [filters, setFilters] = useState<SegmentFilters>(emptyFilters());

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [institution, setInstitution] = useState("");

  useEffect(() => {
    if (user) {
      supabase.from("profiles").select("institution").eq("id", user.id).maybeSingle()
        .then(({ data }) => setInstitution(data?.institution ?? ""));
    }
  }, [user]);

  // Apply preselected template (when navigated from "Usar modelo > Segmento")
  useEffect(() => {
    if (initialTemplateId) {
      setTemplateId(initialTemplateId);
      setStep(1);
      onConsumeInitial?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTemplateId]);

  const activeTemplates = useMemo(
    () => templates.filter((t) => t.is_active),
    [templates],
  );
  const selectedTemplate = useMemo(
    () => activeTemplates.find((t) => t.id === templateId) ?? null,
    [activeTemplates, templateId],
  );

  // When template changes, reset body/vars
  useEffect(() => {
    if (!selectedTemplate) return;
    if (!campaignName) setCampaignName(selectedTemplate.name);
    const detected = extractVariables(selectedTemplate.body);
    setVars((cur) => {
      const next: Record<string, string> = {};
      detected.forEach((v) => (next[v] = cur[v] ?? ""));
      return next;
    });
    // Apply default segmentation from template, if any
    if (selectedTemplate.targeting_mode && selectedTemplate.targeting_mode !== "all") {
      setMode(selectedTemplate.targeting_mode as TargetingMode);
      if (selectedTemplate.audience_types?.length) {
        setAud(selectedTemplate.audience_types as AudienceType[]);
      }
      if (selectedTemplate.filters) setFilters(selectedTemplate.filters as SegmentFilters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  const previewAud = useMemo<AudienceType[]>(() => {
    if (mode === "all") return ALL_AUDIENCES;
    if (mode === "audiences" || mode === "filters") return aud;
    if (mode === "segment") {
      const s = segments.find((x) => x.id === segmentId);
      return (s?.audience_types as AudienceType[]) ?? [];
    }
    return [];
  }, [mode, aud, segmentId, segments]);

  const previewFilters = useMemo<SegmentFilters>(() => {
    if (mode === "filters") return filters;
    if (mode === "segment") {
      const s = segments.find((x) => x.id === segmentId);
      return (s?.filters as SegmentFilters) ?? emptyFilters();
    }
    return emptyFilters();
  }, [mode, filters, segmentId, segments]);

  const { data: recipients = [], isLoading: previewLoading } = useQuery<Recipient[]>({
    queryKey: ["campaign-recipients", previewAud, previewFilters],
    queryFn: () => resolveRecipients(previewAud, previewFilters),
    enabled: previewAud.length > 0 && step >= 2,
  });

  const body = selectedTemplate?.body ?? freeBody;
  const detectedVars = useMemo(() => extractVariables(body), [body]);
  const renderedBody = useMemo(() => renderTemplate(body, vars), [body, vars]);

  const finalRecipients = useMemo(
    () => recipients.filter((r) => selected.has(r.key) && r.phone && r.channel === "whatsapp"),
    [recipients, selected],
  );

  const stepValid = (i: number): boolean => {
    if (i === 0) return !!selectedTemplate || freeBody.trim().length >= 3;
    if (i === 1) return previewAud.length > 0;
    if (i === 2) return finalRecipients.length > 0;
    if (i === 3) return renderedBody.trim().length >= 3;
    return true;
  };

  const handleSend = async () => {
    if (finalRecipients.length === 0) return toast.error("Sem destinatários");
    setSending(true);
    const result = await createBatch({
      name: campaignName.trim() || (selectedTemplate?.name ?? "Campanha"),
      body: renderedBody,
      recipients: finalRecipients,
      template: selectedTemplate
        ? {
            id: selectedTemplate.id,
            body: selectedTemplate.body,
            template_kind: selectedTemplate.template_kind,
            meta_template_name: selectedTemplate.meta_template_name,
          }
        : null,
      variables: vars,
      message_type: selectedTemplate ? "template" : "campaign",
      targeting_mode: mode,
      audience_types: previewAud,
      segment_id: mode === "segment" ? segmentId : null,
      filters: mode === "filters" ? (filters as any) : {},
      institution,
      created_by: user?.id ?? null,
    });
    setSending(false);
    qc.invalidateQueries({ queryKey: qk.messages });
    qc.invalidateQueries({ queryKey: qk.batches });
    if (!result.ok) return toast.error(result.error ?? "Falha ao disparar campanha");
    toast.success(
      `Campanha disparada: ${result.ok_count ?? finalRecipients.length} enviadas` +
        (result.failed_count ? `, ${result.failed_count} falharam` : ""),
    );
    // Reset
    setStep(0);
    setTemplateId("");
    setFreeBody("");
    setCampaignName("");
    setVars({});
    setSelected(new Set());
  };

  return (
    <div className="space-y-5">
      <Stepper step={step} />

      {step === 0 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Escolha um modelo pronto para padronizar a mensagem ou comece em branco.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <StartBlankCard onClick={() => { setTemplateId(""); setStep(1); }} />
            {activeTemplates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => { setTemplateId(t.id); setStep(1); }}
                className={`text-left rounded-2xl transition-all ${
                  templateId === t.id ? "ring-2 ring-primary" : ""
                }`}
              >
                <TemplateCard
                  template={t}
                  onUse={() => { setTemplateId(t.id); setStep(1); }}
                  onEdit={() => { setTemplateId(t.id); setStep(1); }}
                  onDuplicate={() => { setTemplateId(t.id); setStep(1); }}
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          {!selectedTemplate && (
            <div className="space-y-1.5">
              <Label>Mensagem (texto livre)</Label>
              <textarea
                rows={4}
                value={freeBody}
                onChange={(e) => setFreeBody(e.target.value)}
                placeholder="Escreva a mensagem. Use {variavel} para campos dinâmicos."
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Nome da campanha</Label>
            <Input
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="Ex: Lembrete consulta — março"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase">Público</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { v: "all", label: "Todos" },
                { v: "audiences", label: "Tipos de público" },
                { v: "segment", label: "Segmento salvo" },
                { v: "filters", label: "Filtros personalizados" },
              ].map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setMode(opt.v as TargetingMode)}
                  className={`rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                    mode === opt.v
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {mode === "audiences" && (
              <div className="flex flex-wrap gap-2 pt-2">
                {(Object.keys(AUDIENCE_LABELS) as AudienceType[]).map((a) => {
                  const on = aud.includes(a);
                  return (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setAud(on ? aud.filter((x) => x !== a) : [...aud, a])}
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${
                        on
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-muted-foreground"
                      }`}
                    >
                      {AUDIENCE_LABELS[a]}
                    </button>
                  );
                })}
              </div>
            )}

            {mode === "segment" && (
              <Select value={segmentId ?? ""} onValueChange={(v) => setSegmentId(v || null)}>
                <SelectTrigger className="mt-2"><SelectValue placeholder="Selecione um segmento" /></SelectTrigger>
                <SelectContent>
                  {segments.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {mode === "filters" && (
              <div className="mt-3 rounded-lg border border-border bg-card p-3">
                <SegmentFiltersForm
                  audienceTypes={aud}
                  onAudienceChange={setAud}
                  filters={filters}
                  onFiltersChange={setFilters}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Confira a lista de destinatários e remova quem não deve receber.
          </p>
          <RecipientPreview
            recipients={recipients}
            loading={previewLoading}
            selectedKeys={selected}
            onChange={setSelected}
          />
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          {detectedVars.length > 0 && (
            <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
              <Label className="text-xs uppercase">Variáveis</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {detectedVars.map((v) => (
                  <div key={v} className="space-y-1">
                    <Label className="font-mono text-xs">{`{${v}}`}</Label>
                    <Input
                      value={vars[v] ?? ""}
                      onChange={(e) => setVars({ ...vars, [v]: e.target.value })}
                      placeholder={v.replace(/_/g, " ")}
                    />
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Estes valores serão aplicados a todos os destinatários selecionados.
              </p>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2 text-sm">
              <h4 className="font-semibold text-brand">Resumo</h4>
              <p><span className="text-muted-foreground">Campanha:</span> {campaignName || "—"}</p>
              <p><span className="text-muted-foreground">Modelo:</span> {selectedTemplate?.name ?? "Texto livre"}</p>
              <p><span className="text-muted-foreground">Destinatários:</span> {finalRecipients.length}</p>
            </div>
            <WhatsAppPreview body={renderedBody} recipientName="Destinatário" highlightVars={false} />
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-900 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              Cada destinatário receberá uma mensagem individual, registrada no histórico.
              Revise o texto antes de continuar.
            </span>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4 text-center py-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Send className="h-7 w-7" />
          </div>
          <h3 className="font-display text-xl font-bold text-brand">
            Confirmar disparo para {finalRecipients.length} destinatário(s)?
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Ao confirmar, as mensagens entram na fila e são enviadas pelo WhatsApp.
            Você poderá acompanhar o status no Histórico.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-3 border-t border-border">
        <Button
          variant="ghost"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0 || sending}
        >
          <ChevronLeft className="h-4 w-4" /> Voltar
        </Button>
        {step < STEPS.length - 1 ? (
          <Button
            variant="hero"
            onClick={() => setStep((s) => s + 1)}
            disabled={!stepValid(step)}
          >
            Avançar <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="hero" onClick={handleSend} disabled={sending || finalRecipients.length === 0}>
            <CheckCircle2 className="h-4 w-4" />
            {sending ? "Disparando..." : "Confirmar e enviar"}
          </Button>
        )}
      </div>
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <ol className="flex items-center gap-2">
      {STEPS.map((label, i) => {
        const active = i === step;
        const done = i < step;
        return (
          <li key={label} className="flex flex-1 items-center gap-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                active
                  ? "bg-primary text-primary-foreground"
                  : done
                    ? "bg-emerald-500 text-white"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {i + 1}
            </div>
            <span className={`text-xs font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && <div className="ml-1 h-px flex-1 bg-border" />}
          </li>
        );
      })}
    </ol>
  );
}