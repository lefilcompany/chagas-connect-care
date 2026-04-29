import { MessageSquareText, ClipboardList, BellRing, Repeat, Check } from "lucide-react";

const benefits = [
  { icon: MessageSquareText, title: "Comunicação Eficiente", desc: "Integração direta via WhatsApp para falar com pacientes onde eles já estão." },
  { icon: ClipboardList, title: "Gestão Completa", desc: "Acompanhamento centralizado de dados, histórico clínico e evolução." },
  { icon: BellRing, title: "Otimização de Consultas", desc: "Lembretes automáticos que reduzem faltas e mantêm a agenda cheia." },
  { icon: Repeat, title: "Automação de Processos", desc: "Reengajamento automático e atualização de status sem trabalho manual." },
];

export const Benefits = () => (
  <section id="beneficios" className="bg-gradient-soft py-24">
    <div className="container grid gap-16 lg:grid-cols-2 lg:items-center">
      <div>
        <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-brand/70">Benefícios</p>
        <h2 className="font-display text-3xl font-bold leading-tight text-brand md:text-4xl lg:text-5xl">
          Para sua equipe de saúde, tudo fica mais simples.
        </h2>
        <p className="mt-5 text-lg text-muted-foreground">
          Melhore a gestão do atendimento, otimize o tempo da equipe e aumente a satisfação dos pacientes com ferramentas práticas e inteligentes.
        </p>
        <ul className="mt-8 space-y-3">
          {["Reduz faltas em até 40%", "Economia de até 6h/semana por profissional", "Maior adesão ao tratamento"].map((t) => (
            <li key={t} className="flex items-center gap-3 text-foreground">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-brand">
                <Check className="h-4 w-4" strokeWidth={3} />
              </span>
              {t}
            </li>
          ))}
        </ul>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        {benefits.map((b, i) => (
          <div
            key={b.title}
            className={`rounded-2xl border border-border bg-card p-6 shadow-card transition-smooth hover:shadow-soft ${i % 2 === 1 ? "sm:translate-y-8" : ""}`}
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-brand-foreground">
              <b.icon className="h-5 w-5" />
            </div>
            <h3 className="mb-2 font-display text-lg font-bold text-brand">{b.title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{b.desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);