import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchers, qk } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CepAddressFields } from "@/components/app/CepAddressFields";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import {
  Plus, Search, Pill, Users, Stethoscope, LayoutGrid, List,
  Phone, ArrowRight, Trash2, ChevronDown, ChevronUp,
} from "lucide-react";
import { z } from "zod";
import { Skeleton } from "@/components/ui/skeleton";

type Patient = {
  id: string; full_name: string; stage: string; phone: string;
  channel_pref: string;
};

const schema = z.object({
  full_name: z.string().trim().min(2).max(160),
  phone: z.string().trim().regex(/^\(\d{2}\) \d{4,5}-\d{4}$/, "Telefone deve ter 10 ou 11 dígitos"),
  stage: z.enum(["diagnostico", "agudo", "cronico"]),
  channel_pref: z.enum(["whatsapp", "sms"]),
  notes: z.string().max(2000).optional(),
  email: z.string().trim().email("Email inválido").max(160).or(z.literal("")).optional(),
  birth_date: z.string().optional(),
  cpf: z.string().trim().max(20).optional(),
  address: z.string().trim().max(240).optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(2).optional(),
  status: z.enum(["ativo", "inativo"]).optional(),
});

const contactSchema = z.object({
  full_name: z.string().trim().min(2).max(160),
  phone: z.string().trim().regex(/^\(\d{2}\) \d{4,5}-\d{4}$/, "Telefone deve ter 10 ou 11 dígitos"),
  channel_pref: z.enum(["whatsapp", "sms"]),
  email: z.string().trim().email("Email inválido").max(160).or(z.literal("")).optional(),
  birth_date: z.string().optional(),
  cpf: z.string().trim().max(20).optional(),
  address: z.string().trim().max(240).optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(2).optional(),
  status: z.enum(["ativo", "inativo"]).optional(),
});

const medicationSchema = z.object({
  name: z.string().trim().min(1).max(160),
  dose_value: z.string().optional(),
  schedule: z.string().optional(),
});

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

