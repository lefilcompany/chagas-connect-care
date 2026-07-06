import { Heart, Stethoscope, Users, User, ShieldOff, ShieldCheck } from "lucide-react";
import { EmptyState } from "@/components/care/EmptyState";
import { SkeletonState } from "@/components/care/EmptyState";
import { ChannelBadge } from "@/components/care/ChannelBadge";
import { usePatientContactsForOrbit } from "./usePeople";

const relationMeta: Record<string, { label: string; icon: typeof Users; ring: string }> = {
  familiar: { label: "Familiar", icon: Heart, ring: "ring-coral/40" },
  cuidador: { label: "Cuidador", icon: Users, ring: "ring-care/40" },
  medico: { label: "Profissional", icon: Stethoscope, ring: "ring-care-medium/40" },
};

export function CareOrbit({ patientId, patientName }: { patientId: string; patientName: string }) {
  const { data, isLoading, error } = usePatientContactsForOrbit(patientId);

  if (isLoading) return <SkeletonState className="h-40 w-full" />;
  if (error) {
    return (
      <EmptyState
        icon={ShieldOff}
        title="Não foi possível carregar a rede de cuidado"
        description="Recarregue a página em alguns instantes."
      />
    );
  }

  const contacts = data ?? [];

  if (contacts.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Ninguém na órbita de cuidado ainda"
        description="Cadastre familiares, cuidadores ou profissionais responsáveis para acompanhar em conjunto."
      />
    );
  }

  return (
    <div className="care-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-display text-base font-semibold text-ink">Órbita de cuidado</h3>
          <p className="text-xs text-muted-foreground">Pessoas que apoiam {patientName.split(" ")[0]} no cuidado.</p>
        </div>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {contacts.map((c: any) => {
          const meta = relationMeta[c.relation] ?? { label: c.relation ?? "Contato", icon: User, ring: "ring-border" };
          const Icon = meta.icon;
          const consented = c.authorization_status === "authorized" || c.authorization_status === "ativo";
          return (
            <li
              key={c.id}
              className="flex items-start gap-3 rounded-xl border border-border bg-background p-3"
            >
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary ring-2 ${meta.ring}`}>
                <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">{c.full_name}</p>
                <p className="text-xs text-muted-foreground">{meta.label}{c.phone ? ` · ${c.phone}` : ""}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {c.channel_pref && <ChannelBadge channel={c.channel_pref} />}
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
                      consented
                        ? "border-care/30 bg-mint-soft text-care"
                        : "border-border bg-secondary text-muted-foreground"
                    }`}
                  >
                    {consented ? <ShieldCheck className="h-3 w-3" aria-hidden /> : <ShieldOff className="h-3 w-3" aria-hidden />}
                    {consented ? "Consentimento ativo" : "Consentimento pendente"}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}