import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

export default function Reports() {
  const [byPatient, setByPatient] = useState<{ name: string; rate: number }[]>([]);
  const [totals, setTotals] = useState({ ok: 0, miss: 0, msgs: 0 });

  useEffect(() => {
    (async () => {
      const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      const { data: events } = await supabase.from("adherence_events").select("patient_id, event_type, patients(full_name)").gte("occurred_at", since);
      const map = new Map<string, { name: string; ok: number; total: number }>();
      (events ?? []).forEach((e: any) => {
        const cur = map.get(e.patient_id) ?? { name: e.patients?.full_name ?? "—", ok: 0, total: 0 };
        cur.total++; if (e.event_type === "confirmado") cur.ok++;
        map.set(e.patient_id, cur);
      });
      const arr = Array.from(map.values()).map((v) => ({ name: v.name, rate: Math.round((v.ok / v.total) * 100) }));
      setByPatient(arr.sort((a, b) => a.rate - b.rate));
      const ok = (events ?? []).filter((e: any) => e.event_type === "confirmado").length;
      const miss = (events ?? []).length - ok;
      const { count } = await supabase.from("messages").select("id", { count: "exact", head: true }).gte("sent_at", since);
      setTotals({ ok, miss, msgs: count ?? 0 });
    })();
  }, []);

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