export default function Patients() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: items = [] } = useQuery({ queryKey: qk.patients, queryFn: fetchers.patients as () => Promise<Patient[]> });
  const { isLoading: patientsLoading } = useQuery({ queryKey: qk.patients, queryFn: fetchers.patients as () => Promise<Patient[]> });
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"table" | "cards">("table");
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : true,
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  const effectiveView: "table" | "cards" = isDesktop ? view : "cards";
  const [stageFilter, setStageFilter] = useState<"todos" | "diagnostico" | "agudo" | "cronico">("todos");
  const [medOpen, setMedOpen] = useState<Patient | null>(null);
  const [medDoseUnit, setMedDoseUnit] = useState("mg");
  const [contactOpen, setContactOpen] = useState<{ p: Patient; relation: "familiar" | "cuidador" | "medico" } | null>(null);
  const [contactIndex, setContactIndex] = useState(0);
  const [medIndex, setMedIndex] = useState(0);
  const [contactDir, setContactDir] = useState<1 | -1>(1);
  const [medDir, setMedDir] = useState<1 | -1>(1);

  const [contactForm, setContactForm] = useState({
    full_name: "", phone: "", channel_pref: "whatsapp",
    email: "", birth_date: "", cpf: "", address: "", city: "", state: "", status: "ativo",
  });
  const [medForm, setMedForm] = useState({ name: "", dose_value: "", schedule: "" });

  const { data: medList = [] } = useQuery({
    queryKey: ["medications", medOpen?.id],
    enabled: !!medOpen,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medications")
        .select("id, name, dose, schedule, created_at")
        .eq("patient_id", medOpen!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: contactList = [] } = useQuery({
    queryKey: ["contacts", contactOpen?.p.id, contactOpen?.relation],
    enabled: !!contactOpen,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, full_name, phone, channel_pref, created_at")
        .eq("patient_id", contactOpen!.p.id)
        .eq("relation", contactOpen!.relation)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const removeMedication = async (id: string) => {
    if (!medOpen) return;
    const { error } = await supabase.from("medications").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Medicação removida");
    queryClient.invalidateQueries({ queryKey: ["medications", medOpen.id] });
  };

  const removeContact = async (id: string) => {
    if (!contactOpen) return;
    const { error } = await supabase.from("contacts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Contato removido");
    queryClient.invalidateQueries({ queryKey: ["contacts", contactOpen.p.id, contactOpen.relation] });
  };


  useEffect(() => {
    setContactIndex(0);
  }, [contactOpen?.p.id, contactOpen?.relation]);

  useEffect(() => {
    setMedIndex(0);
  }, [medOpen?.id]);

  useEffect(() => {
    if (contactIndex >= contactList.length) setContactIndex(Math.max(0, contactList.length - 1));
  }, [contactList.length, contactIndex]);

  useEffect(() => {
    if (medIndex >= medList.length) setMedIndex(Math.max(0, medList.length - 1));
  }, [medList.length, medIndex]);

  useEffect(() => {
    if (medOpen) setMedForm({ name: "", dose_value: "", schedule: "" });
  }, [medOpen]);

  useEffect(() => {
    if (contactOpen) setContactForm({
      full_name: "", phone: "", channel_pref: "whatsapp",
      email: "", birth_date: "", cpf: "", address: "", city: "", state: "", status: "ativo",
    });
  }, [contactOpen]);

  const onCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.currentTarget));
    const parsed = schema.safeParse(fd);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    const { error } = await supabase.from("patients").insert({
      full_name: parsed.data.full_name,
      phone: parsed.data.phone,
      stage: parsed.data.stage,
      channel_pref: parsed.data.channel_pref,
      notes: parsed.data.notes ?? "",
      owner_id: user!.id,
      email: parsed.data.email ?? "",
      birth_date: parsed.data.birth_date || null,
      cpf: parsed.data.cpf ?? "",
      address: parsed.data.address ?? "",
      city: parsed.data.city ?? "",
      state: (parsed.data.state ?? "").toUpperCase(),
      status: parsed.data.status ?? "ativo",
    });
    if (error) return toast.error(error.message);
    toast.success("Paciente cadastrado");
    setOpen(false);
    queryClient.invalidateQueries({ queryKey: qk.patients });
    queryClient.invalidateQueries({ queryKey: qk.dashboard });
  };

  const filtered = useMemo(
    () => items.filter((p) =>
      p.full_name.toLowerCase().includes(q.toLowerCase()) &&
      (stageFilter === "todos" || p.stage === stageFilter)
    ),
    [items, q, stageFilter],
  );

  const addMedication = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!medOpen) return;
    const parsed = medicationSchema.safeParse(medForm);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    const dose = medForm.dose_value ? `${medForm.dose_value} ${medDoseUnit}` : "";
    const { error } = await supabase
      .from("medications")
      .insert({ patient_id: medOpen.id, name: parsed.data.name, dose, schedule: medForm.schedule || "" } as any);
    if (error) return toast.error(error.message);
    toast.success(`Medicação adicionada para ${medOpen.full_name}`);
    setMedDoseUnit("mg");
    setMedForm({ name: "", dose_value: "", schedule: "" });
    await queryClient.invalidateQueries({ queryKey: ["medications", medOpen.id] });
  };

  const addContact = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!contactOpen) return;
    const parsed = contactSchema.safeParse(contactForm);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    const { error } = await supabase.from("contacts").insert({
      patient_id: contactOpen.p.id,
      relation: contactOpen.relation,
      full_name: parsed.data.full_name,
      phone: parsed.data.phone,
      channel_pref: parsed.data.channel_pref,
      email: parsed.data.email ?? "",
      birth_date: parsed.data.birth_date || null,
      cpf: parsed.data.cpf ?? "",
      address: parsed.data.address ?? "",
      city: parsed.data.city ?? "",
      state: (parsed.data.state ?? "").toUpperCase(),
      status: parsed.data.status ?? "ativo",
    } as any);
    if (error) return toast.error(error.message);
    toast.success("Contato adicionado");
    setContactForm({
      full_name: "", phone: "", channel_pref: "whatsapp",
      email: "", birth_date: "", cpf: "", address: "", city: "", state: "", status: "ativo",
    });
    await queryClient.invalidateQueries({ queryKey: ["contacts", contactOpen.p.id, contactOpen.relation] });
  };

  const stageLabels: Record<string, string> = {
    diagnostico: "Diagnóstico",
    agudo: "Agudo",
    cronico: "Crônico",
  };
  const stageColors: Record<string, string> = {
    diagnostico: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
    agudo: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20",
    cronico: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  };

  const QuickActions = ({ p }: { p: Patient }) => (
    <TooltipProvider delayDuration={150}>
      <div className="grid grid-cols-4 gap-1.5 rounded-xl border border-border bg-muted/30 p-1.5">
        {[
          { key: "med", icon: Pill, label: "Medicação", tone: "text-emerald-600 dark:text-emerald-400", onClick: () => setMedOpen(p) },
          { key: "fam", icon: Users, label: "Familiar", tone: "text-blue-600 dark:text-blue-400", onClick: () => setContactOpen({ p, relation: "familiar" }) },
          { key: "cui", icon: Users, label: "Cuidador", tone: "text-amber-600 dark:text-amber-400", onClick: () => setContactOpen({ p, relation: "cuidador" }) },
          { key: "med2", icon: Stethoscope, label: "Médico", tone: "text-rose-600 dark:text-rose-400", onClick: () => setContactOpen({ p, relation: "medico" }) },
        ].map(({ key, icon: Icon, label, tone, onClick }) => (
          <Tooltip key={key}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onClick}
                aria-label={label}
                className="group inline-flex flex-col items-center justify-center gap-0.5 rounded-lg bg-card px-1 py-1.5 text-[10px] font-medium text-muted-foreground transition-all hover:bg-background hover:text-foreground hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Icon className={`h-4 w-4 ${tone} transition-transform group-hover:scale-110`} />
                <span className="leading-none truncate max-w-full">{label}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">Adicionar {label.toLowerCase()}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold text-brand">Pacientes</h1>
          <p className="text-muted-foreground mt-1">Pacientes, famílias e cuidadores acompanhados pela sua equipe.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="hero"><Plus className="h-4 w-4" /> Novo paciente</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Cadastrar paciente</DialogTitle></DialogHeader>
            <form onSubmit={onCreate} className="space-y-4">
              <div className="space-y-2"><Label>Nome completo *</Label><Input name="full_name" placeholder="Ex: Maria da Silva" required /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Telefone *</Label><Input name="phone" type="tel" placeholder="(81) 99999-9999" required maxLength={15} onInput={(e) => { e.currentTarget.value = formatPhone(e.currentTarget.value); }} /></div>
                <div className="space-y-2"><Label>Email</Label><Input name="email" type="email" placeholder="email@exemplo.com" /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Data de nascimento</Label><Input name="birth_date" type="date" /></div>
                <div className="space-y-2"><Label>CPF</Label><Input name="cpf" placeholder="000.000.000-00" maxLength={14} /></div>
              </div>
              <CepAddressFields />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                <div className="space-y-2"><Label>Canal preferido</Label>
                  <Select name="channel_pref" defaultValue="whatsapp">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Status</Label>
                  <Select name="status" defaultValue="ativo">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="inativo">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2"><Label>Observações</Label><Input name="notes" placeholder="Ex: Alergia a penicilina" /></div>
              <Button type="submit" variant="hero" className="w-full">Cadastrar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar paciente..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={stageFilter} onValueChange={(v) => setStageFilter(v as typeof stageFilter)}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as etapas</SelectItem>
            <SelectItem value="diagnostico">Diagnóstico</SelectItem>
            <SelectItem value="agudo">Agudo</SelectItem>
            <SelectItem value="cronico">Crônico</SelectItem>
          </SelectContent>
        </Select>
        {isDesktop && <div className="ml-auto inline-flex rounded-full border border-border bg-card p-1">
          {[
            { v: "table", icon: List, label: "Tabela" },
            { v: "cards", icon: LayoutGrid, label: "Cards" },
          ].map(({ v, icon: Icon, label }) => (
            <button
              key={v}
              onClick={() => setView(v as typeof view)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
              aria-label={label}
            >
              <Icon className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>}
      </div>

      {patientsLoading && items.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card shadow-card p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/4" />
              </div>
              <Skeleton className="h-8 w-40 rounded-xl" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground shadow-card">
          Nenhum paciente encontrado.
        </div>
      ) : effectiveView === "table" ? (
        <div className="rounded-2xl border border-border bg-card shadow-card overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-4">Nome</th>
                <th className="p-4">Etapa</th>
                <th className="p-4">Canal</th>
                <th className="p-4">Telefone</th>
                <th className="p-4">Atalhos</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-t border-border hover:bg-muted/30">
                  <td className="p-4">
                    <Link to={`/app/pacientes/${p.id}`} className="font-medium text-brand hover:underline">{p.full_name}</Link>
                  </td>
                  <td className="p-4">
                    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${stageColors[p.stage] ?? ""}`}>
                      {stageLabels[p.stage] ?? p.stage}
                    </span>
                  </td>
                  <td className="p-4 uppercase text-xs">{p.channel_pref}</td>
                  <td className="p-4 text-xs">{p.phone}</td>
                  <td className="p-4"><QuickActions p={p} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <Link
              key={p.id}
              to={`/app/pacientes/${p.id}`}
              className="rounded-2xl border border-border bg-card p-5 shadow-card flex flex-col gap-3 cursor-pointer hover:shadow-lg hover:border-primary/30 transition-all group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="font-display font-bold text-brand group-hover:underline truncate block">
                    {p.full_name}
                  </span>
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${stageColors[p.stage] ?? ""}`}>
                  {stageLabels[p.stage] ?? p.stage}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Phone className="h-3.5 w-3.5" /> {p.phone || "—"}
                <span className="uppercase ml-auto">{p.channel_pref}</span>
              </div>
              <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                <QuickActions p={p} />
              </div>
              <span className="mt-auto inline-flex items-center gap-1.5 text-xs font-semibold text-brand group-hover:underline">
                Ver detalhes <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          ))}
        </div>
      )}

      {/* Medication dialog */}
      <Dialog open={!!medOpen} onOpenChange={(o) => !o && setMedOpen(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Medicações {medOpen ? `— ${medOpen.full_name}` : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {medList.length === 0 ? (
              <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground text-center">
                Nenhuma medicação cadastrada.
              </div>
            ) : (
              <div className="flex items-stretch gap-2">
                <div className="flex-1 rounded-xl border border-border bg-muted/30 overflow-hidden">
                  <div className="px-4 pt-2 flex items-center justify-between">
                    <div className="text-xs font-semibold uppercase text-muted-foreground">
                      Cadastradas
                    </div>
                    <div className="text-[11px] text-muted-foreground tabular-nums">
                      {Math.min(medIndex + 1, medList.length)} / {medList.length}
                    </div>
                  </div>
                  <div className="relative h-[64px] overflow-hidden">
                    <div
                      key={medList[medIndex]?.id ?? medIndex}
                      className={`absolute inset-0 flex items-center gap-3 p-3 ${medDir === 1 ? "animate-slide-in-down" : "animate-slide-in-up"}`}
                    >
                      <Pill className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{medList[medIndex]?.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {[medList[medIndex]?.dose, medList[medIndex]?.schedule].filter(Boolean).join(" · ") || "—"}
                        </div>
                      </div>
                      <button type="button" onClick={() => removeMedication(medList[medIndex]?.id)} aria-label="Remover" className="rounded-md p-1.5 text-muted-foreground hover:bg-background hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    disabled={medList.length < 2}
                    onClick={() => { setMedDir(-1); setMedIndex((i) => (i - 1 + medList.length) % medList.length); }}
                    aria-label="Anterior"
                    className="flex-1 rounded-xl border border-border bg-muted/30 px-2 hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronUp className="h-4 w-4 text-muted-foreground mx-auto" />
                  </button>
                  <button
                    type="button"
                    disabled={medList.length < 2}
                    onClick={() => { setMedDir(1); setMedIndex((i) => (i + 1) % medList.length); }}
                    aria-label="Próximo"
                    className="flex-1 rounded-xl border border-border bg-muted/30 px-2 hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronDown className="h-4 w-4 text-muted-foreground mx-auto" />
                  </button>
                </div>
              </div>
            )}
          </div>
          <form onSubmit={addMedication} className="space-y-4 pt-2 border-t border-border">
            <div className="space-y-1.5">
              <Label htmlFor="med_name_dlg">Medicamento</Label>
              <Input id="med_name_dlg" value={medForm.name} onChange={(e) => setMedForm((s) => ({ ...s, name: e.target.value }))} placeholder="Ex: Benznidazol" required />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="med_dose_value_dlg">Dose</Label>
                <Input id="med_dose_value_dlg" value={medForm.dose_value} onChange={(e) => setMedForm((s) => ({ ...s, dose_value: e.target.value }))} type="number" min="0" step="any" placeholder="Ex: 100" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="med_dose_unit_dlg">Unidade</Label>
                <Select value={medDoseUnit} onValueChange={setMedDoseUnit}>
                  <SelectTrigger id="med_dose_unit_dlg"><SelectValue /></SelectTrigger>
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
                <Label htmlFor="med_schedule_dlg">Horários</Label>
                <Input id="med_schedule_dlg" value={medForm.schedule} onChange={(e) => setMedForm((s) => ({ ...s, schedule: e.target.value }))} placeholder="Ex: 8h, 14h, 20h" />
              </div>
            </div>
            <Button type="submit" variant="hero" className="w-full" disabled={!medicationSchema.safeParse(medForm).success}>Adicionar medicação</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Contact dialog */}
      <Dialog open={!!contactOpen} onOpenChange={(o) => !o && setContactOpen(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {contactOpen?.relation === "familiar" && "Familiares"}
              {contactOpen?.relation === "cuidador" && "Cuidadores"}
              {contactOpen?.relation === "medico" && "Médicos"}
              {contactOpen ? ` — ${contactOpen.p.full_name}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {contactList.length === 0 ? (
              <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground text-center">
                Nenhum contato cadastrado.
              </div>
            ) : (
              <div className="flex items-stretch gap-2">
                <div className="flex-1 rounded-xl border border-border bg-muted/30 overflow-hidden">
                  <div className="px-4 pt-2 flex items-center justify-between">
                    <div className="text-xs font-semibold uppercase text-muted-foreground">
                      Cadastrados
                    </div>
                    <div className="text-[11px] text-muted-foreground tabular-nums">
                      {Math.min(contactIndex + 1, contactList.length)} / {contactList.length}
                    </div>
                  </div>
                  <div className="relative h-[64px] overflow-hidden">
                    <div
                      key={contactList[contactIndex]?.id ?? contactIndex}
                      className={`absolute inset-0 flex items-center gap-3 p-3 ${contactDir === 1 ? "animate-slide-in-down" : "animate-slide-in-up"}`}
                    >
                      {contactOpen?.relation === "medico"
                        ? <Stethoscope className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
                        : <Users className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{contactList[contactIndex]?.full_name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {contactList[contactIndex]?.phone} · <span className="uppercase">{contactList[contactIndex]?.channel_pref}</span>
                        </div>
                      </div>
                      <button type="button" onClick={() => removeContact(contactList[contactIndex]?.id)} aria-label="Remover" className="rounded-md p-1.5 text-muted-foreground hover:bg-background hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    disabled={contactList.length < 2}
                    onClick={() => { setContactDir(-1); setContactIndex((i) => (i - 1 + contactList.length) % contactList.length); }}
                    aria-label="Anterior"
                    className="flex-1 rounded-xl border border-border bg-muted/30 px-2 hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronUp className="h-4 w-4 text-muted-foreground mx-auto" />
                  </button>
                  <button
                    type="button"
                    disabled={contactList.length < 2}
                    onClick={() => { setContactDir(1); setContactIndex((i) => (i + 1) % contactList.length); }}
                    aria-label="Próximo"
                    className="flex-1 rounded-xl border border-border bg-muted/30 px-2 hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronDown className="h-4 w-4 text-muted-foreground mx-auto" />
                  </button>
                </div>
              </div>
            )}
          </div>
          <form onSubmit={addContact} className="space-y-3 pt-2 border-t border-border">
            <div className="space-y-2"><Label>Nome completo *</Label><Input value={contactForm.full_name} onChange={(e) => setContactForm((s) => ({ ...s, full_name: e.target.value }))} placeholder="Ex: João da Silva" required /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Telefone *</Label><Input value={contactForm.phone} onChange={(e) => setContactForm((s) => ({ ...s, phone: formatPhone(e.target.value) }))} type="tel" placeholder="(81) 99999-9999" required maxLength={15} /></div>
              <div className="space-y-2"><Label>Email</Label><Input value={contactForm.email} onChange={(e) => setContactForm((s) => ({ ...s, email: e.target.value }))} type="email" placeholder="email@exemplo.com" /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Data de nascimento</Label><Input value={contactForm.birth_date} onChange={(e) => setContactForm((s) => ({ ...s, birth_date: e.target.value }))} type="date" /></div>
              <div className="space-y-2"><Label>CPF</Label><Input value={contactForm.cpf} onChange={(e) => setContactForm((s) => ({ ...s, cpf: e.target.value }))} placeholder="000.000.000-00" maxLength={14} /></div>
            </div>
            <div className="space-y-2"><Label>Endereço</Label><Input value={contactForm.address} onChange={(e) => setContactForm((s) => ({ ...s, address: e.target.value }))} placeholder="Rua, número, complemento" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-3">
              <div className="space-y-2"><Label>Cidade</Label><Input value={contactForm.city} onChange={(e) => setContactForm((s) => ({ ...s, city: e.target.value }))} placeholder="Ex: Recife" /></div>
              <div className="space-y-2"><Label>Estado</Label><Input value={contactForm.state} onChange={(e) => setContactForm((s) => ({ ...s, state: e.target.value.toUpperCase() }))} placeholder="SP" maxLength={2} className="uppercase" /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Canal</Label>
                <Select value={contactForm.channel_pref} onValueChange={(v) => setContactForm((s) => ({ ...s, channel_pref: v as "whatsapp" | "sms" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Status</Label>
                <Select value={contactForm.status} onValueChange={(v) => setContactForm((s) => ({ ...s, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" variant="hero" className="w-full" disabled={!contactSchema.safeParse(contactForm).success}>Adicionar</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}