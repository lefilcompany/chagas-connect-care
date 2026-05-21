import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Plus, CheckCircle2, XCircle } from "lucide-react";

export default function PatientDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [patient, setPatient] = useState<any>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [meds, setMeds] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [adherence, setAdherence] = useState<any[]>([]);

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
    setContacts(c.data ?? []);
    setMeds(m.data ?? []);
    setMessages(msg.data ?? []);
    setAdherence(ad.data ?? []);
  };

  useEffect(() => { loadAll(); }, [id]);

  const addContact = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.currentTarget));
    const { error } = await supabase.from("contacts").insert({ patient_id: id, ...fd } as any);
    if (error) return toast.error(error.message);
    toast.success("Contato adicionado");
    (e.target as HTMLFormElement).reset();
    loadAll();
  };

  const addMed = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.currentTarget));
    const { error } = await supabase.from("medications").insert({ patient_id: id, ...fd } as any);
    if (error) return toast.error(error.message);
    toast.success("Medicação adicionada");
    (e.target as HTMLFormElement).reset();
    loadAll();
  };

  const sendMsg = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = String(fd.get("body") ?? "").trim();
    const channel = String(fd.get("channel") ?? "whatsapp");
    const contactId = String(fd.get("contact_id") ?? "");
    if (!body) return toast.error("Mensagem vazia");
    const { error } = await supabase.from("messages").insert({
      patient_id: id,
      contact_id: contactId || null,
      channel,
      body,
      status: "sent",
      sent_at: new Date().toISOString(),
      created_by: user!.id,
    } as any);
    if (error) return toast.error(error.message);
    toast.success(`Mensagem enviada por ${channel.toUpperCase()} (simulado)`);
    (e.target as HTMLFormElement).reset();
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

  return (
    <div className="space-y-6">
      <Link to="/app/pacientes" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-brand">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      <header>
        <h1 className="font-display text-3xl font-bold text-brand">{patient.full_name}</h1>
        <p className="text-muted-foreground mt-1">
          <span className="capitalize">{patient.stage}</span> • {patient.channel_pref.toUpperCase()} • {patient.phone}
        </p>
      </header>

      <Tabs defaultValue="familia">
        <TabsList>
          <TabsTrigger value="familia">Família & Cuidadores</TabsTrigger>
          <TabsTrigger value="medicacao">Medicação</TabsTrigger>
          <TabsTrigger value="mensagens">Mensagens</TabsTrigger>
          <TabsTrigger value="adesao">Adesão</TabsTrigger>
        </TabsList>

        <TabsContent value="familia" className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <h3 className="font-display font-bold text-brand mb-4">Adicionar familiar/cuidador</h3>
            <form onSubmit={addContact} className="grid gap-3 md:grid-cols-5">
              <Input name="full_name" placeholder="Nome" required />
              <Select name="relation" defaultValue="familiar">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="familiar">Familiar</SelectItem>
                  <SelectItem value="cuidador">Cuidador</SelectItem>
                  <SelectItem value="responsavel">Responsável</SelectItem>
                </SelectContent>
              </Select>
              <Input name="phone" placeholder="Telefone" required />
              <Select name="channel_pref" defaultValue="whatsapp">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" variant="hero"><Plus className="h-4 w-4" /> Adicionar</Button>
            </form>
          </div>
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            {contacts.length === 0 ? <div className="p-8 text-center text-muted-foreground">Nenhum contato cadastrado.</div> : (
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground"><tr><th className="p-4">Nome</th><th className="p-4">Relação</th><th className="p-4">Telefone</th><th className="p-4">Canal</th></tr></thead>
                <tbody>{contacts.map((c) => (
                  <tr key={c.id} className="border-t border-border"><td className="p-4 font-medium">{c.full_name}</td><td className="p-4 capitalize">{c.relation}</td><td className="p-4">{c.phone}</td><td className="p-4 uppercase">{c.channel_pref}</td></tr>
                ))}</tbody>
              </table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="medicacao" className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <h3 className="font-display font-bold text-brand mb-4">Nova medicação</h3>
            <form onSubmit={addMed} className="grid gap-3 md:grid-cols-4">
              <Input name="name" placeholder="Ex: Benznidazol" required />
              <Input name="dose" placeholder="Ex: 100mg" />
              <Input name="schedule" placeholder="Ex: 8h, 14h, 20h" />
              <Button type="submit" variant="hero"><Plus className="h-4 w-4" /> Adicionar</Button>
            </form>
          </div>
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            {meds.length === 0 ? <div className="p-8 text-center text-muted-foreground">Nenhuma medicação cadastrada.</div> : (
              <table className="w-full text-sm">
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
        </TabsContent>

        <TabsContent value="mensagens" className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <h3 className="font-display font-bold text-brand mb-4">Enviar mensagem</h3>
            <form onSubmit={sendMsg} className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <Select name="channel" defaultValue={patient.channel_pref}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="whatsapp">WhatsApp</SelectItem><SelectItem value="sms">SMS</SelectItem></SelectContent>
                </Select>
                <Select name="contact_id" defaultValue="">
                  <SelectTrigger><SelectValue placeholder="Destinatário (paciente ou contato)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value=" ">Paciente</SelectItem>
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
                  <div className="flex justify-between text-xs text-muted-foreground"><span className="uppercase font-semibold text-brand">{m.channel}</span><span>{new Date(m.sent_at).toLocaleString("pt-BR")}</span></div>
                  <div className="mt-1 text-sm">{m.body}</div>
                </li>
              ))}</ul>
            )}
          </div>
        </TabsContent>

        <TabsContent value="adesao">
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            {adherence.length === 0 ? <div className="p-8 text-center text-muted-foreground">Sem registros de adesão.</div> : (
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground"><tr><th className="p-4">Quando</th><th className="p-4">Evento</th><th className="p-4">Origem</th></tr></thead>
                <tbody>{adherence.map((a) => (
                  <tr key={a.id} className="border-t border-border"><td className="p-4">{new Date(a.occurred_at).toLocaleString("pt-BR")}</td><td className="p-4 capitalize">{a.event_type}</td><td className="p-4">{a.source}</td></tr>
                ))}</tbody>
              </table>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}