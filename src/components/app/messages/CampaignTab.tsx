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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Send, AlertTriangle } from "lucide-react";
import { SegmentFiltersForm } from "@/components/app/SegmentFilters";
import { RecipientPreview } from "@/components/app/RecipientPreview";
import {
  ALL_AUDIENCES, AUDIENCE_LABELS, AudienceType, Recipient, SegmentDef,
  SegmentFilters, TargetingMode, emptyFilters, resolveRecipients,
} from "@/lib/segments";
import { extractVariables, renderTemplate, type MessageTemplate } from "@/lib/templates";
import { createBatch } from "@/lib/whatsapp";

export default function CampaignTab() {
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

  const [templateId, setTemplateId] = useState<string>("");
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [vars, setVars] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<TargetingMode>("audiences");
  const [aud, setAud] = useState<AudienceType[]>(["paciente"]);
  const [segmentId, setSegmentId] = useState<string | null>(null);
  const [filters, setFilters] = useState<SegmentFilters>(emptyFilters());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [institution, setInstitution] = useState("");

  useEffect(() => {
    if (user) {
      supabase.from("profiles").select("institution").eq("id", user.id).maybeSingle()
        .then(({ data }) => setInstitution(data?.institution ?? ""));
    }
  }, [user]);

  const activeTemplates = useMemo(
    () => templates.filter((t) => t.is_active),
    [templates],
  );
  const selectedTemplate = useMemo(
    () => activeTemplates.find((t) => t.id === templateId) ?? null,
    [activeTemplates, templateId],
  );

  // Apply template selection
  useEffect(() => {
    if (!selectedTemplate) return;
    setBody(selectedTemplate.body);
    const detected = extractVariables(selectedTemplate.body);
    const next: Record<string, string> = {};
    detected.forEach((v) => (next[v] = vars[v] ?? ""));
    setVars(next);
    if (!name) setName(selectedTemplate.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  const detectedVars = useMemo(() => extractVariables(body), [body]);

  // Resolve audience/filters
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
    enabled: previewAud.length > 0,
  });

  const renderedBody = useMemo(() => renderTemplate(body, vars), [body, vars]);

  const finalRecipients = useMemo(
    () => recipients.filter((r) => selected.has(r.key) && r.phone && r.channel === "whatsapp"),
    [recipients, selected],
  );

  const canSend = !sending && finalRecipients.length > 0 && renderedBody.trim().length >= 3;

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    const result = await createBatch({
      name: name.trim() || (selectedTemplate?.name ?? "Campanha"),
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
    setConfirmOpen(false);
    qc.invalidateQueries({ queryKey: qk.messages });
    qc.invalidateQueries({ queryKey: qk.batches });
    if (!result.ok) {
      toast.error(result.error ?? "Falha ao enviar campanha");
      return;
    }
    toast.success(
      `Campanha disparada: ${result.ok_count ?? finalRecipients.length} enviadas` +
        (result.failed_count ? `, ${result.failed_count} falharam` : ""),
    );
  };

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          Em saúde, sempre revise a mensagem e a prévia dos destinatários antes de disparar.
          Cada destinatário receberá uma mensagem individual com registro próprio.
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Modelo (opcional)</Label>
            <Select value={templateId || "_none"} onValueChange={(v) => setTemplateId(v === "_none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Texto livre" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Texto livre (sem modelo)</SelectItem>
                {activeTemplates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} {t.template_kind === "meta" ? "(Meta)" : "(Interno)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Nome da campanha</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Lembrete consulta - março" />
          </div>

          <div className="space-y-1.5">
            <Label>Mensagem</Label>
            <Textarea
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Texto da mensagem..."
              disabled={selectedTemplate?.template_kind === "meta"}
            />
            {selectedTemplate?.template_kind === "meta" && (
              <p className="text-[11px] text-muted-foreground">
                Texto fixo pelo template aprovado da Meta. Apenas as variáveis podem ser editadas.
              </p>
            )}
          </div>

          {detectedVars.length > 0 && (
            <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
              <Label className="text-xs uppercase">Variáveis</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {detectedVars.map((v) => (
                  <div key={v} className="space-y-1">
                    <Label className="text-xs font-mono">{`{${v}}`}</Label>
                    <Input
                      value={vars[v] ?? ""}
                      onChange={(e) => setVars({ ...vars, [v]: e.target.value })}
                      placeholder={v}
                    />
                  </div>
                ))}
              </div>
              <div className="rounded-md border border-border bg-card p-2 text-xs whitespace-pre-wrap">
                <span className="font-semibold text-muted-foreground">Preview: </span>
                {renderedBody}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-xs uppercase">Segmentação</Label>
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
              <div className="flex flex-wrap gap-2 mt-2">
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

        <div className="space-y-3">
          <Label className="text-xs uppercase">Destinatários</Label>
          <RecipientPreview
            recipients={recipients}
            loading={previewLoading}
            selectedKeys={selected}
            onChange={setSelected}
          />
          <Button
            variant="hero"
            className="w-full"
            disabled={!canSend}
            onClick={() => setConfirmOpen(true)}
          >
            <Send className="h-4 w-4" /> Disparar para {finalRecipients.length} destinatário(s)
          </Button>
          {recipients.length > 0 && finalRecipients.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Nenhum destinatário válido (telefone WhatsApp e seleção).
            </p>
          )}
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar disparo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              Você vai disparar uma mensagem para{" "}
              <strong>{finalRecipients.length}</strong> destinatário(s).
            </p>
            <div className="rounded-md border border-border bg-muted/30 p-3 whitespace-pre-wrap text-xs">
              {renderedBody}
            </div>
            {selectedTemplate && (
              <Badge variant="outline">
                Modelo: {selectedTemplate.name}
                {selectedTemplate.template_kind === "meta" ? " · Meta" : " · Interno"}
              </Badge>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
            <Button variant="hero" onClick={handleSend} disabled={sending}>
              {sending ? "Disparando..." : "Confirmar e enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
