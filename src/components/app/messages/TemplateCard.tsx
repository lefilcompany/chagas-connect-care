import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Edit3, Send, FilePlus2, Lock, ShieldCheck, AlertTriangle, Clock, XCircle, PauseCircle, GitBranch, Upload, RefreshCw, Activity } from "lucide-react";
import { META_STATUS_LABEL, type MessageTemplate } from "@/lib/templates";
import { getTemplateDescription } from "@/lib/templateDescriptions";
import { WhatsAppPreview, type WhatsAppPreviewButton } from "./WhatsAppPreview";

function coerceButtons(raw: unknown): WhatsAppPreviewButton[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out: WhatsAppPreviewButton[] = [];
  for (const b of raw) {
    if (!b || typeof b !== "object") continue;
    const rec = b as Record<string, unknown>;
    const type = String(rec.type ?? "").toLowerCase();
    const text = typeof rec.text === "string" ? rec.text : "";
    if (!text) continue;
    if (type === "quick_reply" || type === "url" || type === "phone_number" || type === "copy_code") {
      out.push({ type, text } as WhatsAppPreviewButton);
    }
  }
  return out.length > 0 ? out : undefined;
}

export function StartBlankCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex h-full min-h-[280px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-primary/40 bg-gradient-to-br from-primary/5 to-primary/10 p-6 text-center transition-all hover:border-primary hover:from-primary/10 hover:to-primary/15"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform group-hover:scale-110">
        <FilePlus2 className="h-6 w-6" />
      </div>
      <div>
        <h3 className="font-display text-lg font-bold text-brand">Começar em branco</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Crie um objetivo do zero com o assistente guiado.
        </p>
      </div>
    </button>
  );
}

export function TemplateCard({
  template,
  onUse,
  onEdit,
  onDuplicate,
  onNewVersion,
  variant = "editor",
  useDisabledReason,
  onSubmitToMeta,
  submitting = false,
  onOpenDetails,
}: {
  template: MessageTemplate;
  onUse: () => void;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onNewVersion?: () => void;
  variant?: "editor" | "catalog";
  useDisabledReason?: string;
  onSubmitToMeta?: () => void;
  submitting?: boolean;
  onOpenDetails?: () => void;
}) {
  const isDefault = !!template.is_default;
  const isMeta = template.template_kind === "meta";
  const status = template.meta_status;
  const footerDiverges = !!template.meta_has_local_differences;
  const isCatalog = variant === "catalog";
  const useDisabled = !!useDisabledReason;
  const showDetailsButton =
    isCatalog && isMeta && !!onOpenDetails &&
    (status === "submitted" || status === "rejected" || status === "paused" || (status as string) === "disabled");
  const lastSyncedAt = template.meta_last_synced_at ?? template.last_synced_at ?? null;
  const lastSyncLabel = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : null;

  return (
    <article className="grid h-full grid-rows-[auto_auto_1fr_auto] rounded-2xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-base font-bold text-brand break-words">{template.name}</h3>
        <div className="flex flex-wrap items-center justify-end gap-1 shrink-0">
          {isMeta && status === "approved" && (
            <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-700 dark:text-emerald-300">
              <ShieldCheck className="mr-0.5 h-3 w-3" /> Meta aprovado
            </Badge>
          )}
          {isMeta && status === "submitted" && (
            <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-700 dark:text-amber-300">
              <Clock className="mr-0.5 h-3 w-3" /> Em análise
            </Badge>
          )}
          {isMeta && status === "rejected" && (
            <Badge variant="outline" className="text-[10px] border-rose-500/40 text-rose-700 dark:text-rose-300">
              <XCircle className="mr-0.5 h-3 w-3" /> Rejeitado
            </Badge>
          )}
          {isMeta && status === "paused" && (
            <Badge variant="outline" className="text-[10px] border-slate-500/40 text-slate-700 dark:text-slate-300">
              <PauseCircle className="mr-0.5 h-3 w-3" /> {META_STATUS_LABEL.paused}
            </Badge>
          )}
          {footerDiverges && (
            <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="mr-0.5 h-3 w-3" /> Rodapé divergente
            </Badge>
          )}
          {isDefault && (
            <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">
              <Lock className="mr-0.5 h-3 w-3" /> Padrão
            </Badge>
          )}
          {template.meta_version && template.meta_version > 1 && (
            <Badge variant="outline" className="text-[10px]">v{template.meta_version}</Badge>
          )}
        </div>
      </div>
      {template.description && (
        <div className="mt-2 rounded-lg bg-primary/5 py-2">
          <p className="text-sm leading-relaxed text-foreground">
            {getTemplateDescription(template.name, template.description)}
          </p>
        </div>
      )}

      <div className="mt-3">
        <WhatsAppPreview
          body={template.body}
          variant="compact"
          resolveExamples
          header={template.meta_header_text ?? template.name}
          footer={template.meta_footer_text ?? undefined}
          buttons={coerceButtons(template.meta_buttons)}
        />
      </div>

      <div className="flex flex-col gap-2 pt-4">
        {isCatalog && (
          <div className="text-[11px] text-muted-foreground">
            {lastSyncLabel
              ? <>Última sincronização: <time dateTime={template.last_synced_at ?? undefined}>{lastSyncLabel}</time></>
              : "Ainda não sincronizado"}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            variant="hero"
            size="sm"
            className="flex-1 min-w-[140px]"
            onClick={onUse}
            disabled={useDisabled}
            title={useDisabledReason}
            aria-label={`Usar modelo ${template.name}`}
          >
            <Send className="h-3.5 w-3.5" /> Usar modelo
          </Button>
          {showDetailsButton && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 min-w-[140px]"
              onClick={onOpenDetails}
              title="Acompanhar status de aprovação na Meta"
              aria-label={`Acompanhar status do modelo ${template.name}`}
            >
              <Activity className="h-3.5 w-3.5" /> Acompanhar status
            </Button>
          )}
          {isCatalog && onEdit && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onEdit}
              title="Editar rascunho"
              aria-label="Editar rascunho"
            >
              <Edit3 className="h-4 w-4" />
            </Button>
          )}
          {isCatalog && onSubmitToMeta && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 min-w-[110px]"
              onClick={onSubmitToMeta}
              disabled={submitting}
              title={(template.meta_status as string) === "error" ? "Reenviar para Meta" : "Enviar para Meta"}
              aria-label={(template.meta_status as string) === "error" ? "Reenviar para Meta" : "Enviar para Meta"}
            >
              {(template.meta_status as string) === "error" ? (
                <RefreshCw className="h-3.5 w-3.5" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              {submitting
                ? "Enviando…"
                : (template.meta_status as string) === "error"
                  ? "Reenviar"
                  : "Enviar"}
            </Button>
          )}
          {!isCatalog && onEdit && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onEdit}
              disabled={isDefault}
              title={isDefault ? "Objetivo padrão. Duplique para editar." : "Editar"}
              aria-label="Editar"
            >
              <Edit3 className="h-4 w-4" />
            </Button>
          )}
          {!isCatalog && onDuplicate && (
            <Button variant="ghost" size="icon" onClick={onDuplicate} aria-label="Duplicar" title="Duplicar">
              <Copy className="h-4 w-4" />
            </Button>
          )}
          {!isCatalog && onNewVersion && (
            <Button variant="ghost" size="icon" onClick={onNewVersion} aria-label="Nova versão" title="Criar nova versão para a Meta">
              <GitBranch className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}