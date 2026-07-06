import { Link } from "react-router-dom";
import { AlertCircle, ChevronRight, MapPin, Users } from "lucide-react";
import type { PersonWithDerived } from "./types";
import { ChannelBadge } from "@/components/care/ChannelBadge";
import { formatDistanceToNowStrict } from "./format";

const stageLabels: Record<string, string> = {
  diagnostico: "Diagnóstico",
  agudo: "Agudo",
  cronico: "Crônico",
};

export function PeopleList({ people }: { people: PersonWithDerived[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <table className="w-full text-sm">
        <caption className="sr-only">Lista de pessoas acompanhadas</caption>
        <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-3">Pessoa</th>
            <th scope="col" className="px-4 py-3">Estágio</th>
            <th scope="col" className="px-4 py-3">Canal</th>
            <th scope="col" className="px-4 py-3">Último contato</th>
            <th scope="col" className="px-4 py-3">Rede</th>
            <th scope="col" className="px-4 py-3">Pendências</th>
            <th scope="col" className="px-4 py-3 sr-only">Ações</th>
          </tr>
        </thead>
        <tbody>
          {people.map((p) => {
            const stage = p.stage ? stageLabels[p.stage] ?? p.stage : "—";
            const location = [p.city, p.state].filter(Boolean).join("/");
            return (
              <tr key={p.id} className="border-t border-border hover:bg-secondary/40">
                <td className="px-4 py-3 align-top">
                  <Link
                    to={`/app/pessoas/${p.id}`}
                    className="font-display font-semibold text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                  >
                    {p.full_name}
                  </Link>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    {p.derived.age !== null && <span>{p.derived.age} anos</span>}
                    {location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" aria-hidden /> {location}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 align-top text-xs">{stage}</td>
                <td className="px-4 py-3 align-top">
                  {p.channel_pref ? (
                    <ChannelBadge channel={p.channel_pref as "whatsapp" | "sms"} />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 align-top text-xs text-muted-foreground">
                  {p.derived.lastContactAt
                    ? `há ${formatDistanceToNowStrict(p.derived.lastContactAt)}`
                    : "sem registro"}
                </td>
                <td className="px-4 py-3 align-top">
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" aria-hidden />
                    {p.derived.contactsCount}
                  </span>
                </td>
                <td className="px-4 py-3 align-top">
                  {p.derived.pendencies.length === 0 ? (
                    <span className="text-xs text-care">Em dia</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-coral-soft px-2 py-0.5 text-xs font-medium text-coral-strong">
                      <AlertCircle className="h-3 w-3" aria-hidden />
                      {p.derived.pendencies.length}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 align-top text-right">
                  <Link
                    to={`/app/pessoas/${p.id}`}
                    aria-label={`Abrir perfil de ${p.full_name}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}