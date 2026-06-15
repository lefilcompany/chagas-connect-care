import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { qk } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
  lockedPatientId,
  initialMode,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  template: MessageTemplate | null;
  /** Called when the user picks "segment" mode — should switch to /app/mensagens "Envio segmentado" tab. */
  onGoToSegmented?: (template: MessageTemplate) => void;
  /** If set, hides the patient picker and forces this patient. */
  lockedPatientId?: string;
  /** Pre-selects the dispatch mode. When `lockedPatientId` is set, segment mode is hidden. */
  initialMode?: Mode;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<Mode>("patient");
  const [patientId, setPatientId] = useState<string>("");
  const [contactIds, setContactIds] = useState<string[]>([]);
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
    setMode(initialMode ?? "patient");
    setPatientId(lockedPatientId ?? "");
    setContactIds([]);
    setVars({});
  }, [open, template?.id, lockedPatientId, initialMode]);

  // Auto-fill variables when patient / first contact selected
  useEffect(() => {
    if (!template) return;
    const patient = patients.find((p) => p.id === patientId) ?? null;
    const firstContact = contacts.find((c) => c.id === contactIds[0]) ?? null;
    const auto = autofillVariables(detectedVars, {
      patient,
      contact: firstContact,
      medications,
    });
    setVars((cur) => {
      const next = { ...cur };
      for (const k of Object.keys(auto)) if (!next[k]) next[k] = auto[k];
      return next;
    });
  }, [patientId, contactIds, patients, contacts, medications, detectedVars, template]);

  if (!template) return null;

  const patient = patients.find((p) => p.id === patientId);
  const selectedContacts = contacts.filter((c) => contactIds.includes(c.id));
  const firstContact = selectedContacts[0];
  const recipientName = mode === "contact"
    ? selectedContacts.length === 1
      ? firstContact?.full_name ?? ""
      : `${selectedContacts.length} contatos`
    : patient?.full_name ?? "";
  const recipientPhone = mode === "contact"
    ? firstContact?.phone ?? ""
    : patient?.phone ?? "";

  const renderedBody = renderTemplate(template.body, vars);

  const canAdvance0 = mode === "segment"
    ? true
    : mode === "patient"
      ? !!patientId && !!recipientPhone
      : !!patientId && contactIds.length > 0;

  const toggleContact = (id: string) => {
    setContactIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };

  const handleSend = async () => {
    if (!canAdvance0) return toast.error("Selecione um destinatário válido");
    setSending(true);
    const targets = mode === "contact"
      ? selectedContacts.map((c) => ({
          contact_id: c.id as string | null,
          name: c.full_name,
          // Per-contact autofill so {nome_contato} / {nome_destinatario} are right.
          extraVars: autofillVariables(detectedVars, {
            patient: patient ?? null,
            contact: c,
            medications,
          }),
        }))
      : [{ contact_id: null as string | null, name: patient?.full_name ?? "", extraVars: {} as Record<string, string> }];

    let ok = 0;
    let fail = 0;
    for (const t of targets) {
      const perVars = { ...vars, ...t.extraVars };
      const result = await queueAndSendFromTemplate({
        template: {
          id: template.id,
          body: template.body,
          template_kind: template.template_kind,
          meta_template_name: template.meta_template_name ?? null,
          channel: "whatsapp",
        },
        patient_id: patientId,
        contact_id: t.contact_id,
        variables: perVars,
        created_by: user?.id ?? null,
        recipient_name: t.name || null,
      });
      if (result.ok) ok++; else fail++;
    }
    setSending(false);
    qc.invalidateQueries({ queryKey: qk.messages });
    if (ok === 0) return toast.error(`Falha ao enviar (${fail})`);
    if (fail > 0) toast.success(`${ok} mensagem(ns) enviada(s), ${fail} falharam`);
    else toast.success(targets.length > 1 ? `${ok} mensagens enviadas` : "Mensagem enviada");
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
            <div className={`grid gap-2 ${lockedPatientId ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
              <RecipientOption
                selected={mode === "patient"}
                icon={<UserIcon className="h-5 w-5" />}
                title="Paciente"
                desc="Enviar para um paciente específico"
                onClick={() => { setMode("patient"); setContactIds([]); }}
              />
              <RecipientOption
                selected={mode === "contact"}
                icon={<UserIcon className="h-5 w-5" />}
                title="Familiar/Cuidador/Médico"
                desc="Enviar a um ou mais contatos vinculados"
                onClick={() => setMode("contact")}
              />
              {!lockedPatientId && (
                <RecipientOption
                  selected={mode === "segment"}
                  icon={<Users className="h-5 w-5" />}
                  title="Segmento de pacientes"
                  desc="Disparar para vários ao mesmo tempo"
                  onClick={() => setMode("segment")}
                />
              )}
            </div>

            {mode !== "segment" && (
              <div className="space-y-3">
                {!lockedPatientId && (
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
                )}
                {mode === "contact" && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label>Contatos vinculados</Label>
                      <span className="text-[11px] text-muted-foreground">
                        {contactIds.length} selecionado(s)
                      </span>
                    </div>
                    {!patientId ? (
                      <p className="text-sm text-muted-foreground">Escolha um paciente primeiro.</p>
                    ) : contacts.length === 0 ? (
                      <p className="rounded-md border border-dashed border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                        Nenhum contato cadastrado para este paciente.
                      </p>
                    ) : (
                      <ul className="divide-y divide-border rounded-md border border-border bg-card max-h-64 overflow-y-auto">
                        {contacts.map((c) => {
                          const checked = contactIds.includes(c.id);
                          const disabled = !c.phone;
                          return (
                            <li key={c.id}>
                              <label
                                className={`flex items-center gap-3 p-3 text-sm ${
                                  disabled ? "opacity-60" : "cursor-pointer hover:bg-muted/40"
                                }`}
                              >
                                <Checkbox
                                  checked={checked}
                                  disabled={disabled}
                                  onCheckedChange={() => !disabled && toggleContact(c.id)}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium truncate">{c.full_name}</span>
                                    <span className="text-[10px] uppercase text-muted-foreground">
                                      {c.relation}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-muted-foreground">
                                    {c.phone || "sem telefone"}
                                  </div>
                                </div>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    {contactIds.length > 1 && (
                      <p className="text-[11px] text-muted-foreground">
                        Variáveis dependentes do contato (ex.: <code>{`{nome_contato}`}</code>) serão
                        preenchidas individualmente no envio.
                      </p>
                    )}
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
                {mode === "contact" && selectedContacts.length > 0 ? (
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {selectedContacts.slice(0, 5).map((c) => (
                      <div key={c.id}>• {c.full_name} ({c.relation}) {c.phone ? `· ${c.phone}` : ""}</div>
                    ))}
                    {selectedContacts.length > 5 && <div>… e mais {selectedContacts.length - 5}</div>}
                  </div>
                ) : (
                  <p><span className="text-muted-foreground">Telefone:</span> {recipientPhone || "—"}</p>
                )}
                <p><span className="text-muted-foreground">Canal:</span> WhatsApp</p>
                <p><span className="text-muted-foreground">Modelo:</span> {template.name}</p>
                {mode === "contact" && selectedContacts.length > 1 && (
                  <p><span className="text-muted-foreground">Total:</span> {selectedContacts.length} envios</p>
                )}
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