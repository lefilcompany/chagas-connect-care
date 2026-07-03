import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { qk } from "@/lib/queries";
import {
  useInstitutionIdentity,
  useInstitutionTemplateService,
} from "@/services/institutionTemplates";
import type { MessageTemplate } from "@/lib/templates";

function statusLabel(s: string | null | undefined): string {
  switch (s) {
    case "submitted": return "Em análise";
    case "approved": return "Aprovado";
    case "rejected": return "Rejeitado";
    case "paused": return "Pausado";
    case "disabled": return "Desativado";
    case "error": return "Erro";
    default: return s ?? "—";
  }
}

function qualityBadgeClass(score: string | null | undefined): string {
  const s = String(score ?? "").toUpperCase();
  if (s === "GREEN") return "border-emerald-500/40 text-emerald-700 dark:text-emerald-300";
  if (s === "YELLOW") return "border-amber-500/40 text-amber-700 dark:text-amber-300";
  if (s === "RED") return "border-rose-500/40 text-rose-700 dark:text-rose-300";
  return "text-muted-foreground";
}

function qualityLabel(score: string | null | undefined): string {
  const s = String(score ?? "").toUpperCase();
  switch (s) {
    case "GREEN": return "Alta";
    case "YELLOW": return "Média";
    case "RED": return "Baixa";
    case "UNKNOWN":
    case "":
      return "Pendente";
    default: return s;
  }
}

export function MetaStatusPanel({
  template,
  onSync,
  syncing,
}: {
  template: MessageTemplate;
  onSync: () => void;
  syncing: boolean;
}) {
  const rec = template as unknown as {
    meta_status?: string | null;
    meta_status_raw?: string | null;
    meta_category?: string | null;
    meta_language?: string | null;
    meta_template_id?: string | null;
    meta_submitted_at?: string | null;
    meta_last_synced_at?: string | null;
    meta_last_webhook_at?: string | null;
    meta_rejection_reason?: string | null;
    meta_rejection_info?: { reason?: string | null } | null;
    meta_definition?: { quality_score?: { score?: string | null; date?: number | null } | null } | null;
  };
  const reason = rec.meta_rejection_reason ?? rec.meta_rejection_info?.reason ?? null;
  const quality = rec.meta_definition?.quality_score?.score ?? null;
  const fmt = (v: string | null | undefined) =>
    v ? new Date(v).toLocaleString("pt-BR") : "—";
  return (
    <section
      aria-label="Status na Meta"
      className="rounded-lg border bg-card/50 p-4 text-sm space-y-3"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Status:</span>
          <Badge variant="outline">{statusLabel(rec.meta_status)}</Badge>
          {rec.meta_status_raw && (
            <span className="text-xs text-muted-foreground">({rec.meta_status_raw})</span>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={onSync} disabled={syncing}>
          <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Sincronizando…" : "Atualizar status"}
        </Button>
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
        {rec.meta_category && (
          <div className="flex gap-2"><dt className="text-muted-foreground">Categoria:</dt><dd>{rec.meta_category}</dd></div>
        )}
        {rec.meta_language && (
          <div className="flex gap-2"><dt className="text-muted-foreground">Idioma:</dt><dd>{rec.meta_language}</dd></div>
        )}
        {quality && (
          <div className="flex items-center gap-2">
            <dt className="text-muted-foreground">Qualidade:</dt>
            <dd><Badge variant="outline" className={qualityBadgeClass(quality)}>{qualityLabel(quality)}</Badge></dd>
          </div>
        )}
        {rec.meta_template_id && (
          <div className="flex gap-2"><dt className="text-muted-foreground">ID Meta:</dt><dd><code>{rec.meta_template_id}</code></dd></div>
        )}
        <div className="flex gap-2"><dt className="text-muted-foreground">Enviado em:</dt><dd>{fmt(rec.meta_submitted_at)}</dd></div>
        <div className="flex gap-2"><dt className="text-muted-foreground">Última sincronização:</dt><dd>{fmt(rec.meta_last_synced_at)}</dd></div>
        <div className="flex gap-2"><dt className="text-muted-foreground">Último webhook:</dt><dd>{fmt(rec.meta_last_webhook_at)}</dd></div>
      </dl>
      {rec.meta_status === "rejected" && reason && (
        <p className="rounded-md bg-destructive/5 p-2 text-xs text-destructive">
          <strong>Motivo da rejeição:</strong> {reason}
        </p>
      )}
      {rec.meta_status === "submitted" && (
        <p className="text-xs text-muted-foreground">
          A Meta costuma responder em minutos, podendo levar até 24h.
        </p>
      )}
    </section>
  );
}

export function MetaStatusDialog({
  template,
  open,
  onOpenChange,
}: {
  template: MessageTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const service = useInstitutionTemplateService();
  const identity = useInstitutionIdentity();
  const qc = useQueryClient();
  const syncMutation = useMutation({
    mutationFn: async () => {
      if (!template) throw new Error("Modelo indisponível.");
      return service.syncFromMeta(template.id);
    },
    onSuccess: () => {
      toast.success("Status atualizado a partir da Meta.");
      if (template) {
        qc.invalidateQueries({ queryKey: ["template-by-id", template.id] });
      }
      qc.invalidateQueries({
        queryKey: qk.institutionTemplates(identity.institution ?? ""),
      });
    },
    onError: (e: Error) => toast.error(e.message ?? "Falha ao sincronizar."),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Status na Meta</DialogTitle>
          <DialogDescription>
            {template
              ? `Acompanhe a aprovação de "${template.name}" pela Meta (WhatsApp Business).`
              : "Acompanhe a aprovação do modelo pela Meta."}
          </DialogDescription>
        </DialogHeader>
        {template && (
          <MetaStatusPanel
            template={template}
            onSync={() => syncMutation.mutate()}
            syncing={syncMutation.isPending}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}