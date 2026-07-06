import { AlertTriangle, Phone, Users, MessageSquare, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PersonWithDerived } from "./types";

type Action = {
  key: string;
  priority: "alta" | "média" | "baixa";
  title: string;
  reason: string;
  cta: string;
  icon: typeof AlertTriangle;
  href?: string;
};

function buildActions(person: PersonWithDerived): Action[] {
  const actions: Action[] = [];
  const { derived } = person;
  if (derived.lastMessageFailed) {
    actions.push({
      key: "review-failure",
      priority: "alta",
      title: "Revisar falha de envio",
      reason: "A última mensagem enviada não foi entregue. Verifique o canal ou o modelo utilizado.",
      cta: "Abrir Caixa de cuidado",
      icon: AlertTriangle,
      href: "/app/caixa",
    });
  }
  if (!derived.hasValidChannel) {
    actions.push({
      key: "fix-channel",
      priority: "alta",
      title: "Atualizar contato principal",
      reason: "O telefone cadastrado é inválido ou está incompleto.",
      cta: "Editar ficha",
      icon: Phone,
      href: `/app/pacientes/${person.id}`,
    });
  }
  if (!derived.hasCaregiver) {
    actions.push({
      key: "add-caregiver",
      priority: "média",
      title: "Incluir um cuidador",
      reason: "Nenhum familiar ou cuidador está vinculado ainda. A rede de apoio é essencial ao cuidado.",
      cta: "Cadastrar cuidador",
      icon: Users,
      href: `/app/pacientes/${person.id}`,
    });
  }
  if (derived.pendingReply) {
    actions.push({
      key: "reply",
      priority: "alta",
      title: "Responder mensagem recebida",
      reason: "Há uma mensagem aguardando resposta da equipe.",
      cta: "Ir para a Caixa",
      icon: MessageSquare,
      href: "/app/caixa",
    });
  }
  if (!derived.lastContactAt || Date.now() - new Date(derived.lastContactAt).getTime() > 30 * 24 * 3600 * 1000) {
    actions.push({
      key: "reconnect",
      priority: "baixa",
      title: "Reconectar após período sem contato",
      reason: "Faz mais de 30 dias sem uma comunicação registrada.",
      cta: "Enviar mensagem",
      icon: MessageSquare,
      href: "/app/caixa",
    });
  }
  return actions;
}

const priorityStyles: Record<Action["priority"], string> = {
  alta: "border-coral-strong/30 bg-coral-soft text-coral-strong",
  média: "border-care/30 bg-mint-soft text-care",
  baixa: "border-border bg-secondary text-muted-foreground",
};

export function NextBestAction({ person }: { person: PersonWithDerived }) {
  const actions = buildActions(person);
  if (actions.length === 0) {
    return (
      <div className="care-card flex items-center gap-3 p-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-mint-soft text-care">
          <CheckCircle2 className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <p className="font-display font-semibold text-ink">Nada urgente agora</p>
          <p className="text-sm text-muted-foreground">O cuidado está em dia com base nas regras atuais.</p>
        </div>
      </div>
    );
  }
  return (
    <ul className="space-y-3">
      {actions.map((a) => (
        <li key={a.key} className="care-card flex flex-wrap items-start gap-4 p-5">
          <div className={`flex h-10 w-10 items-center justify-center rounded-full border ${priorityStyles[a.priority]}`}>
            <a.icon className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-display font-semibold text-ink">{a.title}</p>
              <span className={`rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-wide ${priorityStyles[a.priority]}`}>
                prioridade {a.priority}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{a.reason}</p>
          </div>
          {a.href && (
            <Button asChild variant="outline" size="sm">
              <a href={a.href}>
                {a.cta} <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}