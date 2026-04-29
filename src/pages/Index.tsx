import { Header } from "@/components/landing/Header";
import { Hero } from "@/components/landing/Hero";
import { Features } from "@/components/landing/Features";
import { Benefits } from "@/components/landing/Benefits";
import { SocialProof } from "@/components/landing/SocialProof";
import { CTA } from "@/components/landing/CTA";
import { Footer } from "@/components/landing/Footer";

const Index = () => (
  <div className="min-h-screen bg-background font-sans">
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

export default Index;
