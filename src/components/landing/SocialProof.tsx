import { Star } from "lucide-react";

const logos = ["Hospital Vida", "Clínica Coração", "InstitutoSaúde+", "MedCare", "RedeBem", "SUS Digital"];

const testimonials = [
  {
    quote: "Reduzimos as faltas às consultas em mais de 35% no primeiro trimestre. A integração com WhatsApp mudou nossa rotina.",
    name: "Dra. Marina Lopes",
    role: "Cardiologista, Hospital Vida",
  },
  {
    quote: "Finalmente uma plataforma pensada para o cuidado contínuo. A priorização clínica nos ajuda a focar em quem mais precisa.",
    name: "Dr. Rafael Souza",
    role: "Coordenador, Instituto Saúde+",
  },
  {
    quote: "A linha do tempo do paciente é incrível. Tenho todo o histórico em segundos antes da consulta.",
    name: "Enfª Camila Reis",
    role: "Enfermeira-chefe, MedCare",
  },
];

export const SocialProof = () => (
  <section id="sobre" className="py-24">
    <div className="container">
      <p className="text-center text-sm font-semibold uppercase tracking-wider text-brand/70">Marcas de confiança</p>
      <h2 className="mx-auto mt-3 max-w-2xl text-center font-display text-3xl font-bold text-brand md:text-4xl">
        Equipes de saúde que já confiam na plataforma
      </h2>

      <div className="mt-12 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
        {logos.map((l) => (
          <div key={l} className="flex items-center justify-center rounded-xl border border-border bg-card px-4 py-6 text-center font-display text-sm font-bold text-brand/60 transition-smooth hover:text-brand">
            {l}
          </div>
        ))}
      </div>

      <div className="mt-16 grid gap-6 lg:grid-cols-3">
        {testimonials.map((t) => (
          <figure key={t.name} className="rounded-2xl border border-border bg-card p-7 shadow-card">
            <div className="mb-4 flex gap-0.5 text-brand">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-4 w-4" fill="currentColor" />
              ))}
            </div>
            <blockquote className="text-foreground/90">"{t.quote}"</blockquote>
            <figcaption className="mt-5 border-t border-border pt-4">
              <div className="font-semibold text-brand">{t.name}</div>
              <div className="text-sm text-muted-foreground">{t.role}</div>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  </section>
);