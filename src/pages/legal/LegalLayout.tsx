import { ReactNode } from "react";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";

interface Props {
  title: string;
  updatedAt: string;
  children: ReactNode;
}

export const LegalLayout = ({ title, updatedAt, children }: Props) => (
  <div className="min-h-screen bg-background font-sans">
    <Header />
    <main className="container max-w-3xl py-12 md:py-16">
      <h1 className="font-display text-3xl md:text-4xl font-bold text-brand">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Última atualização: {updatedAt}</p>
      <article className="prose prose-slate mt-8 max-w-none text-foreground/90
        [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-brand [&_h2]:mt-10 [&_h2]:mb-3
        [&_h3]:font-display [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-brand [&_h3]:mt-6 [&_h3]:mb-2
        [&_p]:my-3 [&_p]:leading-relaxed
        [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-3 [&_ul]:space-y-1
        [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-3 [&_ol]:space-y-1
        [&_a]:text-brand [&_a]:underline">
        {children}
      </article>
    </main>
    <Footer />
  </div>
);