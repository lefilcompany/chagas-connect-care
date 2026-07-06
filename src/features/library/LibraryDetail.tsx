import { ExternalLink, ShieldCheck } from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FolderOpen } from "lucide-react";
import type { FolderDef } from "@/hooks/useFolders";
import { STATUS_LABEL, STATUS_TONE, type LibraryItem } from "./types";

function formatSeconds(s: number) {
  if (s < 60) return `${s}s de leitura`;
  const m = Math.round(s / 60);
  return `${m} min de leitura`;
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-2 text-sm last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[60%] text-right text-ink">{value}</span>
    </div>
  );
}

export function LibraryDetail({
  item, folders, open, onOpenChange,
}: {
  item: LibraryItem | null;
  folders: FolderDef[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  if (!item) return null;
  const folder = folders.find((f) => f.value === item.category);
  const FolderIcon = folder?.icon ?? FolderOpen;
  const created = new Date(item.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="space-y-3 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={STATUS_TONE[item.status]}>{STATUS_LABEL[item.status]}</Badge>
            <Badge variant="outline" className="border-border bg-secondary text-ink">
              <FolderIcon className="mr-1 h-3 w-3" aria-hidden />
              {folder?.label ?? "Geral"}
            </Badge>
            <span className="text-xs text-muted-foreground">{formatSeconds(item.readingSeconds)}</span>
          </div>
          <SheetTitle className="font-display text-xl leading-tight text-ink">{item.title}</SheetTitle>
          <SheetDescription>
            Conteúdo aprovado para uso em jornadas e envios. Metadados clínicos completos serão
            habilitados quando o schema clínico for liberado.
          </SheetDescription>
        </SheetHeader>

        <section className="mt-6 space-y-6">
          <div>
            <h3 className="font-display text-sm font-semibold text-ink">Corpo</h3>
            <p className="mt-2 whitespace-pre-wrap rounded-xl border border-border bg-secondary/40 p-4 text-sm leading-relaxed text-ink">
              {item.body}
            </p>
          </div>

          <div>
            <h3 className="font-display text-sm font-semibold text-ink">Metadados</h3>
            <div className="mt-2">
              <MetaRow label="Público" value={item.audience || "Não informado"} />
              <MetaRow label="Pasta / assunto" value={folder?.label ?? "Geral"} />
              <MetaRow label="Criado em" value={created} />
              <MetaRow label="Modo de segmentação" value={item.targeting_mode ?? "Todos"} />
              <MetaRow label="Objetivo" value="Definir na próxima fase" />
              <MetaRow label="Estágio clínico" value="Definir na próxima fase" />
              <MetaRow label="Nível de leitura" value="Definir na próxima fase" />
              <MetaRow label="Revisor clínico" value="Definir na próxima fase" />
              <MetaRow label="Data da última revisão" value="Definir na próxima fase" />
              <MetaRow label="Validade" value="Definir na próxima fase" />
              <MetaRow label="Fonte" value="Definir na próxima fase" />
              <MetaRow label="Templates relacionados" value="Definir na próxima fase" />
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-border bg-mint-soft/40 p-3 text-xs text-ink">
            <ShieldCheck className="mt-0.5 h-4 w-4 text-care" aria-hidden />
            <p>
              Ciclo de revisão clínica e de privacidade será registrado como parte da Fase 6.
              Enquanto isso, o status é derivado do preenchimento e da idade do conteúdo.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <a href={`/app/conteudos?id=${item.id}`}>
                <ExternalLink className="h-4 w-4" aria-hidden /> Abrir editor completo
              </a>
            </Button>
          </div>
        </section>
      </SheetContent>
    </Sheet>
  );
}