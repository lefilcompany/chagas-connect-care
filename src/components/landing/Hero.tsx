import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import heroImg from "@/assets/hero-platform.jpg";

export const Hero = () => {
  return (
    <section className="relative overflow-hidden bg-gradient-soft">
      <div className="container grid items-center gap-12 py-20 lg:grid-cols-2 lg:py-28">
        <div className="space-y-7">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/60 bg-primary/30 px-4 py-1.5 text-xs font-semibold text-brand">
            <Sparkles className="h-3.5 w-3.5" />
            Atendimento inteligente e humanizado
          </span>
          <h1 className="font-display text-3xl font-extrabold leading-[1.1] tracking-tight text-brand md:text-4xl lg:text-5xl">
            Cuidado contínuo e digital para pacientes com <span className="relative inline-block">
              <span className="absolute inset-x-0 bottom-2 -z-10 h-3 bg-primary" />
              Doença de Chagas
            </span>
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
            Uma plataforma que conecta equipes de saúde aos seus pacientes com comunicação educativa, lembretes de medicação e orientações adaptadas a cada perfil — do diagnóstico ao tratamento crônico.
          </p>
          <div className="flex flex-wrap gap-4">
            <Button variant="hero" size="lg" className="group">
              Cadastre-se agora
              <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
            <Button variant="outlineBrand" size="lg">Solicitar uma demo</Button>
          </div>
          <div className="flex items-center gap-6 pt-4 text-sm text-muted-foreground">
            <div><span className="font-bold text-brand">+10mil</span> pacientes acompanhados</div>
            <div className="h-4 w-px bg-border" />
            <div><span className="font-bold text-brand">98%</span> de satisfação</div>
          </div>
        </div>
        <div className="relative">
          <div className="absolute -inset-6 rounded-3xl bg-primary/40 blur-2xl" />
          <img
            src={heroImg}
            alt="Plataforma Chagas Cuidado Digital em uso por profissional de saúde"
            width={1280}
            height={960}
            className="relative rounded-3xl shadow-soft"
          />
        </div>
      </div>
    </section>
  );
};