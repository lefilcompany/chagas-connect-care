import {
  BarChart3,
  BookOpenCheck,
  GitBranch,
  Inbox,
  LayoutTemplate,
  UsersRound,
} from "lucide-react";

const features = [
  {
    icon: UsersRound,
    title: "Pessoas e rede de cuidado",
    desc: "Organize o paciente e seus vínculos com familiares, cuidadores e médico responsável, mantendo o contexto certo para cada comunicação.",
  },
  {
    icon: Inbox,
    title: "Caixa de cuidado unificada",
    desc: "Centralize conversas, respostas e pendências para que a equipe saiba quem está aguardando retorno e qual ação vem a seguir.",
  },
  {
    icon: GitBranch,
    title: "Jornadas acompanháveis",
    desc: "Estruture orientações, lembretes e acompanhamentos por etapa, público e momento do cuidado, sem depender de controles paralelos.",
  },
  {
    icon: LayoutTemplate,
    title: "Modelos oficiais da Meta",
    desc: "Crie e acompanhe templates de WhatsApp com variáveis, mídia, botões, versões e status de aprovação em um fluxo organizado.",
  },
  {
    icon: BookOpenCheck,
    title: "Biblioteca de conteúdo",
    desc: "Reúna conteúdos educativos, orientações e mensagens validadas para reutilizar com consistência em diferentes jornadas.",
  },
  {
    icon: BarChart3,
    title: "Audiências e insights",
    desc: "Segmente pessoas, acompanhe entregas, respostas, falhas e evolução das jornadas para orientar a operação da equipe.",
  },
];

export const Features = () => (
  <section id="plataforma" className="bg-card py-20 sm:py-24">
    <div className="container">
      <div className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
        <div>
          <span className="care-chip-care">Plataforma de cuidado conectado</span>
          <h2 className="mt-5 font-display text-3xl font-bold leading-tight text-ink sm:text-4xl lg:text-5xl">
            Uma operação de cuidado, não apenas uma ferramenta de disparo.
          </h2>
        </div>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground lg:justify-self-end lg:text-lg">
          Inspirada nas melhores plataformas de comunicação e automação, a experiência organiza a rotina pelo que a equipe precisa resolver: pessoas, jornadas, conversas, conteúdo e acompanhamento.
        </p>
      </div>

      <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {features.map((feature, index) => (
          <article
            key={feature.title}
            className="group relative overflow-hidden rounded-2xl border border-border bg-background p-6 shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-primary/35 hover:shadow-soft"
          >
            <div className="absolute right-4 top-3 font-display text-5xl font-extrabold text-border/45" aria-hidden>
              {String(index + 1).padStart(2, "0")}
            </div>
            <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-mint-soft text-care transition-colors group-hover:bg-care group-hover:text-care-foreground">
              <feature.icon className="h-6 w-6" aria-hidden />
            </div>
            <h3 className="relative mt-5 font-display text-xl font-bold text-ink">{feature.title}</h3>
            <p className="relative mt-3 text-sm leading-6 text-muted-foreground">{feature.desc}</p>
          </article>
        ))}
      </div>
    </div>
  </section>
);
