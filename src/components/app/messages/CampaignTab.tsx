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
import { PatientMultiSelect } from "@/components/app/PatientMultiSelect";
import {
  ALL_AUDIENCES, AUDIENCE_LABELS, AudienceType, Recipient, SegmentDef,
  SegmentFilters, TargetingMode, emptyFilters, resolveRecipients,
} from "@/lib/segments";
import {
  extractVariables, renderTemplate, formatMedications, pickVariantBody,
  type MessageTemplate,
} from "@/lib/templates";
import { createBatch } from "@/lib/whatsapp";
import { TemplateCard, StartBlankCard } from "./TemplateCard";
import { WhatsAppPreview } from "./WhatsAppPreview";

const STEPS = ["Modelo", "Destinatários", "Revisar", "Enviar"] as const;

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
  // Patient restriction is independent of `mode` — always merged into effective filters.
  const [patientIds, setPatientIds] = useState<string[]>([]);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [institution, setInstitution] = useState("");
  const [medicationMode, setMedicationMode] = useState<"all" | "first">("all");

  useEffect(() => {
    if (user) {
      supabase.from("profiles").select("institution").eq("id", user.id).maybeSingle()
        .then(({ data }) => setInstitution(data?.institution ?? ""));
    }
  }, [user]);

  // Realtime: refresh medication-derived state whenever medications change anywhere.
  useEffect(() => {
    const channel = supabase
      .channel("campaign-medications-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "medications" },
        () => {
          qc.invalidateQueries({ queryKey: ["campaign-meds"] });
          qc.invalidateQueries({ queryKey: ["medications"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

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
  // Em disparos segmentados usamos sempre a variante "Segmento" do objetivo.
  const segmentBody = useMemo(
    () => (selectedTemplate ? pickVariantBody(selectedTemplate, "segment") : ""),
    [selectedTemplate],
  );

  // When template changes, reset body/vars
  useEffect(() => {
    if (!selectedTemplate) return;
    if (!campaignName) setCampaignName(selectedTemplate.name);
    const detected = extractVariables(pickVariantBody(selectedTemplate, "segment"));
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
    let base: SegmentFilters;
    if (mode === "filters") base = filters;
    else if (mode === "segment") {
      const s = segments.find((x) => x.id === segmentId);
      base = (s?.filters as SegmentFilters) ?? emptyFilters();
    } else base = emptyFilters();
    if (patientIds.length) {
      const merged = new Set([...(base.patient_ids ?? []), ...patientIds]);
      return { ...base, patient_ids: Array.from(merged) };
    }
    return base;
  }, [mode, filters, segmentId, segments, patientIds]);

  const { data: recipients = [], isLoading: previewLoading } = useQuery<Recipient[]>({
    queryKey: ["campaign-recipients", previewAud, previewFilters],
    queryFn: () => resolveRecipients(previewAud, previewFilters),
    enabled: previewAud.length > 0 && step >= 1,
  });

  const body = selectedTemplate ? segmentBody : freeBody;
  const detectedVars = useMemo(() => extractVariables(body), [body]);
  const AUTO_RECIPIENT_VARS = [
    "nome_destinatario",
    "nome_paciente",
    "nome_contato",
    "medicacao",
    "medicacao_orientacao",
  ] as const;
  const manualVars = useMemo(
    () => detectedVars.filter((v) => !AUTO_RECIPIENT_VARS.includes(v as any)),
    [detectedVars],
  );
  const hasRecipientVar = useMemo(
    () =>
      detectedVars.some((v) =>
        ["nome_destinatario", "nome_paciente", "nome_contato"].includes(v),
      ),
    [detectedVars],
  );
  const usesMedication = useMemo(
    () =>
      detectedVars.includes("medicacao") || detectedVars.includes("medicacao_orientacao"),
    [detectedVars],
  );

  const finalRecipients = useMemo(
    () => recipients.filter((r) => selected.has(r.key) && r.phone && r.channel === "whatsapp"),
    [recipients, selected],
  );

  // Fetch medications for selected patients when the template references medication vars
  const finalPatientIds = useMemo(
    () => Array.from(new Set(finalRecipients.map((r) => r.patient_id))),
    [finalRecipients],
  );
  const { data: medsByPatient = new Map<string, { name: string | null; dose: string | null; schedule: string | null }[]>() } =
    useQuery({
      queryKey: ["campaign-meds", finalPatientIds],
      enabled: usesMedication && finalPatientIds.length > 0 && step >= 2,
      queryFn: async () => {
        const { data } = await supabase
          .from("medications")
          .select("patient_id, name, dose, schedule")
          .in("patient_id", finalPatientIds);
        const map = new Map<string, { name: string | null; dose: string | null; schedule: string | null }[]>();
        for (const m of data ?? []) {
          const list = map.get(m.patient_id as string) ?? [];
          list.push({ name: m.name, dose: m.dose, schedule: m.schedule });
          map.set(m.patient_id as string, list);
        }
        return map;
      },
    });

  // Patients without medications (only relevant when template uses medication vars)
  const patientsWithoutMeds = useMemo(() => {
    if (!usesMedication) return [] as string[];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const r of finalRecipients) {
      if (seen.has(r.patient_id)) continue;
      seen.add(r.patient_id);
      const list = medsByPatient.get(r.patient_id) ?? [];
      if (list.length === 0) out.push(r.patient_name || r.name);
    }
    return out;
  }, [usesMedication, finalRecipients, medsByPatient]);

  // Build a representative preview per audience type present in finalRecipients
  const previewsByAudience = useMemo(() => {
    const order: AudienceType[] = ["paciente", "familiar", "cuidador", "medico"];
    const seen: Partial<Record<AudienceType, Recipient>> = {};
    for (const r of finalRecipients) if (!seen[r.relation]) seen[r.relation] = r;
    return order
      .filter((a) => seen[a])
      .map((a) => {
        const r = seen[a]!;
        const meds = medsByPatient.get(r.patient_id) ?? [];
        const medText = formatMedications(meds, medicationMode);
        const perVars: Record<string, string> = { ...vars };
        const rname = (r.name ?? "").trim() || "Destinatário";
        perVars.nome_destinatario = rname;
        if (!perVars.nome_paciente) perVars.nome_paciente = rname;
        if (!perVars.nome_contato) perVars.nome_contato = rname;
        if (usesMedication) {
          const fallback = medText || "(sem medicação cadastrada)";
          if (!perVars.medicacao) perVars.medicacao = fallback;
          if (!perVars.medicacao_orientacao) perVars.medicacao_orientacao = fallback;
        }
        return {
          audience: a,
          recipient: r,
          body: renderTemplate(body, perVars),
        };
      });
  }, [finalRecipients, medsByPatient, medicationMode, vars, body, usesMedication]);

  // First preview body is used as the "representative" rendered body for the send confirm step
  const renderedBody = previewsByAudience[0]?.body ?? body;

  // Normalize BR phone for preview (mirrors edge function logic)
  const normalizeBR = (raw: string): string | null => {
    const digits = (raw ?? "").replace(/\D/g, "");
    if (!digits) return null;
    let p = digits;
    if (!p.startsWith("55")) p = "55" + p;
    if (p.length < 12 || p.length > 13) return null;
    return p;
  };

  const stepValid = (i: number): boolean => {
    if (i === 0) return !!selectedTemplate || freeBody.trim().length >= 3;
    if (i === 1) return previewAud.length > 0 && finalRecipients.length > 0;
    if (i === 2) {
      if (renderedBody.trim().length < 3) return false;
      // Block advancing if every selected patient lacks meds for a medication template
      if (usesMedication && finalPatientIds.length > 0 && patientsWithoutMeds.length >= finalPatientIds.length) return false;
      return true;
    }
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
            body: segmentBody,
            template_kind: selectedTemplate.template_kind,
            meta_template_name: selectedTemplate.meta_template_name,
          }
        : null,
      variables: vars,
      message_type: selectedTemplate ? "template" : "campaign",
      targeting_mode: mode,
      audience_types: previewAud,
      segment_id: mode === "segment" ? segmentId : null,
      filters: (mode === "filters"
        ? { ...filters, patient_ids: previewFilters.patient_ids ?? [] }
        : patientIds.length
          ? { patient_ids: patientIds }
          : {}) as any,
      created_by: user?.id ?? null,
      medication_mode: medicationMode,
    });
    setSending(false);
    qc.invalidateQueries({ queryKey: qk.messages });
    qc.invalidateQueries({ queryKey: qk.batches });
    if (!result.ok) return toast.error(result.error ?? "Falha ao disparar campanha");
    const sentCount = result.ok_count ?? (finalRecipients.length - (result.skipped_count ?? 0));
    toast.success(
      `Campanha disparada: ${sentCount} enviadas` +
        (result.failed_count ? `, ${result.failed_count} falharam` : "") +
        (result.skipped_count ? `, ${result.skipped_count} pulado(s) por falta de medicação` : ""),
    );
    // Reset
    setStep(0);
    setTemplateId("");
    setFreeBody("");
    setCampaignName("");
    setVars({});
    setSelected(new Set());
    setPatientIds([]);
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
              <div
                key={t.id}
                role="button"
                tabIndex={0}
                onClick={() => { setTemplateId(t.id); setStep(1); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setTemplateId(t.id);
                    setStep(1);
                  }
                }}
                className={`text-left rounded-2xl transition-all cursor-pointer ${
                  templateId === t.id ? "ring-2 ring-primary" : ""
                }`}
              >
                <TemplateCard
                  template={t}
                  onUse={() => { setTemplateId(t.id); setStep(1); }}
                  onEdit={() => { setTemplateId(t.id); setStep(1); }}
                  onDuplicate={() => { setTemplateId(t.id); setStep(1); }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{selectedTemplate ? "Mensagem do modelo" : "Mensagem (texto livre)"}</Label>
              <textarea
                rows={6}
                value={selectedTemplate ? selectedTemplate.body : freeBody}
                onChange={(e) => setFreeBody(e.target.value)}
                readOnly={!!selectedTemplate}
                placeholder="Escreva a mensagem. Use {variavel} para campos dinâmicos."
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-70"
              />
              {selectedTemplate && (
                <p className="text-[11px] text-muted-foreground">
                  Este texto vem do modelo selecionado. Para editá-lo, duplique o modelo na biblioteca.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase">Pré-visualização</Label>
              <WhatsAppPreview
                body={selectedTemplate ? selectedTemplate.body : freeBody}
                recipientName="Destinatário"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Nome da campanha</Label>
            <Input
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="Ex: Lembrete consulta — março"
            />
          </div>

          <div className="space-y-1.5 rounded-lg border border-border bg-muted/30 p-3">
            <Label className="text-xs uppercase">Restringir a pacientes específicos</Label>
            <PatientMultiSelect
              selected={patientIds}
              onChange={setPatientIds}
              placeholder="Todos os pacientes (sem restrição)"
            />
            <p className="text-[11px] text-muted-foreground">
              Quando preenchido, o disparo (e os contatos vinculados) fica limitado a
              estes pacientes — combina com qualquer modo de público abaixo.
            </p>
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
                  filters={filters}
                  onFiltersChange={setFilters}
                />
              </div>
            )}
          </div>

          <div className="space-y-2 pt-2 border-t border-border">
            <Label className="text-xs uppercase">Destinatários</Label>
            <p className="text-xs text-muted-foreground">
              Confira a lista resultante e remova quem não deve receber.
            </p>
            <RecipientPreview
              recipients={recipients}
              loading={previewLoading}
              selectedKeys={selected}
              onChange={setSelected}
            />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          {usesMedication && patientsWithoutMeds.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="font-medium">
                  {patientsWithoutMeds.length} paciente(s) sem medicação cadastrada serão pulados no envio:
                </p>
                <p>{patientsWithoutMeds.slice(0, 8).join(", ")}{patientsWithoutMeds.length > 8 ? `, +${patientsWithoutMeds.length - 8}` : ""}.</p>
                <p className="opacity-90">
                  Cadastre as medicações desses pacientes ou remova-os no passo Destinatários.
                </p>
              </div>
            </div>
          )}
          {usesMedication && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs space-y-2">
              <Label className="text-xs uppercase">Quando o paciente tiver várias medicações</Label>
              <div className="flex flex-wrap gap-2">
                {[
                  { v: "all", label: "Listar todas" },
                  { v: "first", label: "Enviar só a primeira" },
                ].map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setMedicationMode(opt.v as "all" | "first")}
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      medicationMode === opt.v
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {manualVars.length > 0 && (
            <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
              <Label className="text-xs uppercase">Variáveis</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {manualVars.map((v) => (
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

          <div className="space-y-2 text-sm">
            <h4 className="font-semibold text-brand">Resumo</h4>
            <div className="grid gap-1 sm:grid-cols-2">
              <p><span className="text-muted-foreground">Campanha:</span> {campaignName || "—"}</p>
              <p><span className="text-muted-foreground">Modelo:</span> {selectedTemplate?.name ?? "Texto livre"}</p>
              <p>
                <span className="text-muted-foreground">Tipo de modelo:</span>{" "}
                {selectedTemplate
                  ? selectedTemplate.template_kind === "meta"
                    ? `Template Meta (${selectedTemplate.meta_status ?? "não submetido"})`
                    : "Interno"
                  : "Texto livre"}
              </p>
              <p><span className="text-muted-foreground">Canal:</span> WhatsApp</p>
              <p>
                <span className="text-muted-foreground">Destinatários:</span>{" "}
                {finalRecipients.length}
                {usesMedication && patientsWithoutMeds.length > 0 && (
                  <span className="text-amber-700 dark:text-amber-300">
                    {" "}({finalRecipients.filter((r) => (medsByPatient.get(r.patient_id) ?? []).length > 0).length} efetivos)
                  </span>
                )}
              </p>
            </div>
          </div>

          {previewsByAudience.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs uppercase">Como cada tipo de público verá a mensagem</Label>
              <div className="grid gap-3 md:grid-cols-2">
                {previewsByAudience.map((p) => (
                  <div key={p.audience} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-brand">{AUDIENCE_LABELS[p.audience]}</span>
                      <span className="text-muted-foreground">
                        Ex.: {p.recipient.name}
                        {p.audience !== "paciente" && ` → paciente ${p.recipient.patient_name}`}
                      </span>
                    </div>
                    <WhatsAppPreview
                      body={p.body}
                      recipientName={p.recipient.name}
                      highlightVars={false}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {finalRecipients[0] && (
            <div className="rounded-md border border-border bg-muted/30 p-2 text-xs space-y-0.5">
              <p className="text-muted-foreground">Exemplo do primeiro destinatário:</p>
              <p>
                <span className="text-muted-foreground">Original:</span>{" "}
                <span className="font-mono">{finalRecipients[0].phone}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Normalizado:</span>{" "}
                <span className="font-mono">
                  {normalizeBR(finalRecipients[0].phone) ?? "inválido"}
                </span>
              </p>
            </div>
          )}

          {(!selectedTemplate || selectedTemplate.template_kind === "internal") && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-900 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Modelos internos / texto livre podem falhar ao iniciar conversas fora da janela
                de 24h. Para produção, use um Template Meta aprovado.
              </span>
            </div>
          )}

          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-900 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              Cada destinatário receberá uma mensagem individual, registrada no histórico.
              Revise o texto antes de continuar.
            </span>
          </div>
        </div>
      )}

      {step === 3 && (
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
    <ol className="flex w-full items-center">
      {STEPS.map((label, i) => {
        const active = i === step;
        const done = i < step;
        return (
          <li key={label} className="flex flex-1 items-center">
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                active
                  ? "bg-primary text-primary-foreground"
                  : done
                    ? "bg-emerald-500 text-white"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {i + 1}
            </div>
            <span className={`mx-2 text-xs font-medium whitespace-nowrap ${active ? "text-foreground" : "text-muted-foreground"}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && <div className="mx-2 h-px flex-1 bg-border" />}
          </li>
        );
      })}
    </ol>
  );
}