import { HeartPulse, LogIn } from "lucide-react";
import { Link } from "react-router-dom";
import elo2Logo from "@/assets/elo2-logo.png.asset.json";

const platformLinks = [
  { label: "Plataforma", href: "#plataforma" },
  { label: "Jornadas", href: "#jornadas" },
  { label: "Segurança", href: "#seguranca" },
  { label: "Para quem", href: "#para-quem" },
];

const handleLegalClick = () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
};

export const Footer = () => (
  <footer className="border-t border-border bg-background">
    <div className="container py-12 sm:py-14">
      <div className="grid gap-10 lg:grid-cols-[1.25fr_0.75fr_0.75fr]">
        <div className="max-w-md">
          <div className="flex items-center gap-3">
            <img src={elo2Logo.url} alt="ELO2" className="h-10 w-auto" />
            <div className="border-l border-border pl-3">
              <p className="font-display text-sm font-bold text-ink">Chagas Connect Care</p>
              <p className="text-xs text-muted-foreground">Centro de cuidado conectado</p>
            </div>
          </div>
          <p className="mt-5 text-sm leading-6 text-muted-foreground">
            Plataforma para organizar comunicação, rede de apoio e acompanhamento de pessoas com doença de Chagas, com WhatsApp como canal principal.
          </p>
          <p className="mt-4 inline-flex items-start gap-2 text-xs leading-5 text-muted-foreground">
            <HeartPulse className="mt-0.5 h-4 w-4 shrink-0 text-care" aria-hidden />
            Apoio à coordenação e educação em saúde. Não substitui atendimento ou decisão clínica.
          </p>
        </div>

        <div>
          <h2 className="font-display text-sm font-bold text-ink">Conheça</h2>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            {platformLinks.map((item) => (
              <li key={item.href}>
                <a href={item.href} className="rounded-md hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="font-display text-sm font-bold text-ink">Acesso e privacidade</h2>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li>
              <Link to="/auth" className="inline-flex items-center gap-2 rounded-md hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <LogIn className="h-4 w-4" aria-hidden /> Entrar na plataforma
              </Link>
            </li>
            <li><Link to="/politica-de-privacidade" onClick={handleLegalClick} className="hover:text-primary">Política de Privacidade</Link></li>
            <li><Link to="/termos-de-uso" onClick={handleLegalClick} className="hover:text-primary">Termos de Uso</Link></li>
            <li><Link to="/exclusao-de-dados" onClick={handleLegalClick} className="hover:text-primary">Exclusão de Dados</Link></li>
          </ul>
        </div>
      </div>

      <div className="mt-10 flex flex-col gap-2 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>© {new Date().getFullYear()} ELO2 — Chagas Connect Care.</span>
        <span>Comunicação em saúde com clareza, contexto e responsabilidade.</span>
      </div>
    </div>
  </footer>
);
