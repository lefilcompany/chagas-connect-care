import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Edit3, Send, FilePlus2, Lock, ShieldCheck, AlertTriangle, Clock, XCircle, PauseCircle, GitBranch } from "lucide-react";
import { META_STATUS_LABEL, type MessageTemplate } from "@/lib/templates";
import { getTemplateDescription } from "@/lib/templateDescriptions";
import { WhatsAppPreview } from "./WhatsAppPreview";

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
}: {
  template: MessageTemplate;
  onUse: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onNewVersion?: () => void;
}) {
  const isDefault = !!template.is_default;
  const isMeta = template.template_kind === "meta";
  const status = template.meta_status;
  const footerDiverges = !!template.meta_has_local_differences;

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
          footer={template.meta_footer_text ?? undefined}
        />
      </div>

      <div className="flex items-center gap-1.5 pt-4">
        <Button variant="hero" size="sm" className="flex-1" onClick={onUse}>
          <Send className="h-3.5 w-3.5" /> Usar objetivo
        </Button>
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
        <Button variant="ghost" size="icon" onClick={onDuplicate} aria-label="Duplicar" title="Duplicar">
          <Copy className="h-4 w-4" />
        </Button>
        {onNewVersion && (
          <Button variant="ghost" size="icon" onClick={onNewVersion} aria-label="Nova versão" title="Criar nova versão para a Meta">
            <GitBranch className="h-4 w-4" />
          </Button>
        )}
      </div>
    </article>
  );
}