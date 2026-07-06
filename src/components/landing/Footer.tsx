import { Instagram, Linkedin, Twitter } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import elo2Logo from "@/assets/elo2-logo.png.asset.json";

const handleLegalClick = () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
};

export const Footer = () => (
  <footer className="border-t border-border bg-card">
    <div className="container py-14">
      <div className="grid gap-10 md:grid-cols-3">
        <div>
          <img src={elo2Logo.url} alt="ELO2" className="h-10 w-auto" />
          <p className="mt-4 max-w-xs text-sm text-muted-foreground">
            Plataforma digital dedicada ao cuidado contínuo da Doença de Chagas.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-8 md:col-span-1">
          <div>
            <h2 className="mb-3 font-display text-sm font-bold text-brand">Plataforma</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#funcionalidades" className="hover:text-brand">Funcionalidades</a></li>
              <li><a href="#beneficios" className="hover:text-brand">Benefícios</a></li>
              <li><a href="#sobre" className="hover:text-brand">Sobre</a></li>
            </ul>
          </div>
          <div>
            <h2 className="mb-3 font-display text-sm font-bold text-brand">Legal</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/politica-de-privacidade" onClick={handleLegalClick} className="hover:text-brand">Política de Privacidade</Link></li>
              <li><Link to="/termos-de-uso" onClick={handleLegalClick} className="hover:text-brand">Termos de Uso</Link></li>
              <li><Link to="/exclusao-de-dados" onClick={handleLegalClick} className="hover:text-brand">Exclusão de Dados</Link></li>
            </ul>
          </div>
        </div>
        <div className="flex flex-col items-start gap-4 md:items-end">
          <Button variant="hero">Fale Conosco</Button>
          <div className="flex gap-2">
            {[
              { Icon: Instagram, label: "Instagram" },
              { Icon: Linkedin, label: "LinkedIn" },
              { Icon: Twitter, label: "Twitter" },
            ].map(({ Icon, label }) => (
              <a
                key={label}
                href="#"
                aria-label={`Abrir perfil no ${label}`}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-brand transition-smooth hover:bg-primary"
              >
                <Icon className="h-4 w-4" aria-hidden />
              </a>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-10 border-t border-border pt-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Chagas Cuidado Digital. Todos os direitos reservados.
      </div>
    </div>
  </footer>
);