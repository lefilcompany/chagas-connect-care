import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { fetchers, qk } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PatientMultiSelect } from "@/components/app/PatientMultiSelect";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Search, History as HistoryIcon, Check, CheckCheck, Clock,
  X, ArrowRight, ChevronDown, ChevronUp, User as UserIcon,
  MessageSquare, Calendar, Table as TableIcon, ListOrdered,
} from "lucide-react";

type Patient = { id: string; full_name: string; phone: string; channel_pref: string; stage: string };

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

type ViewMode = "timeline" | "patient" | "table";

const recipientTypeOptions = [
  { value: "paciente", label: "Pacientes" },
  { value: "familiar", label: "Familiares" },
  { value: "cuidador", label: "Cuidadores" },
  { value: "familiar_cuidador", label: "Familiares e cuidadores" },
];

function RecipientTypeMultiSelect({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (value: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedSet = new Set(selected);
  const toggle = (value: string) => {
    if (selectedSet.has(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };
  const displayText =
    selected.length === 0
      ? "Todos os destinatários"
      : selected.length === 1
        ? (recipientTypeOptions.find((o) => o.value === selected[0])?.label ?? selected[0])
        : `${selected.length} selecionados`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-10 bg-background w-full justify-between font-normal text-sm px-3"
        >
          <span className="truncate">{displayText}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="space-y-0.5">
          {recipientTypeOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggle(opt.value)}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <Checkbox
                checked={selectedSet.has(opt.value)}
                onCheckedChange={() => toggle(opt.value)}
                className="pointer-events-none"
              />
              <span className="flex-1 text-left">{opt.label}</span>
              {selectedSet.has(opt.value) && <Check className="h-4 w-4 shrink-0 text-primary" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function Messages() {
  const { data: msgs = [] } = useQuery({ queryKey: qk.messages, queryFn: fetchers.messages });
  const { data: patients = [] } = useQuery({
    queryKey: qk.patients,
    queryFn: fetchers.patients as () => Promise<Patient[]>,
  });

  const [view, setView] = useState<ViewMode>("timeline");
  const [q, setQ] = useState("");
  const [patientFilter, setPatientFilter] = useState<string[]>([]);
  const [recipientTypeFilter, setRecipientTypeFilter] = useState<string[]>([]);
  const [channelFilter, setChannelFilter] = useState<string>("todos");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [detail, setDetail] = useState<any | null>(null);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const patientSet = new Set(patientFilter);
    return msgs.filter((m: any) => {
      if (patientSet.size > 0 && !patientSet.has(m.patient_id)) return false;
      if (recipientTypeFilter.length > 0) {
        const relation = (m.contact?.relation ?? "").toLowerCase();
        let matches = false;
        if (recipientTypeFilter.includes("paciente") && !m.contact) matches = true;
        if (recipientTypeFilter.includes("familiar") && m.contact && ["familiar", "família", "familia"].includes(relation)) matches = true;
        if (recipientTypeFilter.includes("cuidador") && m.contact && relation === "cuidador") matches = true;
        if (recipientTypeFilter.includes("familiar_cuidador") && m.contact && ["familiar", "família", "familia", "cuidador"].includes(relation)) matches = true;
        if (!matches) return false;
      }
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
  }, [msgs, q, patientFilter, recipientTypeFilter, channelFilter, statusFilter]);

  const recipientLabel = (m: any) =>
    m.contact ? `${m.contact.full_name} (${m.contact.relation})` : m.patients?.full_name ?? "—";
  const recipientPhone = (m: any) => m.contact?.phone ?? m.patients?.phone ?? "—";

  const patientNameById = useMemo(
    () => new Map(patients.map((p) => [p.id, p.full_name])),
    [patients],
  );
  const recipientTypeLabels: Record<string, string> = {
    paciente: "Pacientes",
    familiar: "Familiares",
    cuidador: "Cuidadores",
    familiar_cuidador: "Familiares e cuidadores",
  };
  const activeFilters: { key: string; label: string; value: string; clear: () => void }[] = [
    ...(q ? [{ key: "q", label: "Busca", value: q, clear: () => setQ("") }] : []),
    ...(patientFilter.length > 0
      ? [{
          key: "p",
          label: patientFilter.length === 1 ? "Paciente" : "Pacientes",
          value: patientFilter.length === 1
            ? (patientNameById.get(patientFilter[0]) ?? "—")
            : `${patientFilter.length} selecionados`,
          clear: () => setPatientFilter([]),
        }]
      : []),
    ...(recipientTypeFilter.length > 0
      ? [{
          key: "rt",
          label: "Destinatário",
          value: recipientTypeFilter.length === 1
            ? (recipientTypeLabels[recipientTypeFilter[0]] ?? recipientTypeFilter[0])
            : `${recipientTypeFilter.length} selecionados`,
          clear: () => setRecipientTypeFilter([]),
        }]
      : []),
    ...(channelFilter !== "todos"
      ? [{ key: "c", label: "Canal", value: channelFilter, clear: () => setChannelFilter("todos") }]
      : []),
    ...(statusFilter !== "todos"
      ? [{ key: "s", label: "Status", value: statusFilter, clear: () => setStatusFilter("todos") }]
      : []),
  ];
  const clearAllFilters = () => {
    setQ("");
    setPatientFilter([]);
    setRecipientTypeFilter([]);
    setChannelFilter("todos");
    setStatusFilter("todos");
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap md:flex-nowrap items-start md:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-bold text-brand inline-flex items-center gap-2">
            <HistoryIcon className="h-7 w-7" /> Histórico de mensagens
          </h1>
          <p className="text-muted-foreground mt-1">
            Todas as comunicações enviadas, com filtros e detalhes de entrega.
            Para disparar novas mensagens, use <Link to="/app/conteudos" className="text-brand hover:underline">Conteúdos</Link> ou
            a ficha do paciente.
          </p>
        </div>
      </header>

      <div className="rounded-2xl border border-border bg-card p-3 sm:p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
          <div className="flex flex-col gap-1 lg:col-span-3 sm:col-span-2">
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
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Pacientes</Label>
            <PatientMultiSelect
              selected={patientFilter}
              onChange={setPatientFilter}
              placeholder="Todos os pacientes"
            />
          </div>
          <div className="flex flex-col gap-1 min-w-0 lg:col-span-2">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Destinatário</Label>
            <RecipientTypeMultiSelect selected={recipientTypeFilter} onChange={setRecipientTypeFilter} />
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
              <span className="text-muted-foreground pt-2 hidden sm:inline" aria-hidden="true">·</span>
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

      {/* View toggle */}
      <div className="inline-flex rounded-full border border-border bg-card p-1 shadow-sm">
        {[
          { v: "timeline" as const, label: "Linha do tempo", icon: Calendar },
          { v: "patient" as const, label: "Por paciente", icon: UserIcon },
          { v: "table" as const, label: "Tabela", icon: TableIcon },
        ].map(({ v, label, icon: Icon }) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${
              view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
          Nenhuma mensagem encontrada com esses filtros.
        </div>
      ) : view === "timeline" ? (
        <TimelineView messages={filtered} onOpen={setDetail} recipientLabel={recipientLabel} />
      ) : view === "patient" ? (
        <ByPatientView messages={filtered} patients={patients} onOpen={setDetail} recipientLabel={recipientLabel} />
      ) : (
        <TableView messages={filtered} onOpen={setDetail} recipientLabel={recipientLabel} />
      )}

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
              <Button variant="hero" asChild onClick={() => setDetail(null)}>
                <Link to={`/app/pacientes/${detail.patient_id}`}>
                  <UserIcon className="h-4 w-4" /> Ver ficha do paciente
                </Link>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function dayKey(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
}

function TimelineView({
  messages, onOpen, recipientLabel,
}: { messages: any[]; onOpen: (m: any) => void; recipientLabel: (m: any) => string }) {
  const groups = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const m of messages) {
      const k = dayKey(m.sent_at);
      const list = map.get(k) ?? [];
      list.push(m);
      map.set(k, list);
    }
    return Array.from(map.entries());
  }, [messages]);

  return (
    <div className="space-y-6">
      {groups.map(([day, items]) => (
        <section key={day} className="space-y-2">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground font-semibold">
            <ListOrdered className="h-3.5 w-3.5" />
            <span className="capitalize">{day}</span>
            <span className="text-muted-foreground">· {items.length}</span>
          </div>
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <ul className="divide-y divide-border">
              {items.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(m)}
                    className="w-full text-left p-4 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex flex-wrap justify-between items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-2">
                        <span className="uppercase font-semibold text-brand">{m.channel}</span>
                        <span>→</span>
                        <span className="text-foreground font-medium">{recipientLabel(m)}</span>
                      </span>
                      <span>{m.sent_at ? new Date(m.sent_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"}</span>
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
          </div>
        </section>
      ))}
    </div>
  );
}

function ByPatientView({
  messages, patients, onOpen, recipientLabel,
}: {
  messages: any[]; patients: Patient[]; onOpen: (m: any) => void; recipientLabel: (m: any) => string;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const m of messages) {
      const list = map.get(m.patient_id) ?? [];
      list.push(m);
      map.set(m.patient_id, list);
    }
    const pmap = new Map(patients.map((p) => [p.id, p]));
    return Array.from(map.entries())
      .map(([pid, msgs]) => ({
        patient: pmap.get(pid) ?? null,
        patient_id: pid,
        msgs: msgs.sort((a, b) => +new Date(b.sent_at ?? 0) - +new Date(a.sent_at ?? 0)),
      }))
      .sort((a, b) => {
        const ta = +new Date(a.msgs[0]?.sent_at ?? 0);
        const tb = +new Date(b.msgs[0]?.sent_at ?? 0);
        return tb - ta;
      });
  }, [messages, patients]);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  return (
    <div className="space-y-3">
      {groups.map(({ patient, patient_id, msgs }) => {
        const isOpen = !!expanded[patient_id];
        const last = msgs[0];
        return (
          <div key={patient_id} className="rounded-2xl border border-border bg-card overflow-hidden">
            <button
              type="button"
              onClick={() => setExpanded((s) => ({ ...s, [patient_id]: !isOpen }))}
              className="w-full text-left p-4 hover:bg-muted/40 transition-colors flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-full bg-primary/10 text-brand flex items-center justify-center shrink-0">
                  <UserIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <Link
                    to={`/app/pacientes/${patient_id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="font-display text-base font-bold text-brand hover:underline truncate block"
                  >
                    {patient?.full_name ?? "Paciente removido"}
                  </Link>
                  <div className="text-xs text-muted-foreground truncate">
                    {msgs.length} mensagem{msgs.length === 1 ? "" : "s"}
                    {last?.sent_at ? ` · última em ${new Date(last.sent_at).toLocaleString("pt-BR")}` : ""}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {last && <StatusBadge status={last.status} />}
                {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </div>
            </button>
            {isOpen && (
              <ul className="border-t border-border divide-y divide-border">
                {msgs.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => onOpen(m)}
                      className="w-full text-left p-3 pl-16 hover:bg-muted/40 transition-colors text-sm"
                    >
                      <div className="flex justify-between items-center gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-2">
                          <span className="uppercase font-semibold text-brand">{m.channel}</span>
                          <span>→</span>
                          <span className="text-foreground font-medium">{recipientLabel(m)}</span>
                        </span>
                        <span>{m.sent_at ? new Date(m.sent_at).toLocaleString("pt-BR") : "—"}</span>
                      </div>
                      <div className="mt-1 line-clamp-2">{m.body}</div>
                      <div className="mt-1"><StatusBadge status={m.status} /></div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TableView({
  messages, onOpen, recipientLabel,
}: { messages: any[]; onOpen: (m: any) => void; recipientLabel: (m: any) => string }) {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden overflow-x-auto">
      <table className="w-full text-sm min-w-[720px]">
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="p-3">Data</th>
            <th className="p-3">Paciente</th>
            <th className="p-3">Destinatário</th>
            <th className="p-3">Canal</th>
            <th className="p-3">Status</th>
            <th className="p-3">Mensagem</th>
          </tr>
        </thead>
        <tbody>
          {messages.map((m) => (
            <tr
              key={m.id}
              onClick={() => onOpen(m)}
              className="border-t border-border cursor-pointer hover:bg-muted/40"
            >
              <td className="p-3 whitespace-nowrap text-xs text-muted-foreground">
                {m.sent_at ? new Date(m.sent_at).toLocaleString("pt-BR") : "—"}
              </td>
              <td className="p-3 font-medium">{m.patients?.full_name ?? "—"}</td>
              <td className="p-3">{recipientLabel(m)}</td>
              <td className="p-3 uppercase text-xs text-brand font-semibold">{m.channel}</td>
              <td className="p-3"><StatusBadge status={m.status} /></td>
              <td className="p-3 max-w-xs">
                <div className="line-clamp-2 text-muted-foreground">{m.body}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}