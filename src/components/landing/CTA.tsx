import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export const CTA = () => (
  <section id="contato" className="py-24">
    <div className="container">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-brand px-8 py-16 text-center shadow-soft md:px-16 md:py-20">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/30 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative mx-auto max-w-2xl">
          <h2 className="font-display text-3xl font-bold text-brand-foreground md:text-4xl lg:text-5xl">
            Pronto para cuidar do paciente e da família na mesma jornada?
          </h2>
          <p className="mt-5 text-lg text-brand-foreground/80">
            Comece hoje a engajar pacientes, cuidadores e responsáveis por WhatsApp e SMS.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Button variant="hero" size="lg" className="group">
              Cadastre-se agora
              <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
            <Button size="lg" className="bg-primary text-brand hover:bg-primary/90 shadow-card">Solicitar uma demo</Button>
          </div>
        </div>
      </div>
    </div>
  </section>
);