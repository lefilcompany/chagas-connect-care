import { useEffect } from "react";
import { Header } from "@/components/landing/Header";
import { Hero } from "@/components/landing/Hero";
import { Features } from "@/components/landing/Features";
import { Benefits } from "@/components/landing/Benefits";
import { SocialProof } from "@/components/landing/SocialProof";
import { CTA } from "@/components/landing/CTA";
import { Footer } from "@/components/landing/Footer";

const PAGE_DESCRIPTION = "Plataforma de comunicação e coordenação do cuidado para pacientes, familiares, cuidadores e equipes de saúde.";

const Index = () => {
  useEffect(() => {
    document.title = "ELO2 | Chagas Connect Care";
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (description) description.content = PAGE_DESCRIPTION;
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden bg-background font-sans text-foreground">
      <Header />
      <main>
        <Hero />
        <Features />
        <Benefits />
        <SocialProof />
        <CTA />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
