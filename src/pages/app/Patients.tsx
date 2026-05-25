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
import { toast } from "sonner";
import { Link } from "react-router-dom";
import {
  Plus, Search, Pill, Users, Stethoscope, LayoutGrid, List,
  Phone, ArrowRight, Trash2, ChevronDown, ChevronUp,
} from "lucide-react";
import { z } from "zod";

type Patient = {
  id: string; full_name: string; stage: string; phone: string;
  channel_pref: string; institution: string;
};

const schema = z.object({
  full_name: z.string().trim().min(2).max(160),
  phone: z.string().trim().min(8).max(20),
  stage: z.enum(["diagnostico", "agudo", "cronico"]),
  channel_pref: z.enum(["whatsapp", "sms"]),
  institution: z.string().trim().max(160),
  notes: z.string().max(2000).optional(),
});

export default function Patients() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: items = [] } = useQuery({ queryKey: qk.patients, queryFn: fetchers.patients as () => Promise<Patient[]> });
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [institution, setInstitution] = useState("");
  const [view, setView] = useState<"table" | "cards">("cards");
  const [stageFilter, setStageFilter] = useState<"todos" | "diagnostico" | "agudo" | "cronico">("todos");
  const [medOpen, setMedOpen] = useState<Patient | null>(null);
  const [medDoseUnit, setMedDoseUnit] = useState("mg");
  const [contactOpen, setContactOpen] = useState<{ p: Patient; relation: "familiar" | "cuidador" | "medico" } | null>(null);

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
    if (user) supabase.from("profiles").select("institution").eq("id", user.id).maybeSingle().then(({ data }) => setInstitution(data?.institution ?? ""));
  }, [user]);

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
      institution: parsed.data.institution || institution,
      owner_id: user!.id,
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
    const form = e.currentTarget;
    const fd = new FormData(form);
    const name = String(fd.get("name") || "").trim();
    const doseValue = String(fd.get("dose_value") || "").trim();
    const schedule = String(fd.get("schedule") || "").trim();
    const dose = doseValue ? `${doseValue} ${medDoseUnit}` : "";
    const { error } = await supabase
      .from("medications")
      .insert({ patient_id: medOpen.id, name, dose, schedule } as any);
    if (error) return toast.error(error.message);
    toast.success(`Medicação adicionada para ${medOpen.full_name}`);
    setMedDoseUnit("mg");
    form.reset();
    await queryClient.invalidateQueries({ queryKey: ["medications", medOpen.id] });
  };

  const addContact = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!contactOpen) return;
    const form = e.currentTarget;
    const fd = Object.fromEntries(new FormData(form));
    const { error } = await supabase.from("contacts").insert({
      patient_id: contactOpen.p.id,
      relation: contactOpen.relation,
      ...fd,
    } as any);
    if (error) return toast.error(error.message);
    toast.success("Contato adicionado");
    form.reset();
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
          <DialogContent>
            <DialogHeader><DialogTitle>Cadastrar paciente</DialogTitle></DialogHeader>
            <form onSubmit={onCreate} className="space-y-4">
              <div className="space-y-2"><Label>Nome completo</Label><Input name="full_name" required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Telefone</Label><Input name="phone" placeholder="(81) 9..." required /></div>
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
                <div className="space-y-2"><Label>Canal preferido</Label>
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
              <div className="space-y-2"><Label>Observações</Label><Input name="notes" /></div>
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
        <div className="ml-auto inline-flex rounded-full border border-border bg-card p-1">
          {[
            { v: "cards", icon: LayoutGrid, label: "Cards" },
            { v: "table", icon: List, label: "Tabela" },
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
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground shadow-card">
          Nenhum paciente encontrado.
        </div>
      ) : view === "table" ? (
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
                    <div className="text-xs text-muted-foreground">{p.institution}</div>
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
                  <div className="text-xs text-muted-foreground truncate">{p.institution || "—"}</div>
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
            <div className="text-xs font-semibold uppercase text-muted-foreground">
              Cadastradas ({medList.length})
            </div>
            <div className="max-h-48 overflow-y-auto rounded-xl border border-border bg-muted/30 divide-y divide-border">
              {medList.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground text-center">Nenhuma medicação cadastrada.</div>
              ) : medList.map((m: any) => (
                <div key={m.id} className="flex items-center gap-3 p-3">
                  <Pill className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{m.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {[m.dose, m.schedule].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </div>
                  <button type="button" onClick={() => removeMedication(m.id)} aria-label="Remover" className="rounded-md p-1.5 text-muted-foreground hover:bg-background hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
          <form onSubmit={addMedication} className="space-y-4 pt-2 border-t border-border">
            <div className="space-y-1.5">
              <Label htmlFor="med_name_dlg">Medicamento</Label>
              <Input id="med_name_dlg" name="name" placeholder="Ex: Benznidazol" required />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="med_dose_value_dlg">Dose</Label>
                <Input id="med_dose_value_dlg" name="dose_value" type="number" min="0" step="any" placeholder="Ex: 100" />
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
                <Input id="med_schedule_dlg" name="schedule" placeholder="Ex: 8h, 14h, 20h" />
              </div>
            </div>
            <Button type="submit" variant="hero" className="w-full">Adicionar medicação</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Contact dialog */}
      <Dialog open={!!contactOpen} onOpenChange={(o) => !o && setContactOpen(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {contactOpen?.relation === "familiar" && "Familiares"}
              {contactOpen?.relation === "cuidador" && "Cuidadores"}
              {contactOpen?.relation === "medico" && "Médicos"}
              {contactOpen ? ` — ${contactOpen.p.full_name}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted-foreground">
              Cadastrados ({contactList.length})
            </div>
            <div className="max-h-48 overflow-y-auto rounded-xl border border-border bg-muted/30 divide-y divide-border">
              {contactList.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground text-center">Nenhum contato cadastrado.</div>
              ) : contactList.map((c: any) => (
                <div key={c.id} className="flex items-center gap-3 p-3">
                  {contactOpen?.relation === "medico"
                    ? <Stethoscope className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
                    : <Users className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{c.full_name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {c.phone} · <span className="uppercase">{c.channel_pref}</span>
                    </div>
                  </div>
                  <button type="button" onClick={() => removeContact(c.id)} aria-label="Remover" className="rounded-md p-1.5 text-muted-foreground hover:bg-background hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
          <form onSubmit={addContact} className="space-y-3 pt-2 border-t border-border">
            <div className="space-y-2"><Label>Nome</Label><Input name="full_name" required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Telefone</Label><Input name="phone" required /></div>
              <div className="space-y-2"><Label>Canal</Label>
                <Select name="channel_pref" defaultValue="whatsapp">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" variant="hero" className="w-full">Adicionar</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}