import { useMemo, useState, useEffect } from "react";
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
  Send, Search, Plus, UserPlus, RefreshCw, Check, CheckCheck, Clock, ArrowRight, X,
} from "lucide-react";
import { User, Phone, MessageSquare, History } from "lucide-react";
import { queueAndSend } from "@/lib/whatsapp";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import TemplatesTab from "@/components/app/messages/TemplatesTab";
import CampaignTab from "@/components/app/messages/CampaignTab";
import { extractVariables, renderTemplate, type MessageTemplate } from "@/lib/templates";
import { fetchers as f2 } from "@/lib/queries";

type Patient = { id: string; full_name: string; phone: string; channel_pref: string; institution: string; stage: string };
type Contact = { id: string; patient_id: string; full_name: string; phone: string; relation: string; channel_pref: string };

const statusMeta: Record<string, { label: string; icon: any; tone: string }> = {
  enviado: { label: "Enviado", icon: Check, tone: "text-muted-foreground" },
  sent: { label: "Enviado", icon: Check, tone: "text-muted-foreground" },
  entregue: { label: "Entregue", icon: CheckCheck, tone: "text-muted-foreground" },
  delivered: { label: "Entregue", icon: CheckCheck, tone: "text-muted-foreground" },
  lido: { label: "Lido", icon: CheckCheck, tone: "text-sky-500" },
  read: { label: "Lido", icon: CheckCheck, tone: "text-sky-500" },
  pendente: { label: "Pendente", icon: Clock, tone: "text-amber-500" },
  pending: { label: "Pendente", icon: Clock, tone: "text-amber-500" },
  queued: { label: "Pendente", icon: Clock, tone: "text-amber-500" },
  falhou: { label: "Falhou", icon: Clock, tone: "text-destructive" },
  failed: { label: "Falhou", icon: Clock, tone: "text-destructive" },
  error: { label: "Falhou", icon: Clock, tone: "text-destructive" },
};

