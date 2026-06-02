import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fetchers, qk } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Send, UserPlus, History,
} from "lucide-react";
import { User, Phone, MessageSquare } from "lucide-react";
import { queueAndSend } from "@/lib/whatsapp";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import TemplatesTab from "@/components/app/messages/TemplatesTab";
import CampaignTab from "@/components/app/messages/CampaignTab";
import type { MessageTemplate } from "@/lib/templates";

type Patient = { id: string; full_name: string; phone: string; channel_pref: string; institution: string; stage: string };
type Contact = { id: string; patient_id: string; full_name: string; phone: string; relation: string; channel_pref: string };

export default function Messages() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: patients = [] } = useQuery({
    queryKey: qk.patients,
    queryFn: fetchers.patients as () => Promise<Patient[]>,
  });

  // Send dialog state
  const [sendOpen, setSendOpen] = useState(false);
  const [sendPatientId, setSendPatientId] = useState<string>("");
  const [sendChannel, setSendChannel] = useState<string>("whatsapp");
  const [sendRecipient, setSendRecipient] = useState<string>("patient");
  const [sendBody, setSendBody] = useState("");
  const [sending, setSending] = useState(false);
  const [patientContacts, setPatientContacts] = useState<Contact[]>([]);

  // Create patient dialog
  const [newPatientOpen, setNewPatientOpen] = useState(false);
  const [institution, setInstitution] = useState("");

  // Tabs + cross-tab template handoff
  const [tab, setTab] = useState<string>("modelos");
  const [campaignTemplateId, setCampaignTemplateId] = useState<string | null>(null);

  const openSegmentedWithTemplate = (t: MessageTemplate) => {
    setCampaignTemplateId(t.id);
    setTab("campanha");
  };

  useEffect(() => {
    if (user) {
      supabase.from("profiles").select("institution").eq("id", user.id).maybeSingle()
        .then(({ data }) => setInstitution(data?.institution ?? ""));
    }
  }, [user]);

  useEffect(() => {
    if (!sendPatientId) { setPatientContacts([]); return; }
    supabase.from("contacts").select("*").eq("patient_id", sendPatientId)
      .then(({ data }) => setPatientContacts((data ?? []) as Contact[]));
    const p = patients.find((x) => x.id === sendPatientId);
    if (p?.channel_pref) setSendChannel(p.channel_pref);
  }, [sendPatientId, patients]);

  const sendMessage = async () => {
    if (!sendPatientId) return toast.error("Selecione um paciente");
    if (!sendBody.trim()) return toast.error("Digite a mensagem");
    setSending(true);
    const contactId = sendRecipient !== "patient" ? sendRecipient : null;
    const result = await queueAndSend({
      patient_id: sendPatientId,
      contact_id: contactId,
      channel: sendChannel as "whatsapp" | "sms",
      body: sendBody.trim(),
      created_by: user?.id,
    });
    setSending(false);
    qc.invalidateQueries({ queryKey: qk.messages });
    qc.invalidateQueries({ queryKey: qk.dashboard });
    if (!result.ok) return toast.error(result.error ?? "Falha ao enviar");
    toast.success("Mensagem enviada");
    setSendOpen(false);
    setSendBody("");
    setSendRecipient("patient");
  };

  const resendMessage = async (m: any) => {
    const result = await queueAndSend({
      patient_id: m.patient_id,
      contact_id: m.contact_id,
      channel: m.channel,
      body: m.body,
      created_by: user?.id,
    });
    qc.invalidateQueries({ queryKey: qk.messages });
    if (!result.ok) return toast.error(result.error ?? "Falha ao reenviar");
    toast.success("Mensagem reenviada");
  };

  const createPatient = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    if (!fd.full_name?.trim()) return toast.error("Nome obrigatório");
    const { data, error } = await supabase.from("patients").insert({
      full_name: fd.full_name.trim(),
      phone: fd.phone ?? "",
      stage: (fd.stage || "diagnostico") as any,
      channel_pref: (fd.channel_pref || "whatsapp") as any,
      institution: fd.institution || institution,
      owner_id: user!.id,
    }).select("id").maybeSingle();
    if (error) return toast.error(error.message);
    toast.success("Paciente cadastrado");
    setNewPatientOpen(false);
    qc.invalidateQueries({ queryKey: qk.patients });
    if (data?.id) {
      setSendPatientId(data.id);
      setSendOpen(true);
    }
  };

  const selectedPatient = patients.find((p) => p.id === sendPatientId);
  const selectedContact = patientContacts.find((c) => c.id === sendRecipient);
  const recipientName = sendRecipient === "patient"
    ? selectedPatient?.full_name ?? ""
    : selectedContact?.full_name ?? "";
  const recipientPhoneSend = sendRecipient === "patient"
    ? selectedPatient?.phone ?? ""
    : selectedContact?.phone ?? "";
  const recipientRelation = sendRecipient === "patient" ? "Paciente" : selectedContact?.relation ?? "";
  const canSend = !!sendPatientId && !!sendBody.trim() && !!recipientPhoneSend && !sending;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap md:flex-nowrap items-start md:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-bold text-brand">Mensagens</h1>
          <p className="text-muted-foreground mt-1">
            Histórico de comunicações enviadas a pacientes, famílias e cuidadores.
          </p>
        </div>
        <div className="flex flex-wrap md:flex-nowrap items-center gap-2 shrink-0">
          <Button variant="outline" onClick={() => setNewPatientOpen(true)}>
            <UserPlus className="h-4 w-4" /> Novo paciente
          </Button>
          <Button variant="hero" onClick={() => setSendOpen(true)}>
            <Send className="h-4 w-4" /> Disparar mensagem
          </Button>
        </div>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="modelos">Modelos</TabsTrigger>
          <TabsTrigger value="campanha">Envio segmentado</TabsTrigger>
        </TabsList>

        <TabsContent value="modelos">
          <TemplatesTab onGoToSegmented={openSegmentedWithTemplate} />
        </TabsContent>

        <TabsContent value="campanha">
          <CampaignTab
            initialTemplateId={campaignTemplateId}
            onConsumeInitial={() => setCampaignTemplateId(null)}
          />
        </TabsContent>
      </Tabs>

      {/* Send dialog */}
      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Disparar mensagem</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Paciente</Label>
              <div className="flex gap-2">
                <Select value={sendPatientId} onValueChange={setSendPatientId}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Selecione um paciente" /></SelectTrigger>
                  <SelectContent>
                    {patients.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="icon" onClick={() => { setSendOpen(false); setNewPatientOpen(true); }} aria-label="Criar paciente">
                  <UserPlus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Destinatário</Label>
                <Select value={sendRecipient} onValueChange={setSendRecipient}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="patient">Paciente</SelectItem>
                    {patientContacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.full_name} ({c.relation})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Canal</Label>
                <Select value={sendChannel} onValueChange={setSendChannel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Mensagem</Label>
              <Textarea
                value={sendBody}
                onChange={(e) => setSendBody(e.target.value)}
                placeholder="Escreva a mensagem..."
                rows={4}
                maxLength={1000}
              />
              <div className="text-[11px] text-muted-foreground text-right">{sendBody.length}/1000</div>
            </div>

            {sendPatientId && (
              <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                  Destinatário do envio
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-brand" />
                  <span className="font-medium">{recipientName || "—"}</span>
                  {recipientRelation && (
                    <span className="text-xs text-muted-foreground">({recipientRelation})</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-brand" />
                  <span className={recipientPhoneSend ? "" : "text-destructive"}>
                    {recipientPhoneSend || "Telefone não cadastrado"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MessageSquare className="h-4 w-4 text-brand" />
                  <span className="capitalize">{sendChannel}</span>
                  {selectedPatient && (
                    <span className="text-xs text-muted-foreground">
                      · Paciente: {selectedPatient.full_name}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendOpen(false)}>Cancelar</Button>
            <Button variant="hero" onClick={sendMessage} disabled={!canSend}>
              <Send className="h-4 w-4" /> {sending ? "Enviando..." : "Enviar (simulado)"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New patient dialog */}
      <Dialog open={newPatientOpen} onOpenChange={setNewPatientOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cadastrar paciente</DialogTitle></DialogHeader>
          <form onSubmit={createPatient} className="space-y-3">
            <div className="space-y-2"><Label>Nome completo</Label><Input name="full_name" required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Telefone</Label><Input name="phone" placeholder="(81) 9..." /></div>
              <div className="space-y-2"><Label>Etapa</Label>
                <Select name="stage" defaultValue="diagnostico">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="diagnostico">Diagnóstico</SelectItem>
                    <SelectItem value="agudo">Agudo</SelectItem>
                    <SelectItem value="cronico">Crônico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Canal</Label>
                <Select name="channel_pref" defaultValue="whatsapp">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Instituição</Label><Input name="institution" defaultValue={institution} /></div>
            </div>
            <Button type="submit" variant="hero" className="w-full">Cadastrar e abrir disparo</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registro da mensagem</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Paciente</div>
                  <Link to={`/app/pacientes/${detail.patient_id}`} className="font-medium text-brand hover:underline">
                    {detail.patients?.full_name ?? "—"}
                  </Link>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Para quem</div>
                  <div className="font-medium">{recipientLabel(detail)}</div>
                  <div className="text-xs text-muted-foreground">{recipientPhone(detail)}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Canal</div>
                  <div className="font-medium uppercase">{detail.channel}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Status</div>
                  <StatusBadge status={detail.status} />
                </div>
                <div className="col-span-2">
                  <div className="text-xs uppercase text-muted-foreground">Enviada em</div>
                  <div>{detail.sent_at ? new Date(detail.sent_at).toLocaleString("pt-BR") : "—"}</div>
                </div>
              </div>
              <div>
                <div className="text-xs uppercase text-muted-foreground mb-1">Mensagem</div>
                <div className="rounded-lg border border-border bg-muted/30 p-3 whitespace-pre-wrap">{detail.body}</div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetail(null)}>Fechar</Button>
            {detail && (
              <Button variant="hero" onClick={() => resendMessage(detail)}>
                <RefreshCw className="h-4 w-4" /> Reenviar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Patient history dialog */}
      <Dialog open={!!historyPatientId} onOpenChange={(o) => !o && setHistoryPatientId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Histórico de mensagens — {historyPatient?.full_name ?? ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{historyMessages.length} mensagem(ns) registradas</span>
              {historyPatientId && (
                <Link
                  to={`/app/pacientes/${historyPatientId}`}
                  className="text-brand hover:underline inline-flex items-center gap-1"
                  onClick={() => setHistoryPatientId(null)}
                >
                  Abrir ficha do paciente <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>
            <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-border divide-y divide-border">
              {historyMessages.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Nenhuma mensagem registrada para este paciente.
                </div>
              ) : (
                historyMessages.map((m: any) => (
                  <div key={m.id} className="p-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-2">
                        <span className="uppercase font-semibold text-brand">{m.channel}</span>
                        <span>→</span>
                        <span className="text-foreground font-medium">{recipientLabel(m)}</span>
                        <span className="text-muted-foreground">· {recipientPhone(m)}</span>
                      </span>
                      <span>{m.sent_at ? new Date(m.sent_at).toLocaleString("pt-BR") : "—"}</span>
                    </div>
                    <div className="text-sm whitespace-pre-wrap">{m.body}</div>
                    <div className="flex items-center justify-between gap-2">
                      <StatusBadge status={m.status} />
                      <Button size="sm" variant="outline" onClick={() => resendMessage(m)}>
                        <RefreshCw className="h-4 w-4" /> Reenviar
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryPatientId(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}