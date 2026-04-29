import { MessageSquareText, UserCheck, MessageCircleHeart, Repeat, Check } from "lucide-react";

const benefits = [
  { icon: MessageSquareText, title: "Comunicação Eficiente", desc: "Integração direta via WhatsApp para falar com pacientes onde eles já estão." },
  { icon: UserCheck, title: "Comunicação por Perfil", desc: "Mensagens adaptadas à realidade de cada paciente — do jovem recém-diagnosticado à paciente crônica com baixa adesão ao plano alimentar." },
  { icon: MessageCircleHeart, title: "Orientações com Empatia", desc: "Conteúdos educativos sobre alimentação, sono, atividade física e medicação entregues com linguagem acessível e humanizada." },
  { icon: Repeat, title: "Automação de Processos", desc: "Reengajamento automático e atualização de status sem trabalho manual." },
];

export const Benefits = () => (
  <section id="beneficios" className="bg-gradient-soft py-24">
    <div className="container grid gap-16 lg:grid-cols-2 lg:items-center">
      <div>
        <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-brand/70">Benefícios</p>
        <h2 className="font-display text-3xl font-bold leading-tight text-brand md:text-4xl lg:text-5xl">
          Para seus pacientes de Chagas, cada mensagem importa.
        </h2>
        <p className="mt-5 text-lg text-muted-foreground">
          Eduque, engaje e apoie cada paciente com a comunicação certa, no momento certo e no tom adequado ao seu perfil.
        </p>
        <ul className="mt-8 space-y-3">
          {["Maior adesão à medicação e ao tratamento", "Orientações educativas adaptadas a cada perfil de paciente", "Redução do abandono do acompanhamento clínico"].map((t) => (
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