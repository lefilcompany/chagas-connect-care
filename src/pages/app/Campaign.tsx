import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import CampaignTab from "@/components/app/messages/CampaignTab";

export default function Campaign() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const initialTemplateId = params.get("template");

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
            <Link to="/app/conteudos"><ArrowLeft className="h-4 w-4" /> Voltar para Conteúdos</Link>
          </Button>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-brand">
            Disparar campanha
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            Envie um conteúdo ou modelo para muitos destinatários ao mesmo tempo,
            com segmentação por público, segmento salvo ou filtros personalizados.
          </p>
        </div>
      </header>

      <CampaignTab
        initialTemplateId={initialTemplateId ?? undefined}
        onConsumeInitial={() => {
          // Clean query string after CampaignTab consumed the preselection
          navigate("/app/conteudos/campanha", { replace: true });
        }}
      />
    </div>
  );
}