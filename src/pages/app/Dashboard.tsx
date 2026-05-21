import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, MessageCircle, Activity, Pill } from "lucide-react";
import { Link } from "react-router-dom";

type Stats = { patients: number; messagesToday: number; adherence30: number; meds: number };

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ patients: 0, messagesToday: 0, adherence30: 0, meds: 0 });

  useEffect(() => {
    (async () => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const thirty = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      const [p, m, mt, ad] = await Promise.all([
        supabase.from("patients").select("id", { count: "exact", head: true }),
        supabase.from("medications").select("id", { count: "exact", head: true }),
        supabase.from("messages").select("id", { count: "exact", head: true }).gte("sent_at", today.toISOString()),
        supabase.from("adherence_events").select("event_type").gte("occurred_at", thirty),
      ]);
      const events = ad.data ?? [];
      const ok = events.filter((e) => e.event_type === "confirmado").length;
      const adh = events.length ? Math.round((ok / events.length) * 100) : 0;
      setStats({ patients: p.count ?? 0, messagesToday: mt.count ?? 0, adherence30: adh, meds: m.count ?? 0 });
    })();
  }, []);

  const cards = [
    { label: "Pacientes ativos", value: stats.patients, icon: Users, to: "/app/pacientes" },
    { label: "Mensagens hoje", value: stats.messagesToday, icon: MessageCircle, to: "/app/mensagens" },
    { label: "Adesão 30 dias", value: `${stats.adherence30}%`, icon: Activity, to: "/app/relatorios" },
    { label: "Medicações ativas", value: stats.meds, icon: Pill, to: "/app/pacientes" },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-bold text-brand">Painel</h1>
        <p className="text-muted-foreground mt-1">Visão geral do cuidado conectado da sua equipe.</p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} to={c.to} className="rounded-2xl border border-border bg-card p-6 shadow-card hover:shadow-soft hover:-translate-y-0.5 transition-smooth">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">{c.label}</div>
                <div className="mt-2 font-display text-3xl font-bold text-brand">{c.value}</div>
              </div>
              <div className="h-10 w-10 rounded-xl bg-primary/50 text-brand flex items-center justify-center">
                <c.icon className="h-5 w-5" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <h2 className="font-display text-lg font-bold text-brand">Próximos passos</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground list-disc pl-5">
            <li>Cadastre seus pacientes e a família/cuidador responsável.</li>
            <li>Registre as medicações e configure os lembretes.</li>
            <li>Envie a primeira mensagem educativa via WhatsApp ou SMS.</li>
            <li>Acompanhe a adesão nos relatórios.</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <h2 className="font-display text-lg font-bold text-brand">Atenção clínica</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Pacientes com Doença de Chagas têm risco aumentado de morte súbita sem controle adequado da dieta. Mantenha o envio de orientações nutricionais consistente para o paciente e seus familiares.
          </p>
        </div>
      </div>
    </div>
  );
}