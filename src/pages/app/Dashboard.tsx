import { useQuery } from "@tanstack/react-query";
import { fetchers, qk } from "@/lib/queries";
import {
  Users, MessageCircle, Activity, Pill, AlertTriangle, UserPlus, Bell, Send,
  BarChart3, Check, Lock, ArrowRight, HeartPulse, ShieldCheck, Smartphone,
  MessageSquareText, CalendarClock, Stethoscope, Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { data, isLoading } = useQuery({ queryKey: qk.dashboard, queryFn: fetchers.dashboard });
  const stats = data ?? { patients: 0, messagesToday: 0, adherence30: 0, meds: 0, messagesTotal: 0, adherenceEvents: 0 };
  const ready = !isLoading && !!data;

  const cards = [
    { label: "Pacientes em cuidado", value: stats.patients, icon: Users, to: "/app/pacientes", hint: "cadastro, família e cuidador" },
    { label: "Mensagens hoje", value: stats.messagesToday, icon: MessageCircle, to: "/app/mensagens", hint: "WhatsApp e canais alternativos" },
    { label: "Adesão 30 dias", value: `${stats.adherence30}%`, icon: Activity, to: "/app/relatorios", hint: "confirmações e sinais de risco" },
    { label: "Medicações ativas", value: stats.meds, icon: Pill, to: "/app/pacientes", hint: "rotinas terapêuticas" },
  ];

  const steps = [
    { title: "Mapa familiar", description: "Cadastre paciente, familiares e cuidadores para garantir redundância segura de orientação.", icon: UserPlus, cta: "Cadastrar paciente", to: "/app/pacientes", done: stats.patients > 0 },
    { title: "Rotina terapêutica", description: "Transforme medicação, dieta e retorno em lembretes compreensíveis e acionáveis.", icon: Bell, cta: "Adicionar medicação", to: "/app/pacientes", done: stats.meds > 0 },
    { title: "Mensagem assistida", description: "Use modelos aprovados da Meta com variáveis para personalizar sem perder conformidade.", icon: Send, cta: "Enviar mensagem", to: "/app/mensagens", done: stats.messagesTotal > 0 },
    { title: "Vigilância ativa", description: "Acompanhe entrega, leitura e adesão para priorizar quem precisa de intervenção humana.", icon: BarChart3, cta: "Ver relatórios", to: "/app/relatorios", done: stats.adherenceEvents > 0 },
  ];

  const currentStepIndex = steps.findIndex((s) => !s.done);

  return (
    <div className="space-y-8">
      <section className="care-hero p-6 md:p-8">
        <div className="relative grid gap-6 lg:grid-cols-[1.35fr_0.65fr] lg:items-center">
          <div>
            <div className="care-chip"><HeartPulse className="h-3.5 w-3.5 text-primary" /> Plataforma de comunicação médica</div>
            <h1 className="mt-4 font-display text-3xl md:text-5xl font-bold tracking-tight text-brand">
              Orquestração de cuidado para pacientes, família e cuidadores.
            </h1>
            <p className="mt-3 max-w-3xl text-sm md:text-base text-muted-foreground">
              Centralize orientações de saúde, lembretes de consulta, informações do médico e templates Meta em uma experiência pensada para WhatsApp, continuidade do cuidado e ação rápida da equipe.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild className="bg-brand text-brand-foreground hover:bg-brand/90">
                <Link to="/app/conteudos"><MessageSquareText className="h-4 w-4" /> Criar orientação</Link>
              </Button>
              <Button asChild variant="outline" className="bg-white/70">
                <Link to="/app/modelos"><Sparkles className="h-4 w-4" /> Ver templates Meta</Link>
              </Button>
            </div>
          </div>
          <div className="care-card bg-white/75 p-4">
            <div className="rounded-2xl bg-[#e7f8ef] p-3 shadow-inner">
              <div className="mx-auto max-w-[18rem] rounded-[1.75rem] bg-white p-3 shadow-soft">
                <div className="flex items-center gap-2 border-b pb-3"><div className="h-9 w-9 rounded-full bg-emerald-500/15 flex items-center justify-center"><Smartphone className="h-4 w-4 text-emerald-600" /></div><div><p className="text-sm font-bold text-brand">WhatsApp cuidado</p><p className="text-xs text-muted-foreground">Template aprovado</p></div></div>
                <div className="mt-3 space-y-2 text-xs"><div className="rounded-2xl rounded-tl-sm bg-emerald-50 p-3 text-brand">Olá, Maria. Sua consulta com Dr(a). Ana é amanhã às 08:30. Leve exames e lista de medicamentos.</div><div className="ml-auto w-fit rounded-2xl rounded-tr-sm bg-primary/20 px-3 py-2 text-brand">Confirmar presença</div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div role="alert" className="flex gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
        <div><div className="font-semibold">Atenção clínica</div><p className="mt-1 text-destructive/90">Comunicações de saúde devem ser claras, registráveis e encaminhar casos de risco para avaliação profissional. Use segmentação e linguagem simples para pacientes, familiares e cuidadores.</p></div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {!ready ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="care-card p-6"><Skeleton className="h-20 w-full" /></div>) : cards.map((c) => (
          <Link key={c.label} to={c.to} className="care-card group p-5 transition-smooth hover:-translate-y-1 hover:shadow-soft">
            <div className="flex items-start justify-between gap-4"><div><div className="text-sm text-muted-foreground">{c.label}</div><div className="mt-2 font-display text-4xl font-bold text-brand">{c.value}</div><p className="mt-2 text-xs text-muted-foreground">{c.hint}</p></div><div className="h-12 w-12 rounded-2xl bg-primary/20 text-brand flex items-center justify-center group-hover:bg-brand group-hover:text-white transition-colors"><c.icon className="h-5 w-5" /></div></div>
          </Link>
        ))}
      </div>

      <section className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div>
          <h2 className="font-display text-xl font-bold text-brand">Jornada operacional recomendada</h2>
          <p className="text-sm text-muted-foreground mt-1">Fluxo inspirado em plataformas de engajamento: cadastro completo, automação, mensageria e monitoramento.</p>
          <ol className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {!ready ? Array.from({ length: 4 }).map((_, i) => <li key={i} className="care-card p-4"><Skeleton className="h-32 w-full" /></li>) : steps.map((s, i) => {
              const isDone = s.done; const isActive = !isDone && i === currentStepIndex; const isLocked = !isDone && !isActive;
              return <li key={s.title} className={cn("care-card relative flex min-h-[14rem] flex-col gap-3 p-4 transition-smooth", isDone && "border-brand/30 bg-primary/20", isActive && "ring-2 ring-brand/20", isLocked && "opacity-70")}>
                <div className="flex items-center justify-between"><div className={cn("h-10 w-10 rounded-2xl flex items-center justify-center", isDone ? "bg-brand text-white" : isActive ? "bg-primary/30 text-brand" : "bg-muted text-muted-foreground")}>{isDone ? <Check className="h-4 w-4" /> : isLocked ? <Lock className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}</div><span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Passo {i + 1}</span></div>
                <div><h3 className="font-display text-base font-bold text-brand">{s.title}</h3><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.description}</p></div>
                <Button asChild={!isLocked} disabled={isLocked} size="sm" variant={isDone ? "outline" : "default"} className={cn("mt-auto w-full", !isDone && !isLocked && "bg-brand text-brand-foreground hover:bg-brand/90")}>
                  {isLocked ? <span><Lock className="h-3.5 w-3.5" /> Bloqueado</span> : <Link to={s.to}>{isDone ? "Revisar" : s.cta} <ArrowRight className="h-3.5 w-3.5" /></Link>}
                </Button>
              </li>;
            })}
          </ol>
        </div>
        <aside className="care-card p-5">
          <h2 className="font-display text-lg font-bold text-brand">Direção de produto para o Lovable</h2>
          <div className="mt-4 space-y-3 text-sm text-muted-foreground">
            {[{ icon: ShieldCheck, t: "Confiança", d: "Exibir consentimento, status Meta e trilha de envio junto da mensagem." }, { icon: CalendarClock, t: "Contexto", d: "Priorizar consulta, médico, preparo, medicação e próximo passo em cada card." }, { icon: Stethoscope, t: "Cuidado humano", d: "Destacar casos sem leitura, falha ou sintomas relatados para contato ativo." }].map((x) => <div key={x.t} className="rounded-2xl border bg-white/70 p-3"><div className="flex items-center gap-2 font-semibold text-brand"><x.icon className="h-4 w-4 text-primary" /> {x.t}</div><p className="mt-1 text-xs leading-relaxed">{x.d}</p></div>)}
          </div>
        </aside>
      </section>
    </div>
  );
}
