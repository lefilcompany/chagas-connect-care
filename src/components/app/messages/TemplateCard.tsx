import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Edit3, Send, FilePlus2, Lock } from "lucide-react";
import { type MessageTemplate } from "@/lib/templates";
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
}: {
  template: MessageTemplate;
  onUse: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
}) {
  const isDefault = !!template.is_default;

  return (
    <article className="flex h-full flex-col rounded-2xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-base font-bold text-brand line-clamp-1">{template.name}</h3>
        {isDefault && (
          <Badge variant="outline" className="shrink-0 text-[10px] border-primary/40 text-primary">
            <Lock className="mr-0.5 h-3 w-3" /> Padrão
          </Badge>
        )}
      </div>
      {template.description && (
        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
          {getTemplateDescription(template.name, template.description)}
        </p>
      )}

      <div className="mt-3">
        <WhatsAppPreview body={template.body} variant="compact" />
      </div>

      <div className="mt-auto flex items-center gap-1.5 pt-4">
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
      </div>
    </article>
  );
}