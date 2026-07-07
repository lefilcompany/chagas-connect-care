import { Button } from "@/components/ui/button";
import { ArrowRight, HeartHandshake, MessageCircle, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

export const CTA = () => (
  <section id="contato" className="bg-card py-20 sm:py-24">
    <div className="container">
      <div className="relative overflow-hidden rounded-[2rem] border border-border bg-gradient-care px-6 py-12 shadow-soft sm:px-10 sm:py-16 lg:px-16">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-coral/20 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-mint-soft blur-3xl" aria-hidden />

        <div className="relative grid gap-10 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-care/20 bg-card/75 px-3 py-1.5 text-xs font-semibold text-care">
              <HeartHandshake className="h-4 w-4" aria-hidden /> Cuidado conectado começa com contexto
            </span>
            <h2 className="mt-5 font-display text-3xl font-bold leading-tight text-ink sm:text-4xl lg:text-5xl">
              Organize a comunicação da equipe sem perder de vista quem está sendo cuidado.
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              Acesse o Chagas Connect Care para gerenciar pessoas, redes de apoio, mensagens, jornadas, conteúdos e modelos de WhatsApp em uma única experiência.
            </p>

            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-sm text-foreground/75">
              <span className="inline-flex items-center gap-2"><MessageCircle className="h-4 w-4 text-primary" aria-hidden /> Comunicação centralizada</span>
              <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-care" aria-hidden /> Contexto e rastreabilidade</span>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <Button variant="hero" size="lg" className="group min-w-52" asChild>
              <Link to="/auth">
                Acessar a plataforma
                <ArrowRight className="transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button variant="outlineBrand" size="lg" className="min-w-52" asChild>
              <a href="#topo">Voltar ao início</a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  </section>
);
