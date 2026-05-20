import { MessageSquareText, Users, MessageCircleHeart, Repeat, Check } from "lucide-react";

const benefits = [
  { icon: MessageSquareText, title: "WhatsApp e SMS", desc: "Fale com pacientes, famílias e cuidadores nos canais que eles já usam todos os dias." },
  { icon: Users, title: "Família no Cuidado", desc: "Envolva responsáveis e cuidadores na rotina do paciente, com mensagens específicas para cada papel." },
  { icon: MessageCircleHeart, title: "Orientações com Empatia", desc: "Conteúdos sobre alimentação, sono, atividade física e medicação em linguagem acessível para o paciente e quem cuida dele." },
  { icon: Repeat, title: "Acompanhamento Contínuo", desc: "Reengajamento automático e atualização de status ao longo de toda a jornada, sem trabalho manual." },
];

export const Benefits = () => (
  <section id="beneficios" className="bg-gradient-soft py-24">
    <div className="container grid gap-16 lg:grid-cols-2 lg:items-center">
      <div>
        <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-brand/70">Benefícios</p>
        <h2 className="font-display text-3xl font-bold leading-tight text-brand md:text-4xl lg:text-5xl">
          Cuidar de Chagas é cuidar de toda a rede ao redor do paciente.
        </h2>
        <p className="mt-5 text-lg text-muted-foreground">
          Eduque, engaje e apoie pacientes, famílias e cuidadores com a comunicação certa, no momento certo e no canal que eles já usam — WhatsApp ou SMS.
        </p>
        <ul className="mt-8 space-y-3">
          {["Maior adesão à medicação com apoio da família", "Orientações educativas para paciente, cuidadores e responsáveis", "Redução do abandono do acompanhamento clínico"].map((t) => (
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