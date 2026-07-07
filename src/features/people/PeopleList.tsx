import { Fragment, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ChevronDown,
  Heart,
  MapPin,
  ShieldCheck,
  ShieldOff,
  Stethoscope,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { CareNetworkContact, PersonWithDerived } from "./types";
import { ChannelBadge } from "@/components/care/ChannelBadge";
import { formatDistanceToNowStrict } from "./format";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const pendencyLabels: Record<string, string> = {
  canal: "Sem canal válido (telefone ausente ou inválido)",
  consentimento: "Sem consentimento registrado",
  cuidador: "Sem cuidador ou familiar vinculado",
  falha: "Última mensagem falhou no envio",
  "sem-contato": "Sem contato há mais de 30 dias",
  "aguardando-resposta": "Mensagem recebida aguardando resposta",
};

const stageLabels: Record<string, string> = {
  diagnostico: "Diagnóstico",
  agudo: "Agudo",
  cronico: "Crônico",
};

type SupportedChannel = "whatsapp" | "sms" | "email" | "voice" | "secure_page";

function isSupportedChannel(channel: string | null): channel is SupportedChannel {
  return channel === "whatsapp"
    || channel === "sms"
    || channel === "email"
    || channel === "voice"
    || channel === "secure_page";
}

const relationOrder: Record<string, number> = {
  familiar: 0,
  cuidador: 1,
  medico: 2,
};

const relationMeta: Record<string, { label: string; icon: LucideIcon; iconClass: string; surfaceClass: string }> = {
  familiar: {
    label: "Familiar",
    icon: Heart,
    iconClass: "text-[#E7877C]",
    surfaceClass: "bg-coral-soft/70",
  },
  cuidador: {
    label: "Cuidador",
    icon: Users,
    iconClass: "text-care",
    surfaceClass: "bg-mint-soft",
  },
  medico: {
    label: "Médico",
    icon: Stethoscope,
    iconClass: "text-care-medium",
    surfaceClass: "bg-mint-soft/70",
  },
};

function CareNetworkCard({ contact }: { contact: CareNetworkContact }) {
  const meta = relationMeta[contact.relation ?? ""] ?? {
    label: contact.relation || "Contato",
    icon: UserRound,
    iconClass: "text-muted-foreground",
    surfaceClass: "bg-secondary",
  };
  const Icon = meta.icon;
  const consented = contact.authorization_status === "authorized" || contact.authorization_status === "ativo";

  return (
    <li className="rounded-xl border border-border bg-card p-3 shadow-sm">
      <div className="flex items-start gap-3">
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", meta.surfaceClass)}>
          <Icon className={cn("h-5 w-5", meta.iconClass)} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-semibold text-ink">{contact.full_name}</p>
              <p className="text-xs font-medium text-muted-foreground">{meta.label}</p>
            </div>
          </div>

          {contact.phone && (
            <p className="mt-1 truncate text-xs text-muted-foreground">{contact.phone}</p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {isSupportedChannel(contact.channel_pref) ? (
              <ChannelBadge channel={contact.channel_pref} />
            ) : contact.channel_pref ? (
              <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-medium uppercase text-muted-foreground">
                {contact.channel_pref}
              </span>
            ) : null}

            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                consented
                  ? "border-care/30 bg-mint-soft text-care"
                  : "border-border bg-secondary text-muted-foreground",
              )}
            >
              {consented ? (
                <ShieldCheck className="h-3 w-3" aria-hidden />
              ) : (
                <ShieldOff className="h-3 w-3" aria-hidden />
              )}
              {consented ? "Consentimento ativo" : "Consentimento pendente"}
            </span>

            {contact.receives_reminders && (
              <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                Recebe lembretes
              </span>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

export function PeopleList({ people }: { people: PersonWithDerived[] }) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  const toggleExpanded = (personId: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(personId)) next.delete(personId);
      else next.add(personId);
      return next;
    });
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <table className="w-full table-fixed text-sm">
        <colgroup>
          <col className="w-[30%]" />
          <col className="w-[12%]" />
          <col className="w-[14%]" />
          <col className="w-[16%]" />
          <col className="w-[10%]" />
          <col className="w-[12%]" />
          <col className="w-[56px]" />
        </colgroup>
        <caption className="sr-only">Lista de pessoas acompanhadas e suas redes de cuidado</caption>
        <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-2">Pessoa</th>
            <th scope="col" className="px-4 py-2">Estágio</th>
            <th scope="col" className="px-4 py-2">Canal</th>
            <th scope="col" className="px-4 py-2">Último contato</th>
            <th scope="col" className="px-4 py-2">Rede</th>
            <th scope="col" className="px-4 py-2">
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex cursor-help items-center gap-1 border-b border-dotted border-muted-foreground/50">
                      <AlertCircle className="h-4 w-4" aria-hidden />
                      <span className="sr-only">Pendências</span>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs">
                    Itens que precisam de atenção nesta pessoa: canal, consentimento, cuidador, falhas de envio, contato antigo ou resposta pendente.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </th>
            <th scope="col" className="px-4 py-2 sr-only">Mostrar rede de cuidado</th>
          </tr>
        </thead>
        <tbody>
          {people.map((p) => {
            const stage = p.stage ? stageLabels[p.stage] ?? p.stage : "—";
            const location = [p.city, p.state].filter(Boolean).join("/");
            const isExpanded = expandedIds.has(p.id);
            const contacts = [...p.contacts].sort((a, b) => {
              const aOrder = relationOrder[a.relation ?? ""] ?? 99;
              const bOrder = relationOrder[b.relation ?? ""] ?? 99;
              if (aOrder !== bOrder) return aOrder - bOrder;
              return a.full_name.localeCompare(b.full_name, "pt-BR");
            });
            const networkRegionId = `care-network-${p.id}`;

            return (
              <Fragment key={p.id}>
                <tr className={cn("border-t border-border hover:bg-secondary/40", isExpanded && "bg-secondary/30")}>
                  <td className="px-4 py-2 align-middle">
                    <Link
                      to={`/app/pessoas/${p.id}`}
                      className="rounded font-display text-sm font-semibold text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {p.full_name}
                    </Link>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                      {p.derived.age !== null && <span>{p.derived.age} anos</span>}
                      {location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" aria-hidden /> {location}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2 align-middle text-xs">{stage}</td>
                  <td className="px-4 py-2 align-middle">
                    {isSupportedChannel(p.channel_pref) ? (
                      <ChannelBadge channel={p.channel_pref} />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 align-middle text-xs text-muted-foreground">
                    {p.derived.lastContactAt
                      ? `há ${formatDistanceToNowStrict(p.derived.lastContactAt)}`
                      : "sem registro"}
                  </td>
                  <td className="px-4 py-2 align-middle">
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" aria-hidden />
                      {p.derived.contactsCount}
                    </span>
                  </td>
                  <td className="px-4 py-2 align-middle">
                    {p.derived.pendencies.length === 0 ? (
                      <span className="text-xs text-care">Em dia</span>
                    ) : (
                      <TooltipProvider delayDuration={150}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-full bg-coral-soft px-2 py-0.5 text-xs font-medium text-coral-strong hover:bg-coral-soft/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              aria-label={`${p.derived.pendencies.length} pendência(s): ${p.derived.pendencies.map((k) => pendencyLabels[k] ?? k).join(", ")}`}
                            >
                              <AlertCircle className="h-3 w-3" aria-hidden />
                              {p.derived.pendencies.length} {p.derived.pendencies.length === 1 ? "pendência" : "pendências"}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs text-xs">
                            <ul className="space-y-1">
                              {p.derived.pendencies.map((k) => (
                                <li key={k} className="flex items-start gap-1.5">
                                  <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                                  <span>{pendencyLabels[k] ?? k}</span>
                                </li>
                              ))}
                            </ul>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </td>
                  <td className="px-4 py-2 align-middle text-right">
                    <button
                      type="button"
                      onClick={() => toggleExpanded(p.id)}
                      aria-expanded={isExpanded}
                      aria-controls={networkRegionId}
                      aria-label={`${isExpanded ? "Ocultar" : "Mostrar"} familiares, cuidadores e médico de ${p.full_name}`}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} aria-hidden />
                    </button>
                  </td>
                </tr>

                {isExpanded && (
                  <tr id={networkRegionId} className="border-t border-border bg-secondary/20">
                    <td colSpan={7} className="px-4 py-3">
                      <div className="rounded-xl border border-border bg-background p-3">
                        <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="font-display text-sm font-semibold text-ink">
                              Rede de cuidado de {p.full_name}
                            </h3>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              Familiares, cuidadores e médicos vinculados a esta pessoa.
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              to={`/app/pacientes/${p.id}?tab=familia`}
                              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <Users className="h-3.5 w-3.5" aria-hidden />
                              Gerenciar vínculos
                            </Link>
                            <Link
                              to={`/app/pacientes/${p.id}?tab=dados`}
                              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-brand transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <UserRound className="h-3.5 w-3.5" aria-hidden />
                              Editar paciente
                            </Link>
                          </div>
                        </div>

                        {contacts.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-border bg-card px-4 py-4 text-center">
                            <Users className="mx-auto h-5 w-5 text-muted-foreground" aria-hidden />
                            <p className="mt-2 text-sm font-medium text-ink">Nenhum vínculo cadastrado</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Adicione um familiar, cuidador ou médico na ficha clínica completa.
                            </p>
                          </div>
                        ) : (
                          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {contacts.map((contact) => (
                              <CareNetworkCard key={contact.id} contact={contact} />
                            ))}
                          </ul>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
