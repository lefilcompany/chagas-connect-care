import { useQuery } from "@tanstack/react-query";
import { fetchers, qk } from "@/lib/queries";
import {
  Users, MessageCircle, Activity, Pill,
  AlertTriangle, UserPlus, Bell, Send, BarChart3,
  Check, Lock, ArrowRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const { data: stats = { patients: 0, messagesToday: 0, adherence30: 0, meds: 0, messagesTotal: 0, adherenceEvents: 0 } } =
    useQuery({ queryKey: qk.dashboard, queryFn: fetchers.dashboard });

  const cards = [
    { label: "Pacientes ativos", value: stats.patients, icon: Users, to: "/app/pacientes" },
    { label: "Mensagens hoje", value: stats.messagesToday, icon: MessageCircle, to: "/app/mensagens" },
    { label: "Adesão 30 dias", value: `${stats.adherence30}%`, icon: Activity, to: "/app/relatorios" },
    { label: "Medicações ativas", value: stats.meds, icon: Pill, to: "/app/pacientes" },
  ];

  const steps = [
    {
      title: "Cadastre seus pacientes",
      description: "Adicione o paciente junto com a família ou cuidador responsável pelo cuidado diário.",
      icon: UserPlus,
      cta: "Cadastrar paciente",
      to: "/app/pacientes",
      done: stats.patients > 0,
    },
    {
      title: "Registre as medicações",
      description: "Cadastre os remédios de cada paciente e configure os horários dos lembretes.",
      icon: Bell,
      cta: "Adicionar medicação",
      to: "/app/pacientes",
      done: stats.meds > 0,
    },
    {
      title: "Envie a primeira mensagem",
      description: "Compartilhe uma orientação educativa via WhatsApp ou SMS com paciente e família.",
      icon: Send,
      cta: "Enviar mensagem",
      to: "/app/mensagens",
      done: stats.messagesTotal > 0,
    },
    {
      title: "Acompanhe a adesão",
      description: "Veja relatórios de confirmação e identifique pacientes que precisam de reforço.",
      icon: BarChart3,
      cta: "Ver relatórios",
      to: "/app/relatorios",
      done: stats.adherenceEvents > 0,
    },
  ];

  const currentStepIndex = steps.findIndex((s) => !s.done);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-bold text-brand">Painel</h1>
        <p className="text-muted-foreground mt-1">Visão geral do cuidado conectado da sua equipe.</p>
      </header>
      <div role="alert" className="flex gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
        <div>
          <div className="font-semibold">Atenção clínica</div>
          <p className="mt-1 text-destructive/90">
            Pacientes com Doença de Chagas têm risco aumentado de morte súbita sem controle adequado da dieta. Mantenha o envio de orientações nutricionais consistente para o paciente e seus familiares.
          </p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} to={c.to} className="rounded-2xl border border-border bg-card p-6 shadow-card hover:shadow-soft hover:-translate-y-0.5 transition-smooth">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">{c.label}</div>
                <div className="mt-2 font-display text-3xl font-bold text-brand">{c.value}</div>
              </div>
              <div className="h-10 w-10 rounded-xl bg-primary/50 text-brand flex items-center justify-center">
                <c.icon className="h-5 w-5" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      <section>
        <h2 className="font-display text-base sm:text-lg font-bold text-brand">Próximos passos</h2>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">Siga a jornada na ordem.</p>
        <ol className="mt-4 grid gap-2.5 sm:gap-3 lg:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => {
            const isDone = s.done;
            const isActive = !isDone && i === currentStepIndex;
            const isLocked = !isDone && !isActive;
            const isLast = i === steps.length - 1;
            return (
              <li
                key={s.title}
                className={cn(
                  "relative rounded-2xl border p-3 sm:p-4 shadow-card flex flex-col gap-2.5 sm:gap-3 transition-smooth",
                  isDone && "border-brand/30 bg-primary/30",
                  isActive && "border-brand bg-card ring-2 ring-brand/20",
                  isLocked && "border-border bg-muted/60 opacity-70",
                )}
              >
                {!isLast && (
                  <span
                    aria-hidden
                    className={cn(
                      "pointer-events-none absolute z-0",
                      // mobile (1 col): vertical line centered between cards
                      "left-1/2 -translate-x-1/2 -bottom-2.5 h-2.5 w-0.5",
                      // tablet (2 cols): horizontal connector aligned to icon center (top ≈ p-3 + h-9/2)
                      "sm:left-auto sm:translate-x-0 sm:bottom-auto sm:-right-3 sm:top-[30px] sm:-translate-y-1/2 sm:h-0.5 sm:w-3",
                      // hide tablet connector after col 2 (i=1) so it doesn't dangle; show on desktop instead
                      i % 2 === 1 && "sm:hidden lg:block",
                      // desktop (4 cols): horizontal aligned to icon center (p-4 + h-9/2 = 16+18)
                      "lg:-right-4 lg:top-[34px] lg:h-0.5 lg:w-4",
                      isDone ? "bg-brand" : "bg-border",
                    )}
                  />
                )}
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <div className={cn(
                    "h-8 w-8 sm:h-9 sm:w-9 shrink-0 rounded-lg flex items-center justify-center",
                    isDone ? "bg-brand text-brand-foreground" : isActive ? "bg-primary text-brand" : "bg-muted text-muted-foreground",
                  )}>
                    {isDone ? <Check className="h-4 w-4" /> : isLocked ? <Lock className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
                  </div>
                  <div className="flex flex-col leading-tight min-w-0">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Passo {i + 1}</span>
                    {isDone && <span className="text-[11px] font-semibold text-brand">Concluído</span>}
                    {isActive && <span className="text-[11px] font-semibold text-brand">Em andamento</span>}
                    {isLocked && <span className="text-[11px] font-semibold text-muted-foreground">Bloqueado</span>}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display text-[13px] sm:text-sm font-bold text-brand leading-snug">{s.title}</h3>
                  <p className="mt-1 text-[11px] sm:text-xs text-muted-foreground line-clamp-3 leading-snug">{s.description}</p>
                </div>
                <div className="mt-auto">
                  {isLocked ? (
                    <Button variant="outline" size="sm" disabled className="w-full gap-1.5 h-8 text-xs">
                      <Lock className="h-3.5 w-3.5" /> Bloqueado
                    </Button>
                  ) : isDone ? (
                    <Button asChild variant="outline" size="sm" className="w-full gap-1.5 h-8 text-xs">
                      <Link to={s.to}>Revisar</Link>
                    </Button>
                  ) : (
                    <Button asChild size="sm" className="w-full gap-1.5 h-8 text-xs bg-brand text-brand-foreground hover:bg-brand/90">
                      <Link to={s.to} className="truncate">{s.cta} <ArrowRight className="h-3.5 w-3.5 shrink-0" /></Link>
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}