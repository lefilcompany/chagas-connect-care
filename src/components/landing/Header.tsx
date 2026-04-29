import { Heart, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const nav = [
  { label: "Funcionalidades", href: "#funcionalidades" },
  { label: "Benefícios", href: "#beneficios" },
  { label: "Sobre", href: "#sobre" },
  { label: "Contato", href: "#contato" },
];

export const Header = () => {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="container flex h-18 items-center justify-between py-4">
        <a href="#" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-brand-foreground">
            <Heart className="h-5 w-5" fill="currentColor" />
          </span>
          <span className="font-display text-lg font-bold text-brand">
            Chagas <span className="font-medium text-foreground">Cuidado Digital</span>
          </span>
        </a>
        <nav className="hidden items-center gap-8 md:flex">
          {nav.map((n) => (
            <a key={n.href} href={n.href} className="text-sm font-medium text-foreground/80 transition-colors hover:text-brand">
              {n.label}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          <Button variant="ghost" className="text-brand hover:bg-primary/40">Saiba mais</Button>
          <Button variant="hero">Cadastre-se agora</Button>
        </div>
        <button className="md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
          <Menu className="h-6 w-6 text-brand" />
        </button>
      </div>
      {open && (
        <div className="border-t border-border bg-background md:hidden">
          <div className="container flex flex-col gap-3 py-4">
            {nav.map((n) => (
              <a key={n.href} href={n.href} className="py-2 text-sm font-medium text-foreground/80">{n.label}</a>
            ))}
            <Button variant="hero" className="w-full">Cadastre-se agora</Button>
          </div>
        </div>
      )}
    </header>
  );
};