import { useState } from "react";
import { AlertTriangle, Building2, CheckCircle2, Clock, HelpCircle, RefreshCw, Wrench, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSuperAdminScope } from "@/lib/superadmin-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

type Check = { id: string; label: string; state: string; detail?: string };

function StateIcon({ state }: { state: string }) {
  if (state === "configurado") return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  if (["aguardando_evento", "sem_eventos_recentes"].includes(state)) return <Clock className="h-4 w-4 text-amber-600" />;
  if (["nao_configurado", "conflito"].includes(state)) return <XCircle className="h-4 w-4 text-red-600" />;
  return <HelpCircle className="h-4 w-4 text-muted-foreground" />;
}

export default function WhatsAppDiagnostics() {
  const { selectedInstitution } = useSuperAdminScope();
  const [checks, setChecks] = useState<Check[]>([]);
  const [running, setRunning] = useState(false);
  const [repairing, setRepairing] = useState(false);

  const run = async () => {
    if (!selectedInstitution) return;
    setRunning(true);
    const { data, error } = await supabase.functions.invoke("whatsapp-diagnostics", { body: { institution: selectedInstitution } });
    setRunning(false);
    if (error || !(data as { ok?: boolean } | null)?.ok) {
      toast.error(error?.message ?? (data as { error?: string } | null)?.error ?? "Falha ao executar diagnóstico.");
      return;
    }
    setChecks((data as { checks?: Check[] }).checks ?? []);
  };

  const repair = async () => {
    if (!selectedInstitution) return;
    setRepairing(true);
    const { data, error } = await supabase.functions.invoke("repair-whatsapp-channel", { body: { institution: selectedInstitution } });
    setRepairing(false);
    if (error || !(data as { ok?: boolean } | null)?.ok) {
      toast.error(error?.message ?? (data as { error?: string } | null)?.error ?? "Falha ao corrigir o vínculo.");
      return;
    }
    toast.success("Vínculo do canal corrigido.");
    await run();
  };

  if (!selectedInstitution) {
    return <Card className="mx-auto max-w-2xl p-8 text-center"><Building2 className="mx-auto h-9 w-9 text-muted-foreground" /><h1 className="mt-4 text-xl font-semibold text-ink">Selecione uma instituição</h1><p className="mt-2 text-sm text-muted-foreground">O diagnóstico técnico precisa de um escopo institucional específico.</p></Card>;
  }

  const needsRepair = checks.some((check) => check.id === "channel_binding" && ["nao_configurado", "conflito"].includes(check.state));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-care">WhatsApp · {selectedInstitution}</p><h1 className="mt-1 font-display text-3xl font-bold text-ink">Diagnóstico da integração</h1><p className="mt-2 text-sm text-muted-foreground">A tela mostra somente estados técnicos. Tokens, segredos e identificadores completos nunca são retornados.</p></div>
        <div className="flex gap-2">
          {needsRepair && (
            <AlertDialog>
              <AlertDialogTrigger asChild><Button variant="outline" disabled={repairing}><Wrench className="h-4 w-4" />{repairing ? "Corrigindo…" : "Corrigir vínculo"}</Button></AlertDialogTrigger>
              <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Corrigir vínculo do canal?</AlertDialogTitle><AlertDialogDescription>O sistema validará a configuração do servidor e atualizará somente o canal da instituição selecionada. Nenhuma credencial será exibida.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={repair}>Confirmar correção</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
            </AlertDialog>
          )}
          <Button onClick={run} disabled={running}><RefreshCw className={`h-4 w-4 ${running ? "animate-spin" : ""}`} />{running ? "Executando…" : "Executar diagnóstico"}</Button>
        </div>
      </header>

      <Card className="p-5">
        {checks.length === 0 ? (
          <div className="py-8 text-center"><AlertTriangle className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-3 font-medium text-ink">Diagnóstico ainda não executado</p><p className="mt-1 text-sm text-muted-foreground">Execute a verificação para consultar o estado atual da integração.</p></div>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {checks.map((check) => (
              <li key={check.id} className="flex flex-wrap items-center gap-3 p-4 text-sm">
                <StateIcon state={check.state} />
                <div className="min-w-[220px] flex-1"><p className="font-medium text-ink">{check.label}</p>{check.detail && <p className="mt-1 text-xs text-muted-foreground">{check.detail}</p>}</div>
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">{check.state.replaceAll("_", " ")}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
