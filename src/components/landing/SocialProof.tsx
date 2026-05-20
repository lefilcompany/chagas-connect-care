import { Star } from "lucide-react";

const logos = ["Hospital Vida", "Clínica Coração", "InstitutoSaúde+", "MedCare", "RedeBem", "SUS Digital"];

const testimonials = [
  {
    quote: "Os lembretes via WhatsApp chegam ao paciente e ao filho que cuida dele. Essa rede de apoio fez o esquecimento do benznidazol praticamente desaparecer no meu ambulatório.",
    name: "Dr. Henrique Matos",
    role: "Infectologista, Hospital das Clínicas de Pernambuco",
  },
  {
    quote: "Conseguimos falar com o paciente crônico por SMS e, ao mesmo tempo, orientar a filha cuidadora pelo WhatsApp. Cada um recebe a mensagem certa para o seu papel no cuidado.",
    name: "Dra. Fernanda Queiroz",
    role: "Coordenadora de Cardiologia, Instituto do Coração do Nordeste",
  },
  {
    quote: "Finalmente uma ferramenta que cuida do paciente de Chagas e da família junto. As orientações de alimentação e sono chegam para o paciente e para quem cuida dele, na linguagem certa.",
    name: "Enfª Patrícia Drummond",
    role: "Enfermeira de Referência em Doenças Negligenciadas, Fiocruz",
  },
];

export const SocialProof = () => (
  <section id="sobre" className="py-24">
    <div className="container">
      <p className="text-center text-sm font-semibold uppercase tracking-wider text-brand/70">Marcas de confiança</p>
      <h2 className="mx-auto mt-3 max-w-2xl text-center font-display text-3xl font-bold text-brand md:text-4xl">
        Equipes que cuidam de pacientes e famílias com a nossa plataforma
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