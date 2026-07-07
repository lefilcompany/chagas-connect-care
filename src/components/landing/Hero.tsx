import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  HeartHandshake,
  HeartPulse,
  MessageCircle,
  ShieldCheck,
  Stethoscope,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";

const trustPoints = [
  { icon: Users, label: "Paciente, família e cuidador no mesmo contexto" },
  { icon: ShieldCheck, label: "Consentimento e rastreabilidade visíveis" },
  { icon: MessageCircle, label: "WhatsApp como canal principal" },
];

export const Hero = () => {
  return (
    <section id="topo" className="relative isolate overflow-hidden bg-gradient-care">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="absolute -left-32 top-16 h-80 w-80 rounded-full bg-coral/20 blur-3xl" />
        <div className="absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-mint-soft blur-3xl" />
      </div>

      <div className="container grid items-center gap-14 py-16 lg:grid-cols-[1.02fr_0.98fr] lg:py-24 xl:gap-20">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-care/20 bg-card/80 px-4 py-2 text-xs font-semibold text-care shadow-sm backdrop-blur">
            <HeartPulse className="h-4 w-4" aria-hidden />
            Comunicação em saúde para cuidado contínuo
          </span>

          <h1 className="mt-6 font-display text-4xl font-extrabold leading-[1.08] tracking-tight text-ink sm:text-5xl lg:text-6xl">
            Conecte cada pessoa da rede de cuidado,
            <span className="text-primary"> da orientação ao acompanhamento.</span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
            O Chagas Connect Care organiza pacientes, familiares, cuidadores, profissionais, mensagens e jornadas em uma única operação. Sua equipe comunica com mais contexto, acompanha respostas e sabe o que precisa de atenção.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button variant="hero" size="lg" className="group" asChild>
              <a href="#plataforma">
                Conhecer a plataforma
                <ArrowRight className="transition-transform group-hover:translate-x-1" />
              </a>
            </Button>
            <Button variant="outlineBrand" size="lg" asChild>
              <Link to="/auth">Acessar o sistema</Link>
            </Button>
          </div>

          <ul className="mt-8 grid gap-3 text-sm text-foreground/80 sm:grid-cols-3">
            {trustPoints.map((item) => (
              <li key={item.label} className="flex items-start gap-2">
                <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-care" aria-hidden />
                <span>{item.label}</span>
              </li>
            ))}
          </ul>

          <p className="mt-6 max-w-xl text-xs leading-5 text-muted-foreground">
            A plataforma apoia comunicação e coordenação do cuidado. Decisões clínicas permanecem sob responsabilidade da equipe de saúde.
          </p>
        </div>

        <div className="relative mx-auto w-full max-w-2xl lg:max-w-none" aria-label="Prévia ilustrativa da plataforma">
          <div className="absolute -inset-5 -z-10 rounded-[2.5rem] bg-coral/15 blur-2xl" aria-hidden />
          <div className="overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-soft">
            <div className="flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 sm:px-5">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-mint-soft text-care">
                  <HeartHandshake className="h-4 w-4" aria-hidden />
                </div>
                <div>
                  <p className="text-xs font-bold text-ink">Centro de cuidado</p>
                  <p className="text-[10px] text-muted-foreground">Visão operacional do dia</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-mint-soft px-2.5 py-1 text-[10px] font-semibold text-care">
                <span className="h-1.5 w-1.5 rounded-full bg-care" /> Canal ativo
              </span>
            </div>

            <div className="grid min-h-[470px] grid-cols-[72px_1fr] sm:grid-cols-[150px_1fr]">
              <aside className="border-r border-border bg-secondary/40 p-3" aria-hidden>
                <div className="mb-5 hidden items-center gap-2 rounded-xl bg-mint-soft px-3 py-2 text-[10px] font-semibold text-care sm:flex">
                  <HeartPulse className="h-3.5 w-3.5" /> Cuidado
                </div>
                <div className="space-y-2">
                  {[
                    { icon: CalendarCheck, label: "Hoje", active: true },
                    { icon: Users, label: "Pessoas" },
                    { icon: MessageCircle, label: "Caixa" },
                    { icon: HeartHandshake, label: "Jornadas" },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className={`flex items-center gap-2 rounded-xl px-2.5 py-2 text-[11px] ${item.active ? "bg-card font-semibold text-care shadow-sm" : "text-muted-foreground"}`}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="hidden sm:inline">{item.label}</span>
                    </div>
                  ))}
                </div>
              </aside>

              <div className="min-w-0 bg-background p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Hoje</p>
                    <h2 className="mt-1 font-display text-lg font-bold text-ink sm:text-xl">O que precisa de atenção</h2>
                  </div>
                  <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[10px] font-medium text-muted-foreground">Equipe assistencial</span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border bg-card p-3.5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <MessageCircle className="h-4 w-4 text-primary" aria-hidden />
                      <span className="rounded-full bg-coral-soft px-2 py-0.5 text-[9px] font-semibold text-primary">Responder</span>
                    </div>
                    <p className="mt-4 font-display text-2xl font-bold text-ink">3</p>
                    <p className="text-[11px] text-muted-foreground">Conversas aguardando a equipe</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-card p-3.5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <CalendarCheck className="h-4 w-4 text-care" aria-hidden />
                      <span className="rounded-full bg-mint-soft px-2 py-0.5 text-[9px] font-semibold text-care">Acompanhar</span>
                    </div>
                    <p className="mt-4 font-display text-2xl font-bold text-ink">6</p>
                    <p className="text-[11px] text-muted-foreground">Pessoas em jornada hoje</p>
                  </div>
                </div>

                <div className="mt-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-ink">Rede de cuidado</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">Paciente e contatos vinculados</p>
                    </div>
                    <CheckCircle2 className="h-4 w-4 text-care" aria-hidden />
                  </div>
                  <div className="mt-4 flex items-center justify-center gap-2 sm:gap-4">
                    <div className="flex w-20 flex-col items-center text-center">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-coral-soft text-primary ring-4 ring-background">
                        <Users className="h-4 w-4" aria-hidden />
                      </div>
                      <span className="mt-1 text-[9px] font-semibold text-ink">Familiar</span>
                    </div>
                    <div className="h-px w-5 bg-border sm:w-8" />
                    <div className="flex w-20 flex-col items-center text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-care text-care-foreground ring-4 ring-mint-soft">
                        <HeartPulse className="h-5 w-5" aria-hidden />
                      </div>
                      <span className="mt-1 text-[9px] font-bold text-ink">Paciente</span>
                    </div>
                    <div className="h-px w-5 bg-border sm:w-8" />
                    <div className="flex w-20 flex-col items-center text-center">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-mint-soft text-care ring-4 ring-background">
                        <Stethoscope className="h-4 w-4" aria-hidden />
                      </div>
                      <span className="mt-1 text-[9px] font-semibold text-ink">Médico</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 ml-auto max-w-[90%] rounded-2xl rounded-br-md bg-mint-soft p-3 text-[11px] leading-5 text-ink shadow-sm">
                  Olá! Sua equipe de cuidado enviou uma orientação para a próxima etapa do acompanhamento.
                  <div className="mt-1 text-right text-[9px] text-muted-foreground">WhatsApp · mensagem ilustrativa</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
