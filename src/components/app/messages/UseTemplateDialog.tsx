import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { qk } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  ChevronLeft, ChevronRight, Send, AlertTriangle, Users, User as UserIcon,
} from "lucide-react";
import {
  extractVariables, renderTemplate, autofillVariables, type MessageTemplate,
} from "@/lib/templates";
import { WhatsAppPreview } from "./WhatsAppPreview";
import { queueAndSendFromTemplate } from "@/lib/whatsapp";

type Patient = { id: string; full_name: string; phone: string; channel_pref: string };
type Contact = { id: string; patient_id: string; full_name: string; phone: string; relation: string };
type Medication = { id: string; patient_id: string; name: string; dose: string; schedule: string };

type Mode = "patient" | "contact" | "segment";

const STEPS = ["Destinatário", "Variáveis", "Revisar e enviar"] as const;

export function UseTemplateDialog({
  open,
  onOpenChange,
  template,
  onGoToSegmented,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  template: MessageTemplate | null;
  /** Called when the user picks "segment" mode — should switch to /app/mensagens "Envio segmentado" tab. */
  onGoToSegmented?: (template: MessageTemplate) => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<Mode>("patient");
  const [patientId, setPatientId] = useState<string>("");
  const [contactId, setContactId] = useState<string>("");
  const [vars, setVars] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);

  const { data: patients = [] } = useQuery<Patient[]>({
    queryKey: qk.patients,
    queryFn: async () => {
      const { data } = await supabase
        .from("patients")
        .select("id, full_name, phone, channel_pref")
        .order("full_name");
      return (data as Patient[]) ?? [];
    },
    enabled: open,
  });

  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ["dialog-contacts", patientId],
    enabled: open && !!patientId,
    queryFn: async () => {
      const { data } = await supabase
        .from("contacts")
        .select("id, patient_id, full_name, phone, relation")
        .eq("patient_id", patientId);
      return (data as Contact[]) ?? [];
    },
  });

  const { data: medications = [] } = useQuery<Medication[]>({
    queryKey: ["dialog-meds", patientId],
    enabled: open && !!patientId,
    queryFn: async () => {
      const { data } = await supabase
        .from("medications")
        .select("id, patient_id, name, dose, schedule")
        .eq("patient_id", patientId);
      return (data as Medication[]) ?? [];
    },
  });

  const detectedVars = useMemo(
    () => (template ? extractVariables(template.body) : []),
    [template],
  );

  // Reset on open / template change
  useEffect(() => {
    if (!open) return;
    setStep(0);
    setMode("patient");
    setPatientId("");
    setContactId("");
    setVars({});
  }, [open, template?.id]);

  // Auto-fill variables when patient/contact selected
  useEffect(() => {
    if (!template) return;
    const patient = patients.find((p) => p.id === patientId) ?? null;
    const contact = contacts.find((c) => c.id === contactId) ?? null;
    const auto = autofillVariables(detectedVars, {
      patient,
      contact,
      medications,
    });
    setVars((cur) => {
      const next = { ...cur };
      for (const k of Object.keys(auto)) if (!next[k]) next[k] = auto[k];
      return next;
    });
  }, [patientId, contactId, patients, contacts, medications, detectedVars, template]);

  if (!template) return null;

  const patient = patients.find((p) => p.id === patientId);
  const contact = contacts.find((c) => c.id === contactId);
  const recipientName = mode === "contact"
    ? contact?.full_name ?? ""
    : patient?.full_name ?? "";
  const recipientPhone = mode === "contact"
    ? contact?.phone ?? ""
    : patient?.phone ?? "";

  const renderedBody = renderTemplate(template.body, vars);

  const canAdvance0 = mode === "segment"
    ? true
    : mode === "patient"
      ? !!patientId && !!recipientPhone
      : !!patientId && !!contactId && !!recipientPhone;

  const handleSend = async () => {
    if (!canAdvance0) return toast.error("Selecione um destinatário válido");
    setSending(true);
    const result = await queueAndSendFromTemplate({
      template: {
        id: template.id,
        body: template.body,
        template_kind: template.template_kind,
        meta_template_name: template.meta_template_name ?? null,
        channel: "whatsapp",
      },
      patient_id: patientId,
      contact_id: mode === "contact" ? contactId : null,
      variables: vars,
      created_by: user?.id ?? null,
      recipient_name: recipientName || null,
    });
    setSending(false);
    qc.invalidateQueries({ queryKey: qk.messages });
    if (!result.ok) return toast.error(result.error ?? "Falha ao enviar");
    toast.success("Mensagem enviada");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Usar modelo: {template.name}</DialogTitle>
        </DialogHeader>

        <Stepper step={step} />

        {step === 0 && (
          <div className="space-y-4">
            <Label>Quem vai receber?</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              <RecipientOption
                selected={mode === "patient"}
                icon={<UserIcon className="h-5 w-5" />}
                title="Paciente"
                desc="Enviar para um paciente específico"
                onClick={() => { setMode("patient"); setContactId(""); }}
              />
              <RecipientOption
                selected={mode === "contact"}
                icon={<UserIcon className="h-5 w-5" />}
                title="Familiar/Cuidador/Médico"
                desc="Enviar a um contato vinculado"
                onClick={() => setMode("contact")}
              />
              <RecipientOption
                selected={mode === "segment"}
                icon={<Users className="h-5 w-5" />}
                title="Segmento de pacientes"
                desc="Disparar para vários ao mesmo tempo"
                onClick={() => setMode("segment")}
              />
            </div>

            {mode !== "segment" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Paciente</Label>
                  <Select value={patientId} onValueChange={setPatientId}>
                    <SelectTrigger><SelectValue placeholder="Selecione um paciente" /></SelectTrigger>
                    <SelectContent>
                      {patients.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.full_name} {p.phone ? `· ${p.phone}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {mode === "contact" && (
                  <div className="space-y-1.5">
                    <Label>Contato vinculado</Label>
                    <Select value={contactId} onValueChange={setContactId} disabled={!patientId}>
                      <SelectTrigger>
                        <SelectValue placeholder={patientId ? "Selecione um contato" : "Escolha um paciente primeiro"} />
                      </SelectTrigger>
                      <SelectContent>
                        {contacts.length === 0 && (
                          <SelectItem value="_none" disabled>Nenhum contato cadastrado</SelectItem>
                        )}
                        {contacts.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.full_name} ({c.relation}) {c.phone ? `· ${c.phone}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            {mode === "segment" && (
              <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
                Para disparar a vários pacientes ao mesmo tempo, vamos abrir o fluxo de
                <strong> Envio segmentado </strong>com este modelo já selecionado.
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              {detectedVars.length === 0 ? (
                <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                  Este modelo não tem variáveis para preencher.
                </div>
              ) : (
                detectedVars.map((v) => (
                  <div key={v} className="space-y-1.5">
                    <Label className="font-mono text-xs">{`{${v}}`}</Label>
                    <Input
                      value={vars[v] ?? ""}
                      onChange={(e) => setVars({ ...vars, [v]: e.target.value })}
                      placeholder={`Preencha ${v.replace(/_/g, " ")}`}
                    />
                  </div>
                ))
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase">Pré-visualização</Label>
              <WhatsAppPreview body={renderedBody} recipientName={recipientName || "Destinatário"} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2 text-sm">
                <h4 className="font-semibold text-brand">Resumo do envio</h4>
                <p><span className="text-muted-foreground">Destinatário:</span> {recipientName || "—"}</p>
                <p><span className="text-muted-foreground">Telefone:</span> {recipientPhone || "—"}</p>
                <p><span className="text-muted-foreground">Canal:</span> WhatsApp</p>
                <p><span className="text-muted-foreground">Modelo:</span> {template.name}</p>
              </div>
              <WhatsAppPreview body={renderedBody} recipientName={recipientName || "Destinatário"} highlightVars={false} />
            </div>
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-900 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>Revise a mensagem antes de enviar. Ela será registrada no histórico do paciente.</span>
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
            {step === 0 && mode === "segment" ? (
              <Button variant="hero" onClick={() => { onGoToSegmented?.(template); onOpenChange(false); }}>
                Ir para envio segmentado <ChevronRight className="h-4 w-4" />
              </Button>
            ) : step < STEPS.length - 1 ? (
              <Button
                variant="hero"
                onClick={() => setStep((s) => s + 1)}
                disabled={step === 0 && !canAdvance0}
              >
                Avançar <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button variant="hero" onClick={handleSend} disabled={sending}>
                <Send className="h-4 w-4" /> {sending ? "Enviando..." : "Enviar mensagem"}
              </Button>
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

function RecipientOption({
  selected, icon, title, desc, onClick,
}: { selected: boolean; icon: React.ReactNode; title: string; desc: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-start gap-2 rounded-lg border-2 p-3 text-left transition-colors ${
        selected ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted/50"
      }`}
    >
      <div className={`flex h-8 w-8 items-center justify-center rounded-full ${selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
        {icon}
      </div>
      <div>
        <div className="font-semibold text-sm text-brand">{title}</div>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
    </button>
  );
}