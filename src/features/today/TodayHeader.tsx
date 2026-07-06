import { Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export function TodayHeader({ name, institution }: { name?: string; institution?: string }) {
  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });
  const first = (name ?? "").split(" ")[0];
  return (
    <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="text-sm font-medium text-muted-foreground">
          <span className="capitalize">{today}</span>
          {institution ? <> · {institution}</> : null}
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink md:text-[32px] md:leading-[40px]">
          {greeting()}{first ? `, ${first}` : ""}.
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Cuidado em rede, transformado em ações claras. Comece pelo que precisa da sua atenção agora.
        </p>
      </div>
      <Button asChild size="lg">
        <Link to="/app/caixa">
          <Plus className="h-4 w-4" aria-hidden />
          Nova ação de cuidado
        </Link>
      </Button>
    </header>
  );
}