import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Users, MessageCircle, Activity, Pill,
  AlertTriangle, UserPlus, Bell, Send, BarChart3,
  Check, Lock, ArrowRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Stats = { patients: number; messagesToday: number; adherence30: number; meds: number; messagesTotal: number; adherenceEvents: number };

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ patients: 0, messagesToday: 0, adherence30: 0, meds: 0, messagesTotal: 0, adherenceEvents: 0 });

  useEffect(() => {
    (async () => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const thirty = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      const [p, m, mt, ad, mTotal] = await Promise.all([
        supabase.from("patients").select("id", { count: "exact", head: true }),
        supabase.from("medications").select("id", { count: "exact", head: true }),
        supabase.from("messages").select("id", { count: "exact", head: true }).gte("sent_at", today.toISOString()),
        supabase.from("adherence_events").select("event_type").gte("occurred_at", thirty),
        supabase.from("messages").select("id", { count: "exact", head: true }),
      ]);
      const events = ad.data ?? [];
      const ok = events.filter((e) => e.event_type === "confirmado").length;
      const adh = events.length ? Math.round((ok / events.length) * 100) : 0;
      setStats({
        patients: p.count ?? 0,
        messagesToday: mt.count ?? 0,
        adherence30: adh,
        meds: m.count ?? 0,
        messagesTotal: mTotal.count ?? 0,
        adherenceEvents: events.length,
      });
    })();
  }, []);

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
        <h2 className="font-display text-lg font-bold text-brand">Próximos passos</h2>
        <p className="text-sm text-muted-foreground mt-1">Siga a jornada na ordem para preparar o cuidado conectado.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 relative">
          {steps.map((s, i) => {
            const isDone = s.done;
            const isActive = !isDone && i === currentStepIndex;
            const isLocked = !isDone && !isActive;
            const isLast = i === steps.length - 1;
            const prevDone = i > 0 && steps[i - 1].done;
            return (
              <div
                key={s.title}
                className={cn(
                  "relative rounded-2xl border p-5 shadow-card flex flex-col gap-4 transition-smooth",
                  isDone && "border-brand/30 bg-primary/30",
                  isActive && "border-brand bg-card ring-2 ring-brand/20",
                  isLocked && "border-border bg-muted/60 opacity-70",
                )}
              >
                {!isLast && (
                  <div
                    aria-hidden
                    className={cn(
                      "hidden lg:block absolute top-10 -right-4 h-0.5 w-8 z-10",
                      isDone ? "bg-brand" : "bg-border",
                    )}
                  />
                )}
                <div className="flex items-center gap-3">
                <div className={cn(
                  "h-11 w-11 shrink-0 rounded-xl flex items-center justify-center",
                  isDone ? "bg-brand text-brand-foreground" : isActive ? "bg-primary text-brand" : "bg-muted text-muted-foreground",
                )}>
                  {isDone ? <Check className="h-5 w-5" /> : isLocked ? <Lock className="h-5 w-5" /> : <s.icon className="h-5 w-5" />}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Passo {i + 1}</span>
                  {isDone && <span className="text-xs font-semibold text-brand">Concluído</span>}
                  {isActive && <span className="text-xs font-semibold text-brand">Em andamento</span>}
                  {isLocked && <span className="text-xs font-semibold text-muted-foreground">Bloqueado</span>}
                </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display text-base font-bold text-brand">{s.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
                </div>
                <div className="mt-auto">
                  {isLocked ? (
                    <Button variant="outline" size="sm" disabled className="w-full gap-2">
                      <Lock className="h-4 w-4" /> Bloqueado
                    </Button>
                  ) : isDone ? (
                    <Button asChild variant="outline" size="sm" className="w-full gap-2">
                      <Link to={s.to}>Revisar</Link>
                    </Button>
                  ) : (
                    <Button asChild size="sm" className="w-full gap-2 bg-brand text-brand-foreground hover:bg-brand/90">
                      <Link to={s.to}>{s.cta} <ArrowRight className="h-4 w-4" /></Link>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}