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

  const smoothScrollToId = (id: string, duration = 500, offset = 80) => {
    const target = document.querySelector(id);
    if (!target) return;
    const targetPosition = target.getBoundingClientRect().top + window.scrollY - offset;
    const startPosition = window.scrollY;
    const distance = targetPosition - startPosition;
    let startTime: number | null = null;

    const easeInOutCubic = (t: number) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const animation = (currentTime: number) => {
      if (startTime === null) startTime = currentTime;
      const timeElapsed = currentTime - startTime;
      const progress = Math.min(timeElapsed / duration, 1);
      const ease = easeInOutCubic(progress);
      window.scrollTo(0, startPosition + distance * ease);
      if (progress < 1) requestAnimationFrame(animation);
    };

    requestAnimationFrame(animation);
  };

  const handleAnchorClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const id = href.replace("#", "");
    smoothScrollToId(`#${id}`);
    window.history.pushState(null, "", href);
    closeMenu();
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/70 bg-background/90 backdrop-blur-xl">
      <div className="container flex min-h-16 items-center justify-between gap-6 py-3">
        <a href="#topo" className="flex min-w-0 items-center gap-3" aria-label="ELO2 Chagas Connect Care — início" onClick={(e) => handleAnchorClick(e, "#topo")}>
          <img src={elo2Logo.url} alt="ELO2" className="h-9 w-auto shrink-0" />
        </a>

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Navegação da página inicial">
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={(e) => handleAnchorClick(e, item.href)}
              className="rounded-md text-sm font-medium text-foreground/75 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Button variant="ghost" className="text-brand hover:text-care" asChild>
            <Link to="/auth">Entrar</Link>
          </Button>
          <Button variant="hero" asChild>
            <a href="#plataforma" onClick={(e) => handleAnchorClick(e, "#plataforma")}>Conhecer a plataforma</a>
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
                onClick={(e) => handleAnchorClick(e, item.href)}
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
                <a href="#plataforma" onClick={(e) => handleAnchorClick(e, "#plataforma")}>Conhecer a plataforma</a>
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
