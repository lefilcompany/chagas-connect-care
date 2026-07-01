import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Wrench } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

function maskPhoneFront(p: string | null | undefined): string {
  if (!p) return "—";
  const s = String(p);
  if (s.length < 4) return s;
  return s.slice(0, Math.max(0, s.length - 4)).replace(/\d/g, "*") + s.slice(-4);
}

export function ChannelsTab() {
  const qc = useQueryClient();
  const [repairing, setRepairing] = useState(false);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["superadmin-whatsapp-channels"],
    queryFn: async () => {
      const { data, error } = await supabase.from("whatsapp_channels" as any).select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  async function doRepair() {
    setRepairing(true);
    const { data: res, error } = await supabase.functions.invoke("repair-whatsapp-channel", { body: {} });
    setRepairing(false);
    if (error || !(res as any)?.ok) {
      toast.error(error?.message ?? (res as any)?.error ?? "Falha ao corrigir o canal.");
      return;
    }
    toast.success("Canal vinculado com sucesso.");
    qc.invalidateQueries({ queryKey: ["superadmin-whatsapp-channels"] });
    refetch();
  }

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  const channels = (data as any[]) ?? [];

  return (
    <Card className="space-y-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Canais WhatsApp</p>
          <p className="text-xs text-muted-foreground">Todos os canais cadastrados no sistema.</p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="outline" disabled={repairing}>
              <Wrench className={"h-4 w-4 mr-2 " + (repairing ? "animate-pulse" : "")} />
              {repairing ? "Corrigindo…" : "Corrigir vínculo do canal"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Corrigir vínculo do canal</AlertDialogTitle>
              <AlertDialogDescription>
                O sistema validará os identificadores configurados no servidor e corrigirá o vínculo.
                Nenhuma credencial será exibida ou alterada.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={doRepair}>Confirmar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      {channels.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum canal cadastrado.</p>
      ) : (
        channels.map((c) => (
          <div key={c.id} className="rounded-md border border-border p-3 text-sm">
            <p className="font-medium">
              {c.display_name ?? maskPhoneFront(c.display_phone_number) ?? "Sem nome"}
              <span className="ml-2 text-xs text-muted-foreground">· {c.institution ?? "—"}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Número: {maskPhoneFront(c.display_phone_number)} · Modo: {c.mode} · Status: {c.status}
              {c.quality_rating ? ` · Qualidade: ${c.quality_rating}` : ""}
              {c.last_synced_at ? ` · Sincronizado: ${new Date(c.last_synced_at).toLocaleString()}` : ""}
              {c.last_webhook_at ? ` · Último webhook: ${new Date(c.last_webhook_at).toLocaleString()}` : ""}
              {!c.phone_number_id ? " · Vínculo pendente" : ""}
            </p>
            {c.notes && <p className="mt-1 text-xs text-muted-foreground">{c.notes}</p>}
          </div>
        ))
      )}
    </Card>
  );
}