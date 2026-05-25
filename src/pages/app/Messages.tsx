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
  Send, Search, Plus, UserPlus, RefreshCw, Check, CheckCheck, Clock, ArrowRight,
} from "lucide-react";
import { User, Phone, MessageSquare } from "lucide-react";

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
    const { error } = await supabase.from("messages").insert({
      patient_id: sendPatientId,
      contact_id: contactId,
      channel: sendChannel as any,
      body: sendBody.trim(),
      direction: "outbound",
      status: "enviado",
      sent_at: new Date().toISOString(),
      created_by: user?.id,
    } as any);
    setSending(false);
    if (error) return toast.error(error.message);
    toast.success("Mensagem disparada");
    setSendOpen(false);
    setSendBody("");
    setSendRecipient("patient");
    qc.invalidateQueries({ queryKey: qk.messages });
    qc.invalidateQueries({ queryKey: qk.dashboard });
  };

  const resendMessage = async (m: any) => {
    const { error } = await supabase.from("messages").insert({
      patient_id: m.patient_id,
      contact_id: m.contact_id,
      channel: m.channel,
      body: m.body,
      direction: "outbound",
      status: "enviado",
      sent_at: new Date().toISOString(),
      created_by: user?.id,
    } as any);
    if (error) return toast.error(error.message);
    toast.success("Mensagem reenviada");
    setDetail(null);
    qc.invalidateQueries({ queryKey: qk.messages });
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
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold text-brand">Mensagens</h1>
          <p className="text-muted-foreground mt-1">
            Histórico de comunicações enviadas a pacientes, famílias e cuidadores.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setNewPatientOpen(true)}>
            <UserPlus className="h-4 w-4" /> Novo paciente
          </Button>
          <Button variant="hero" onClick={() => setSendOpen(true)}>
            <Send className="h-4 w-4" /> Disparar mensagem
          </Button>
        </div>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por texto, paciente ou contato..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={patientFilter} onValueChange={setPatientFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os pacientes</SelectItem>
            {patients.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={channelFilter} onValueChange={setChannelFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os canais</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
            <SelectItem value="sms">SMS</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="enviado">Enviado</SelectItem>
            <SelectItem value="entregue">Entregue</SelectItem>
            <SelectItem value="lido">Lido</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="falhou">Falhou</SelectItem>
          </SelectContent>
        </Select>
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
                      <span className="text-foreground font-medium">{recipientLabel(m)}</span>
                      {m.contact && (
                        <span className="text-muted-foreground">
                          via {m.patients?.full_name}
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
    </div>
  );
}