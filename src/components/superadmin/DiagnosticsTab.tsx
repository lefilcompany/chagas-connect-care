import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RefreshCw, CheckCircle2, XCircle, HelpCircle, Clock, AlertTriangle, Wrench } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

function prettyState(s: string): string {
  switch (s) {
    case "configurado": return "configurado";
    case "aguardando_evento": return "aguardando evento";
    case "sem_eventos_recentes": return "sem eventos recentes";
    case "nao_configurado": return "não configurado";
    case "conflito": return "conflito";
    default: return "desconhecido";
  }
}

function StateIcon({ state }: { state: string }) {
  switch (state) {
    case "configurado": return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
    case "aguardando_evento": return <Clock className="h-4 w-4 text-amber-600" />;
    case "sem_eventos_recentes": return <AlertTriangle className="h-4 w-4 text-amber-600" />;
    case "nao_configurado":
    case "conflito": return <XCircle className="h-4 w-4 text-red-600" />;
    default: return <HelpCircle className="h-4 w-4 text-muted-foreground" />;
  }
}

export function DiagnosticsTab() {
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [checks, setChecks] = useState<Array<{ id: string; label: string; state: string; detail?: string }>>([]);

  async function onRun() {
    setRunning(true);
    const { data, error } = await supabase.functions.invoke("whatsapp-diagnostics", { body: {} });
    setRunning(false);
    if (error || !(data as any)?.ok) {
      toast.error(error?.message ?? "Falha ao executar diagnóstico");
      return;
    }
    setChecks((data as any).checks ?? []);
  }

  async function onRepair() {
    setRepairing(true);
    const { data: res, error } = await supabase.functions.invoke("repair-whatsapp-channel", { body: {} });
    setRepairing(false);
    if (error || !(res as any)?.ok) {
      toast.error(error?.message ?? (res as any)?.error ?? "Falha ao corrigir o canal.");
      return;
    }
    toast.success("Canal vinculado com sucesso.");
    qc.invalidateQueries({ queryKey: ["superadmin-whatsapp-channels"] });
    await onRun();
  }

  const needsRepair = checks.some(
    (c) => c.id === "channel_binding" && (c.state === "nao_configurado" || c.state === "conflito"),
  );

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Diagnóstico da integração</p>
          <p className="text-xs text-muted-foreground">
            Mostra apenas o estado de cada item — nunca exibe valores sensíveis.
          </p>
        </div>
        <div className="flex gap-2">
          {needsRepair && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline" disabled={repairing}>
                  <Wrench className={"h-4 w-4 mr-2 " + (repairing ? "animate-pulse" : "")} />
                  {repairing ? "Corrigindo…" : "Corrigir vínculo"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Corrigir vínculo do canal</AlertDialogTitle>
                  <AlertDialogDescription>
                    O sistema validará os identificadores configurados no servidor e corrigirá o vínculo.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={onRepair}>Confirmar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button size="sm" onClick={onRun} disabled={running}>
            <RefreshCw className={"h-4 w-4 mr-2 " + (running ? "animate-spin" : "")} />
            {running ? "Executando…" : "Executar diagnóstico"}
          </Button>
        </div>
      </div>
      {checks.length === 0 ? (
        <p className="text-sm text-muted-foreground">Clique em "Executar diagnóstico" para começar.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {checks.map((c) => (
            <li key={c.id} className="flex items-center gap-3 p-3 text-sm">
              <StateIcon state={c.state} />
              <span className="flex-1">{c.label}</span>
              <span className="text-xs text-muted-foreground">
                {prettyState(c.state)}{c.detail ? ` · ${c.detail}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}