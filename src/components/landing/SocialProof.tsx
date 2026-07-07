import {
  Building2,
  ClipboardCheck,
  FileCheck2,
  Fingerprint,
  HeartHandshake,
  LockKeyhole,
  ShieldCheck,
  Stethoscope,
  UsersRound,
} from "lucide-react";

const audiences = [
  {
    icon: Building2,
    title: "Ambulatórios e centros de referência",
    desc: "Para equipes que acompanham pessoas com doença de Chagas e precisam manter contato ao longo do cuidado.",
  },
  {
    icon: Stethoscope,
    title: "Equipes multiprofissionais",
    desc: "Para médicos, enfermagem, agentes de saúde e operação trabalharem com o mesmo contexto de comunicação.",
  },
  {
    icon: HeartHandshake,
    title: "Projetos e programas de saúde",
    desc: "Para iniciativas que combinam educação, lembretes, busca ativa e acompanhamento de públicos específicos.",
  },
];

const safeguards = [
  {
    icon: Fingerprint,
    title: "Consentimento visível",
    desc: "O vínculo e a autorização de cada contato ficam associados à pessoa acompanhada.",
  },
  {
    icon: LockKeyhole,
    title: "Contexto no lugar certo",
    desc: "A equipe consulta informações relevantes sem expor dados além do necessário em cada comunicação.",
  },
  {
    icon: ClipboardCheck,
    title: "Papéis e responsabilidade",
    desc: "A experiência diferencia paciente, familiar, cuidador e profissional para orientar ações e mensagens.",
  },
  {
    icon: FileCheck2,
    title: "Rastreabilidade operacional",
    desc: "Histórico, status, versões e pendências ajudam a revisar o que aconteceu em cada jornada.",
  },
];

export const SocialProof = () => (
  <>
    <section id="para-quem" className="bg-card py-20 sm:py-24">
      <div className="container">
        <div className="mx-auto max-w-3xl text-center">
          <span className="care-chip-care">Feito para quem coordena cuidado</span>
          <h2 className="mt-5 font-display text-3xl font-bold text-ink sm:text-4xl lg:text-5xl">
            Uma linguagem clara para equipes de saúde e para quem está do outro lado da mensagem.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
            A plataforma aproxima operação e assistência sem transformar o relacionamento com pacientes em um fluxo comercial.
          </p>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {audiences.map((audience) => (
            <article key={audience.title} className="rounded-2xl border border-border bg-background p-6 shadow-card">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-coral-soft text-primary">
                <audience.icon className="h-6 w-6" aria-hidden />
              </div>
              <h3 className="mt-5 font-display text-xl font-bold text-ink">{audience.title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{audience.desc}</p>
            </article>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 rounded-2xl border border-border bg-secondary/50 px-6 py-5 text-sm text-foreground/75">
          <span className="inline-flex items-center gap-2"><UsersRound className="h-4 w-4 text-care" aria-hidden /> Pacientes e rede de apoio</span>
          <span className="inline-flex items-center gap-2"><Stethoscope className="h-4 w-4 text-care" aria-hidden /> Equipe assistencial</span>
          <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-care" aria-hidden /> Operação com contexto</span>
        </div>
      </div>
    </section>

    <section id="seguranca" className="relative overflow-hidden bg-ink py-20 text-brand-foreground sm:py-24">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -left-24 top-0 h-80 w-80 rounded-full bg-care/30 blur-3xl" />
        <div className="absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-coral/20 blur-3xl" />
      </div>

      <div className="container relative grid gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:items-start xl:gap-20">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/85">
            <ShieldCheck className="h-4 w-4" aria-hidden /> Segurança desde o desenho
          </span>
          <h2 className="mt-5 font-display text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl">
            Privacidade não deve aparecer apenas no rodapé.
          </h2>
          <p className="mt-5 text-base leading-7 text-white/70 sm:text-lg">
            Consentimento, vínculo, canal, histórico e responsabilidade precisam fazer parte da rotina de comunicação. A interface foi desenhada para tornar esses sinais visíveis antes da ação.
          </p>
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm font-semibold text-white">Comunicação com responsabilidade clínica</p>
            <p className="mt-2 text-sm leading-6 text-white/65">
              O sistema apoia processos administrativos e educativos. Ele não substitui avaliação profissional, diagnóstico ou decisão terapêutica.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {safeguards.map((item) => (
            <article key={item.title} className="rounded-2xl border border-white/10 bg-white/[0.07] p-5 backdrop-blur-sm">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-coral">
                <item.icon className="h-5 w-5" aria-hidden />
              </div>
              <h3 className="mt-4 font-display text-lg font-bold text-white">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-white/65">{item.desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  </>
);
