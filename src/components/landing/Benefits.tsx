import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  MessageCircle,
  Route,
  UserRoundCheck,
} from "lucide-react";

const steps = [
  {
    icon: UserRoundCheck,
    number: "01",
    title: "Organize quem participa do cuidado",
    desc: "Cadastre o paciente e identifique familiares, cuidadores e profissionais vinculados.",
  },
  {
    icon: Route,
    number: "02",
    title: "Defina o evento e a audiência",
    desc: "Escolha a etapa da jornada, os critérios do público e quem deve receber cada orientação.",
  },
  {
    icon: MessageCircle,
    number: "03",
    title: "Comunique com contexto",
    desc: "Use mensagens e templates adequados ao papel de cada pessoa, com WhatsApp como canal principal.",
  },
  {
    icon: CheckCircle2,
    number: "04",
    title: "Acompanhe respostas e pendências",
    desc: "Veja entregas, falhas, retornos e casos que precisam da atuação direta da equipe.",
  },
];

const outcomes = [
  "Menos informações dispersas entre planilhas, conversas e anotações",
  "Mais clareza sobre quem recebeu, respondeu ou precisa de acompanhamento",
  "Conteúdo consistente para pacientes, familiares e cuidadores",
];

export const Benefits = () => (
  <section id="jornadas" className="relative overflow-hidden bg-gradient-care py-20 sm:py-24">
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <div className="absolute -right-32 top-1/3 h-80 w-80 rounded-full bg-coral/15 blur-3xl" />
    </div>

    <div className="container relative grid gap-12 lg:grid-cols-[0.86fr_1.14fr] lg:items-start xl:gap-20">
      <div className="lg:sticky lg:top-28">
        <span className="care-chip">Jornadas de comunicação</span>
        <h2 className="mt-5 font-display text-3xl font-bold leading-tight text-ink sm:text-4xl lg:text-5xl">
          Da necessidade de contato à próxima ação da equipe.
        </h2>
        <p className="mt-5 text-base leading-7 text-muted-foreground sm:text-lg">
          Em vez de começar pelo canal ou por uma lista de disparo, a plataforma parte do evento de cuidado e organiza público, mensagem, momento, resposta esperada e acompanhamento.
        </p>

        <ul className="mt-7 space-y-3">
          {outcomes.map((outcome) => (
            <li key={outcome} className="flex items-start gap-3 text-sm leading-6 text-foreground/85">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-mint-soft text-care">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              </span>
              {outcome}
            </li>
          ))}
        </ul>

        <a
          href="#seguranca"
          className="mt-8 inline-flex items-center gap-2 rounded-md text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Ver como o contexto é protegido
          <ArrowRight className="h-4 w-4" aria-hidden />
        </a>
      </div>

      <ol className="relative space-y-4 before:absolute before:bottom-8 before:left-6 before:top-8 before:w-px before:bg-border sm:before:left-8">
        {steps.map((step) => (
          <li key={step.number} className="relative rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
            <div className="flex gap-4 sm:gap-5">
              <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-care text-care-foreground shadow-sm sm:h-16 sm:w-16">
                <step.icon className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden />
              </div>
              <div className="min-w-0 pt-0.5 sm:pt-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Etapa {step.number}</span>
                  {step.number === "04" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-coral-soft px-2 py-0.5 text-[10px] font-semibold text-primary">
                      <Clock3 className="h-3 w-3" aria-hidden /> Equipe no controle
                    </span>
                  )}
                </div>
                <h3 className="mt-2 font-display text-lg font-bold text-ink sm:text-xl">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.desc}</p>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  </section>
);