function StatusBadge({ status }: { status: string }) {
  const meta = statusMeta[status] ?? { label: status, icon: Clock, tone: "text-muted-foreground" };
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${meta.tone}`}>
      <Icon className="h-3 w-3" /> {meta.label}
    </span>
  );
}

export default function Messages() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: msgs = [] } = useQuery({ queryKey: qk.messages, queryFn: fetchers.messages });
  const { data: patients = [] } = useQuery({
    queryKey: qk.patients,
    queryFn: fetchers.patients as () => Promise<Patient[]>,
  });

  const [q, setQ] = useState("");
  const [patientFilter, setPatientFilter] = useState<string>("todos");
  const [channelFilter, setChannelFilter] = useState<string>("todos");
  const [statusFilter, setStatusFilter] = useState<string>("todos");

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

  // Detail dialog
  const [detail, setDetail] = useState<any | null>(null);

  // Patient history dialog
  const [historyPatientId, setHistoryPatientId] = useState<string | null>(null);

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

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return msgs.filter((m: any) => {
      if (patientFilter !== "todos" && m.patient_id !== patientFilter) return false;
      if (channelFilter !== "todos" && m.channel !== channelFilter) return false;
      if (statusFilter !== "todos") {
        const meta = statusMeta[m.status];
        const normalized = meta?.label.toLowerCase() ?? m.status;
        if (normalized !== statusFilter) return false;
      }
      if (!term) return true;
      return (
        (m.body ?? "").toLowerCase().includes(term) ||
        (m.patients?.full_name ?? "").toLowerCase().includes(term) ||
        (m.contact?.full_name ?? "").toLowerCase().includes(term)
      );
    });
  }, [msgs, q, patientFilter, channelFilter, statusFilter]);

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
    setDetail(null);
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

  const recipientLabel = (m: any) =>
    m.contact ? `${m.contact.full_name} (${m.contact.relation})` : m.patients?.full_name ?? "—";

  const recipientPhone = (m: any) => m.contact?.phone ?? m.patients?.phone ?? "—";

  const historyPatient = patients.find((p) => p.id === historyPatientId);
  const historyMessages = useMemo(
    () => (historyPatientId ? msgs.filter((m: any) => m.patient_id === historyPatientId) : []),
    [msgs, historyPatientId],
  );

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

  const patientLabel = patients.find((p) => p.id === patientFilter)?.full_name;
  const activeFilters: { key: string; label: string; value: string; clear: () => void }[] = [
    ...(q ? [{ key: "q", label: "Busca", value: q, clear: () => setQ("") }] : []),
    ...(patientFilter !== "todos" && patientLabel
      ? [{ key: "p", label: "Paciente", value: patientLabel, clear: () => setPatientFilter("todos") }]
      : []),
    ...(channelFilter !== "todos"
      ? [{ key: "c", label: "Canal", value: channelFilter, clear: () => setChannelFilter("todos") }]
      : []),
    ...(statusFilter !== "todos"
      ? [{ key: "s", label: "Status", value: statusFilter, clear: () => setStatusFilter("todos") }]
      : []),
  ];
  const clearAllFilters = () => {
    setQ(""); setPatientFilter("todos"); setChannelFilter("todos"); setStatusFilter("todos");
  };

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

      {/* Filters */}
      <div className="rounded-2xl border border-border bg-card p-3 sm:p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
          <div className="flex flex-col gap-1 lg:col-span-5 sm:col-span-2">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                className="pl-9 pr-9 h-10 bg-background w-full"
                placeholder="Texto, paciente ou contato..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              {q && (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-md"
                  aria-label="Limpar busca"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1 min-w-0 lg:col-span-3">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Paciente</Label>
            <Select value={patientFilter} onValueChange={setPatientFilter}>
              <SelectTrigger className="h-10 bg-background w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os pacientes</SelectItem>
                {patients.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1 min-w-0 lg:col-span-2">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Canal</Label>
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger className="h-10 bg-background w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1 min-w-0 lg:col-span-2">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10 bg-background w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="enviado">Enviado</SelectItem>
                <SelectItem value="entregue">Entregue</SelectItem>
                <SelectItem value="lido">Lido</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="falhou">Falhou</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/60">
          <span className="text-xs text-muted-foreground pt-2">
            {filtered.length} de {msgs.length} mensagens
          </span>
          {activeFilters.length > 0 && (
            <>
              <span className="text-muted-foreground/50 pt-2 hidden sm:inline">·</span>
              {activeFilters.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={f.clear}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs hover:bg-muted transition-colors max-w-[220px]"
                >
                  <span className="text-muted-foreground shrink-0">{f.label}:</span>
                  <span className="font-medium truncate">{f.value}</span>
                  <X className="h-3 w-3 text-muted-foreground shrink-0" />
                </button>
              ))}
              <button
                type="button"
                onClick={clearAllFilters}
                className="sm:ml-auto text-xs text-brand hover:underline font-medium"
              >
                Limpar filtros
              </button>
            </>
          )}
        </div>
      </div>

      {/* List */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground space-y-4">
            <p>Nenhuma mensagem encontrada com esses filtros.</p>
            <div className="flex justify-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setNewPatientOpen(true)}>
                <Plus className="h-4 w-4" /> Criar paciente
              </Button>
              <Button variant="hero" size="sm" onClick={() => setSendOpen(true)}>
                <Send className="h-4 w-4" /> Disparar mensagem
              </Button>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((m: any) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => setDetail(m)}
                  className="w-full text-left p-4 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex flex-wrap justify-between items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-2">
                      <span className="uppercase font-semibold text-brand">{m.channel}</span>
                      <span>→</span>
                      {m.contact ? (
                        <span className="text-foreground font-medium">{recipientLabel(m)}</span>
                      ) : null}
                      {m.patients?.full_name && (
                        <span
                          role="link"
                          tabIndex={0}
                          onClick={(e) => { e.stopPropagation(); setHistoryPatientId(m.patient_id); }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              e.stopPropagation();
                              setHistoryPatientId(m.patient_id);
                            }
                          }}
                          className="inline-flex items-center gap-1 text-brand hover:underline cursor-pointer font-medium"
                          title="Ver histórico do paciente"
                        >
                          <History className="h-3 w-3" />
                          {m.contact ? `via ${m.patients.full_name}` : m.patients.full_name}
                        </span>
                      )}
                    </span>
                    <span>{m.sent_at ? new Date(m.sent_at).toLocaleString("pt-BR") : "—"}</span>
                  </div>
                  <div className="mt-1 text-sm line-clamp-2">{m.body}</div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <StatusBadge status={m.status} />
                    <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                      Ver detalhes <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

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