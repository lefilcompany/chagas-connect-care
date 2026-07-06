import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, XCircle, AlertCircle, HelpCircle } from "lucide-react";

type Check = { id: string; label: string; state: string; detail?: string };

const iconFor = (s: string) => {
  if (s === "configurado") return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  if (s === "aguardando_evento" || s === "sem_eventos_recentes") return <AlertCircle className="h-4 w-4 text-amber-600" />;
  if (s === "nao_configurado" || s === "conflito") return <XCircle className="h-4 w-4 text-red-600" />;
  return <HelpCircle className="h-4 w-4 text-muted-foreground" />;
};

export default function WhatsAppDiagnostics() {
  const [checks, setChecks] = useState<Check[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setRunning(true); setError(null);
    const { data, error } = await supabase.functions.invoke("whatsapp-diagnostics", { body: {} });
    setRunning(false);
    if (error) { setError(error.message); return; }
    setChecks((data as { checks?: Check[] })?.checks ?? []);
  };

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink md:text-3xl">Diagnóstico do WhatsApp</h1>
          <p className="mt-1 text-sm text-muted-foreground">Executa checagens técnicas contra a Meta e o banco. Somente Super Admin.</p>
        </div>
        <Button onClick={run} disabled={running}>{running ? "Executando…" : "Executar diagnóstico"}</Button>
      </header>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Card>
        <CardHeader><CardTitle className="text-base">Resultados</CardTitle></CardHeader>
        <CardContent className="p-0">
          {checks.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Nenhuma checagem executada ainda.</p>
          ) : (
            <ul>
              {checks.map((c) => (
                <li key={c.id} className="flex items-start gap-3 border-t border-border px-4 py-3 first:border-0">
                  <span className="mt-0.5">{iconFor(c.state)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink">{c.label}</p>
                    <p className="text-xs text-muted-foreground">{c.detail ?? c.state}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}