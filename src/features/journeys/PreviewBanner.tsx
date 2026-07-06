import { Info } from "lucide-react";

export function PreviewBanner() {
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-xl border border-coral/40 bg-coral-soft/60 p-4 text-sm text-ink"
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
      <div className="space-y-1">
        <p className="font-semibold">Pré-visualização de Jornadas</p>
        <p className="text-muted-foreground">
          Você pode desenhar, salvar e revisar estruturas com segurança. O motor de
          execução ainda não está ativo — nenhuma mensagem é disparada e os dados
          ficam salvos apenas neste navegador enquanto validamos o modelo.
        </p>
      </div>
    </div>
  );
}