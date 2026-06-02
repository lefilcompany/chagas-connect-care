import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, CheckCircle2, XCircle,
  Users, Pill, MessageSquare, Activity, Phone, Building2,
  Save, Trash2, Check, CheckCheck, Clock,
} from "lucide-react";
import { z } from "zod";
import { queueAndSend } from "@/lib/whatsapp";

function formatPhone(v: string) {
  const digits = v.replace(/\D/g, "");
  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").replace(/[-\s]$/, "");
  }
  return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").replace(/[-\s]$/, "");
}

export default function PatientDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [patient, setPatient] = useState<any>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [meds, setMeds] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [adherence, setAdherence] = useState<any[]>([]);
  const [tab, setTab] = useState<"familia" | "medicacao" | "mensagens" | "adesao">("familia");
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [contactPhone, setContactPhone] = useState("");
  const [medDoseValue, setMedDoseValue] = useState("");
  const [medDoseUnit, setMedDoseUnit] = useState("mg");
  const [msgToDelete, setMsgToDelete] = useState<string | null>(null);

  const loadAll = async () => {
    if (!id) return;
    const [p, c, m, msg, ad] = await Promise.all([
      supabase.from("patients").select("*").eq("id", id).maybeSingle(),
      supabase.from("contacts").select("*").eq("patient_id", id).order("created_at"),
      supabase.from("medications").select("*").eq("patient_id", id).order("created_at"),
      supabase.from("messages").select("*").eq("patient_id", id).order("sent_at", { ascending: false }).limit(50),
      supabase.from("adherence_events").select("*").eq("patient_id", id).order("occurred_at", { ascending: false }).limit(20),
    ]);
    setPatient(p.data);
    if (p.data) setForm({
      full_name: p.data.full_name ?? "",
      stage: p.data.stage ?? "diagnostico",
      channel_pref: p.data.channel_pref ?? "whatsapp",
      phone: p.data.phone ?? "",
      institution: p.data.institution ?? "",
      notes: p.data.notes ?? "",
      email: p.data.email ?? "",
      birth_date: p.data.birth_date ?? "",
      cpf: p.data.cpf ?? "",
      address: p.data.address ?? "",
      city: p.data.city ?? "",
      state: p.data.state ?? "",
      status: p.data.status ?? "ativo",
    });
    setContacts(c.data ?? []);
    setMeds(m.data ?? []);
    setMessages(msg.data ?? []);
    setAdherence(ad.data ?? []);
  };

  useEffect(() => { loadAll(); }, [id]);

  const patientSchema = z.object({
    full_name: z.string().trim().min(2, "Nome muito curto").max(160),
    phone: z.string().trim().min(8, "Telefone inválido").max(20),
    stage: z.enum(["diagnostico", "agudo", "cronico"]),
    channel_pref: z.enum(["whatsapp", "sms"]),
    institution: z.string().trim().max(160),
    notes: z.string().max(2000).optional(),
    email: z.string().trim().email("Email inválido").max(160).or(z.literal("")).optional(),
    birth_date: z.string().optional(),
    cpf: z.string().trim().max(20).optional(),
    address: z.string().trim().max(240).optional(),
    city: z.string().trim().max(120).optional(),
    state: z.string().trim().max(2).optional(),
    status: z.enum(["ativo", "inativo"]).optional(),
  });

  const hasChanges = useMemo(() => {
    if (!patient) return false;
    return (
      (patient.full_name ?? "") !== (form.full_name ?? "") ||
      (patient.stage ?? "diagnostico") !== (form.stage ?? "diagnostico") ||
      (patient.channel_pref ?? "whatsapp") !== (form.channel_pref ?? "whatsapp") ||
      (patient.phone ?? "") !== (form.phone ?? "") ||
      (patient.institution ?? "") !== (form.institution ?? "") ||
      (patient.notes ?? "") !== (form.notes ?? "") ||
      (patient.email ?? "") !== (form.email ?? "") ||
      ((patient.birth_date ?? "") !== (form.birth_date ?? "")) ||
      (patient.cpf ?? "") !== (form.cpf ?? "") ||
      (patient.address ?? "") !== (form.address ?? "") ||
      (patient.city ?? "") !== (form.city ?? "") ||
      (patient.state ?? "") !== (form.state ?? "") ||
      (patient.status ?? "ativo") !== (form.status ?? "ativo")
    );
  }, [patient, form]);

  const savePatient = async () => {
    const parsed = patientSchema.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setSaving(true);
    const payload: any = { ...parsed.data, state: (parsed.data.state ?? "").toUpperCase() };
    if (!payload.birth_date) payload.birth_date = null;
    const { error } = await supabase.from("patients").update(payload).eq("id", id!);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Paciente atualizado");
    loadAll();
  };

  const addContact = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.currentTarget));
    const payload: any = { patient_id: id, ...fd, phone: contactPhone };
    if (!payload.birth_date) payload.birth_date = null;
    if (payload.state) payload.state = String(payload.state).toUpperCase();
    const { error } = await supabase.from("contacts").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Contato adicionado");
    setContactPhone("");
    (e.target as HTMLFormElement).reset();
    loadAll();
  };

  const addMed = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.currentTarget));
    const dose = medDoseValue ? `${medDoseValue} ${medDoseUnit}` : "";
    const { error } = await supabase.from("medications").insert({ patient_id: id, ...fd, dose } as any);
    if (error) return toast.error(error.message);
    toast.success("Medicação adicionada");
    setMedDoseValue("");
    setMedDoseUnit("mg");
    (e.target as HTMLFormElement).reset();
    loadAll();
  };

  const sendMsg = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = String(fd.get("body") ?? "").trim();
    const channel = String(fd.get("channel") ?? "whatsapp");
    const contactId = String(fd.get("contact_id") ?? "").trim();
    if (!body) return toast.error("Mensagem vazia");
    const result = await queueAndSend({
      patient_id: id!,
      contact_id: contactId && contactId !== "patient" ? contactId : null,
      channel: channel as "whatsapp" | "sms",
      body,
      created_by: user!.id,
    });
    (e.target as HTMLFormElement).reset();
    loadAll();
    if (!result.ok) return toast.error(result.error ?? "Falha ao enviar");
    toast.success(`Mensagem enviada por ${channel.toUpperCase()}`);
  };

  const confirmDeleteMsg = async () => {
    if (!msgToDelete) return;
    const { error } = await supabase.from("messages").delete().eq("id", msgToDelete);
    setMsgToDelete(null);
    if (error) return toast.error(error.message);
    toast.success("Mensagem apagada");
    loadAll();
  };

  const logAdherence = async (medication_id: string, event_type: "confirmado" | "perdido") => {
    const { error } = await supabase.from("adherence_events").insert({
      patient_id: id, medication_id, event_type, source: "manual",
    } as any);
    if (error) return toast.error(error.message);
    toast.success("Adesão registrada");
    loadAll();
  };

  if (!patient) return <div className="text-muted-foreground">Carregando...</div>;

  const stageLabels: Record<string, string> = { diagnostico: "Diagnóstico", agudo: "Agudo", cronico: "Crônico" };
  const stageColors: Record<string, string> = {
    diagnostico: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
    agudo: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20",
    cronico: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  };
  const okCount = adherence.filter((a) => a.event_type === "confirmado").length;
  const adhRate = adherence.length ? Math.round((okCount / adherence.length) * 100) : 0;

  const tabs = [
    { v: "familia", label: "Família & Cuidadores", icon: Users, count: contacts.length },
    { v: "medicacao", label: "Medicação", icon: Pill, count: meds.length },
    { v: "mensagens", label: "Mensagens", icon: MessageSquare, count: messages.length },
    { v: "adesao", label: "Adesão", icon: Activity, count: adherence.length },
  ] as const;

  return (
    <div className="space-y-6">
      <Link to="/app/pacientes" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-brand">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      <header className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="font-display text-xl sm:text-2xl font-bold text-brand truncate">
              {patient.full_name || "Paciente"}
            </h2>
            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${stageColors[form.stage] ?? ""}`}>
              {stageLabels[form.stage] ?? form.stage}
            </span>
          </div>
          <Button size="sm" variant="hero" onClick={savePatient} disabled={saving || !hasChanges}>
            <Save className="h-4 w-4" /> {saving ? "Salvando..." : "Salvar alterações"}
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Nome completo</Label>
            <Input value={form.full_name ?? ""} onChange={(e) => setForm({ ...form, full_name: e.target.value })} maxLength={160} />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Telefone</Label>
            <Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })} maxLength={20} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@exemplo.com" maxLength={160} />
          </div>
          <div className="space-y-1.5">
            <Label>Data de nascimento</Label>
            <Input type="date" value={form.birth_date ?? ""} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>CPF</Label>
            <Input value={form.cpf ?? ""} onChange={(e) => setForm({ ...form, cpf: e.target.value })} placeholder="000.000.000-00" maxLength={14} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Endereço</Label>
            <Input value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Rua, número, complemento" maxLength={240} />
          </div>
          <div className="space-y-1.5">
            <Label>Cidade</Label>
            <Input value={form.city ?? ""} onChange={(e) => setForm({ ...form, city: e.target.value })} maxLength={120} />
          </div>
          <div className="space-y-1.5">
            <Label>Estado</Label>
            <Input value={form.state ?? ""} onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })} placeholder="SP" maxLength={2} className="uppercase" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> Instituição</Label>
            <Input value={form.institution ?? ""} onChange={(e) => setForm({ ...form, institution: e.target.value })} maxLength={160} />
          </div>
          <div className="space-y-1.5">
            <Label>Etapa</Label>
            <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="diagnostico">Diagnóstico</SelectItem>
                <SelectItem value="agudo">Agudo</SelectItem>
                <SelectItem value="cronico">Crônico</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Canal preferido</Label>
            <Select value={form.channel_pref} onValueChange={(v) => setForm({ ...form, channel_pref: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Status</Label>
            <Select value={form.status ?? "ativo"} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Observações</Label>
            <textarea
              className="flex min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              value={form.notes ?? ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              maxLength={2000}
            />
          </div>
        </div>
      </header>

      <div className="-mx-1 overflow-x-auto">
        <div className="inline-flex min-w-full sm:min-w-0 rounded-full border border-border bg-card p-1 shadow-sm">
          {tabs.map(({ v, label, icon: Icon, count }) => (
            <button
              key={v}
              onClick={() => setTab(v)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${
                tab === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{label}</span>
              <span className={`ml-1 rounded-full px-1.5 text-[10px] ${tab === v ? "bg-primary-foreground/20" : "bg-muted"}`}>{count}</span>
            </button>
          ))}
        </div>
      </div>

      {tab === "familia" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <div className="mb-5">
              <h3 className="font-display font-bold text-brand text-lg">Adicionar familiar ou cuidador</h3>
              <p className="text-xs text-muted-foreground mt-1">Preencha os dados para enviar lembretes e mensagens a esta pessoa.</p>
            </div>
            <form onSubmit={addContact} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="contact_full_name">Nome completo</Label>
                  <Input id="contact_full_name" name="full_name" placeholder="Ex: Maria Silva" required maxLength={160} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contact_phone">Telefone</Label>
                  <Input
                    id="contact_phone"
                    name="phone"
                    type="tel"
                    placeholder="(11) 99999-0000"
                    required
                    maxLength={20}
                    value={contactPhone}
                    onChange={(e) => setContactPhone(formatPhone(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contact_email">Email</Label>
                  <Input id="contact_email" name="email" type="email" placeholder="email@exemplo.com" maxLength={160} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contact_birth">Data de nascimento</Label>
                  <Input id="contact_birth" name="birth_date" type="date" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contact_cpf">CPF</Label>
                  <Input id="contact_cpf" name="cpf" placeholder="000.000.000-00" maxLength={14} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="contact_address">Endereço</Label>
                  <Input id="contact_address" name="address" placeholder="Rua, número, complemento" maxLength={240} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contact_city">Cidade</Label>
                  <Input id="contact_city" name="city" placeholder="Ex: Recife" maxLength={120} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contact_state">Estado</Label>
                  <Input id="contact_state" name="state" placeholder="SP" maxLength={2} className="uppercase" />
                </div>
                <div className="space-y-1.5">
                  <Label>Relação com o paciente</Label>
                  <Select name="relation" defaultValue="familiar">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="familiar">Familiar</SelectItem>
                      <SelectItem value="cuidador">Cuidador</SelectItem>
                      <SelectItem value="medico">Médico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Canal preferido para mensagens</Label>
                  <Select name="channel_pref" defaultValue="whatsapp">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Status</Label>
                  <Select name="status" defaultValue="ativo">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="inativo">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end pt-2 border-t border-border">
                <Button type="submit" variant="hero"><Plus className="h-4 w-4" /> Adicionar contato</Button>
              </div>
            </form>
          </div>
          <div className="rounded-2xl border border-border bg-card overflow-x-auto">
            {contacts.length === 0 ? <div className="p-8 text-center text-muted-foreground">Nenhum contato cadastrado.</div> : (
              <table className="w-full text-sm min-w-[560px]">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground"><tr><th className="p-4">Nome</th><th className="p-4">Relação</th><th className="p-4">Telefone</th><th className="p-4">Canal</th></tr></thead>
                <tbody>{contacts.map((c) => (
                  <tr key={c.id} className="border-t border-border"><td className="p-4 font-medium">{c.full_name}</td><td className="p-4 capitalize">{c.relation}</td><td className="p-4">{c.phone}</td><td className="p-4 uppercase">{c.channel_pref}</td></tr>
                ))}</tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === "medicacao" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <h3 className="font-display font-bold text-brand mb-4">Nova medicação</h3>
            <form onSubmit={addMed} className="grid gap-4 sm:grid-cols-2 md:grid-cols-5">
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="med_name">Medicamento</Label>
                <Input id="med_name" name="name" placeholder="Ex: Benznidazol" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="med_dose_value">Dose</Label>
                <Input id="med_dose_value" type="number" min="0" step="any" placeholder="Ex: 100" value={medDoseValue} onChange={(e) => setMedDoseValue(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="med_dose_unit">Unidade</Label>
                <Select value={medDoseUnit} onValueChange={(v) => setMedDoseUnit(v)}>
                  <SelectTrigger id="med_dose_unit"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mg">mg</SelectItem>
                    <SelectItem value="g">g</SelectItem>
                    <SelectItem value="mcg">mcg</SelectItem>
                    <SelectItem value="mL">mL</SelectItem>
                    <SelectItem value="UI">UI</SelectItem>
                    <SelectItem value="comprimido">comprimido</SelectItem>
                    <SelectItem value="cápsula">cápsula</SelectItem>
                    <SelectItem value="gotas">gotas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="med_schedule">Horários</Label>
                <Input id="med_schedule" name="schedule" placeholder="Ex: 8h, 14h, 20h" />
              </div>
              <div className="flex items-end md:col-span-5">
                <Button type="submit" variant="hero" className="w-full sm:w-auto"><Plus className="h-4 w-4" /> Adicionar medicação</Button>
              </div>
            </form>
          </div>
          <div className="rounded-2xl border border-border bg-card overflow-x-auto">
            {meds.length === 0 ? <div className="p-8 text-center text-muted-foreground">Nenhuma medicação cadastrada.</div> : (
              <table className="w-full text-sm min-w-[640px]">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground"><tr><th className="p-4">Medicamento</th><th className="p-4">Dose</th><th className="p-4">Horários</th><th className="p-4">Adesão</th></tr></thead>
                <tbody>{meds.map((m) => (
                  <tr key={m.id} className="border-t border-border">
                    <td className="p-4 font-medium">{m.name}</td><td className="p-4">{m.dose}</td><td className="p-4">{m.schedule}</td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => logAdherence(m.id, "confirmado")}><CheckCircle2 className="h-4 w-4" /> Tomou</Button>
                        <Button size="sm" variant="outline" onClick={() => logAdherence(m.id, "perdido")}><XCircle className="h-4 w-4" /> Faltou</Button>
                      </div>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === "mensagens" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <h3 className="font-display font-bold text-brand mb-4">Enviar mensagem</h3>
            <form onSubmit={sendMsg} className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <Select name="channel" defaultValue={patient.channel_pref}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="whatsapp">WhatsApp</SelectItem><SelectItem value="sms">SMS</SelectItem></SelectContent>
                </Select>
                <Select name="contact_id" defaultValue="patient">
                  <SelectTrigger><SelectValue placeholder="Destinatário (paciente ou contato)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="patient">Paciente</SelectItem>
                    {contacts.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name} ({c.relation})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Input name="body" placeholder="Escreva a mensagem..." maxLength={1000} required />
              <Button type="submit" variant="hero">Enviar (simulado)</Button>
            </form>
          </div>
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            {messages.length === 0 ? <div className="p-8 text-center text-muted-foreground">Nenhuma mensagem ainda.</div> : (
              <ul className="divide-y divide-border">{messages.map((m) => (
                <li key={m.id} className="p-4">
                  <div className="flex justify-between items-center text-xs text-muted-foreground gap-2">
                    <span className="uppercase font-semibold text-brand">{m.channel}</span>
                    <div className="flex items-center gap-2">
                      <span>{new Date(m.sent_at).toLocaleString("pt-BR")}</span>
                      <button
                        type="button"
                        onClick={() => setMsgToDelete(m.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                        aria-label="Apagar mensagem"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-1 text-sm">{m.body}</div>
                  <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                    {(m.status === "enviado" || m.status === "sent") && <><Check className="h-3 w-3" /> Enviado</>}
                    {(m.status === "entregue" || m.status === "delivered") && <><CheckCheck className="h-3 w-3" /> Entregue</>}
                    {(m.status === "lido" || m.status === "read") && <><CheckCheck className="h-3 w-3 text-sky-500" /> <span className="text-sky-500">Lido</span></>}
                    {(m.status === "pendente" || m.status === "pending" || m.status === "queued") && <><Clock className="h-3 w-3" /> Pendente</>}
                    {(m.status === "falhou" || m.status === "failed" || m.status === "error") && <><Clock className="h-3 w-3 text-destructive" /> <span className="text-destructive">Falhou</span></>}
                    {!["enviado","sent","entregue","delivered","lido","read","pendente","pending","queued","falhou","failed","error"].includes(m.status) && <><Clock className="h-3 w-3" /> {m.status}</>}
                  </div>
                </li>
              ))}</ul>
            )}
          </div>
        </div>
      )}

      {tab === "adesao" && (
        <div>
          <div className="rounded-2xl border border-border bg-card overflow-x-auto">
            {adherence.length === 0 ? <div className="p-8 text-center text-muted-foreground">Sem registros de adesão.</div> : (
              <table className="w-full text-sm min-w-[480px]">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground"><tr><th className="p-4">Quando</th><th className="p-4">Evento</th><th className="p-4">Origem</th></tr></thead>
                <tbody>{adherence.map((a) => (
                  <tr key={a.id} className="border-t border-border"><td className="p-4">{new Date(a.occurred_at).toLocaleString("pt-BR")}</td><td className="p-4 capitalize">{a.event_type}</td><td className="p-4">{a.source}</td></tr>
                ))}</tbody>
              </table>
            )}
          </div>
        </div>
      )}

      <AlertDialog open={!!msgToDelete} onOpenChange={(o) => !o && setMsgToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar esta mensagem?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A mensagem será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteMsg} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}