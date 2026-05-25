import { useQuery } from "@tanstack/react-query";
import { fetchers, qk } from "@/lib/queries";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

export default function Reports() {
  const { data } = useQuery({ queryKey: qk.reports, queryFn: fetchers.reports });
  const byPatient = data?.byPatient ?? [];
  const totals = data?.totals ?? { ok: 0, miss: 0, msgs: 0 };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold text-brand">Relatórios</h1>
        <p className="text-muted-foreground mt-1">Adesão e engajamento dos últimos 30 dias.</p>
      </header>
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Doses confirmadas", v: totals.ok },
          { label: "Doses perdidas", v: totals.miss },
          { label: "Mensagens enviadas", v: totals.msgs },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <div className="text-sm text-muted-foreground">{s.label}</div>
            <div className="mt-2 font-display text-3xl font-bold text-brand">{s.v}</div>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <h2 className="font-display text-lg font-bold text-brand mb-4">Adesão por paciente (%)</h2>
        {byPatient.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">Ainda não há dados de adesão.</div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={byPatient}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" />
              <Tooltip />
              <Bar dataKey="rate" radius={[8, 8, 0, 0]}>
                {byPatient.map((d, i) => (
                  <Cell key={i} fill={d.rate < 70 ? "hsl(var(--destructive))" : "hsl(var(--brand))"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}