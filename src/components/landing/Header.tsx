import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Link } from "react-router-dom";
import elo2Logo from "@/assets/elo2-logo.png.asset.json";

const nav = [
  { label: "Plataforma", href: "#plataforma" },
  { label: "Jornadas", href: "#jornadas" },
  { label: "Segurança", href: "#seguranca" },
  { label: "Para quem", href: "#para-quem" },
];

export const Header = () => {
  const [open, setOpen] = useState(false);

  const closeMenu = () => setOpen(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/70 bg-background/90 backdrop-blur-xl">
      <div className="container flex min-h-16 items-center justify-between gap-6 py-3">
        <a href="#topo" className="flex min-w-0 items-center gap-3" aria-label="ELO2 Chagas Connect Care — início">
          <img src={elo2Logo.url} alt="ELO2" className="h-9 w-auto shrink-0" />
          <div className="hidden min-w-0 border-l border-border pl-3 sm:block">
            <p className="truncate font-display text-sm font-bold text-ink">Chagas Connect Care</p>
            <p className="truncate text-[11px] text-muted-foreground">Comunicação para cuidado contínuo</p>
          </div>
        </a>

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Navegação da página inicial">
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-md text-sm font-medium text-foreground/75 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Button variant="ghost" className="text-brand" asChild>
            <Link to="/auth">Entrar</Link>
          </Button>
          <Button variant="hero" asChild>
            <a href="#plataforma">Conhecer a plataforma</a>
          </Button>
        </div>

        <button
          type="button"
          className="tap-target inline-flex items-center justify-center rounded-full text-brand hover:bg-secondary md:hidden"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          aria-controls="landing-mobile-menu"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div id="landing-mobile-menu" className="border-t border-border bg-card md:hidden">
          <div className="container flex flex-col gap-1 py-4">
            {nav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={closeMenu}
                className="rounded-xl px-3 py-3 text-sm font-medium text-foreground/80 hover:bg-secondary hover:text-foreground"
              >
                {item.label}
              </a>
            ))}
            <div className="mt-3 grid gap-2 border-t border-border pt-4">
              <Button variant="outline" className="w-full" asChild>
                <Link to="/auth" onClick={closeMenu}>Entrar</Link>
              </Button>
              <Button variant="hero" className="w-full" asChild>
                <a href="#plataforma" onClick={closeMenu}>Conhecer a plataforma</a>
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
