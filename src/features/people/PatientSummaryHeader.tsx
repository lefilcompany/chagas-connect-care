import { Link } from "react-router-dom";
import { ArrowLeft, Send, ShieldCheck, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChannelBadge } from "@/components/care/ChannelBadge";
import { formatDistanceToNowStrict, maskId } from "./format";
import type { PersonWithDerived } from "./types";

const stageLabels: Record<string, string> = {
  diagnostico: "Diagnóstico",
  agudo: "Fase aguda",
  cronico: "Acompanhamento crônico",
};

export function PatientSummaryHeader({
  person,
  onCommunicate,
}: {
  person: PersonWithDerived;
  onCommunicate?: () => void;
}) {
  const stage = person.stage ? stageLabels[person.stage] ?? person.stage : "Sem estágio";
  return (
    <header className="care-card p-5 sm:p-6 space-y-4">
      <Link
        to="/app/pessoas"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Voltar para Pessoas
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{stage}</p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink truncate">{person.full_name}</h1>
          <dl className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <div className="inline-flex items-center gap-1">
              <dt className="sr-only">Identificador</dt>
              <dd className="font-mono">{maskId(person.id)}</dd>
            </div>
            {person.derived.age !== null && (
              <div>
                <dt className="sr-only">Idade</dt>
                <dd>{person.derived.age} anos</dd>
              </div>
            )}
            {person.phone && (
              <div className="inline-flex items-center gap-1">
                <dt className="sr-only">Telefone</dt>
                <Phone className="h-3 w-3" aria-hidden />
                <dd>{person.phone}</dd>
              </div>
            )}
          </dl>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {person.channel_pref && <ChannelBadge channel={person.channel_pref as "whatsapp" | "sms"} />}
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
                person.derived.hasConsent
                  ? "border-care/30 bg-mint-soft text-care"
                  : "border-coral-strong/30 bg-coral-soft text-coral-strong"
              }`}
            >
              <ShieldCheck className="h-3 w-3" aria-hidden />
              {person.derived.hasConsent ? "Consentimento ok" : "Sem consentimento"}
            </span>
            <span className="text-xs text-muted-foreground">
              {person.derived.lastContactAt
                ? `último contato há ${formatDistanceToNowStrict(person.derived.lastContactAt)}`
                : "sem contato registrado"}
            </span>
          </div>
          <Button variant="hero" size="sm" onClick={onCommunicate}>
            <Send className="h-4 w-4" /> Comunicar
          </Button>
        </div>
      </div>
    </header>
  );
}