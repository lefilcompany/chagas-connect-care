import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { FolderDef } from "@/hooks/useFolders";
import { STATUS_LABEL, type LibraryStatus } from "./types";

export type LibraryFiltersValue = {
  q: string;
  folder: string;
  audience: string;
  status: LibraryStatus | "todas";
};

const STATUS_ORDER: (LibraryStatus | "todas")[] = [
  "todas", "aprovado", "rascunho", "revisao-clinica", "revisao-privacidade", "expirando", "arquivado",
];

export function LibraryFilters({
  value, onChange, folders,
}: {
  value: LibraryFiltersValue;
  onChange: (v: LibraryFiltersValue) => void;
  folders: FolderDef[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 md:grid-cols-[1fr_200px_200px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={value.q}
            onChange={(e) => onChange({ ...value, q: e.target.value })}
            placeholder="Buscar por título ou trecho do texto…"
            className="pl-9"
          />
        </div>
        <Select value={value.folder} onValueChange={(v) => onChange({ ...value, folder: v })}>
          <SelectTrigger><SelectValue placeholder="Pasta" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as pastas</SelectItem>
            {folders.map((f) => (
              <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={value.audience} onValueChange={(v) => onChange({ ...value, audience: v })}>
          <SelectTrigger><SelectValue placeholder="Público" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todos os públicos</SelectItem>
            <SelectItem value="paciente">Paciente</SelectItem>
            <SelectItem value="familia">Família</SelectItem>
            <SelectItem value="cuidador">Cuidadores</SelectItem>
            <SelectItem value="ambos">Todos os papéis</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_ORDER.map((s) => (
          <Button
            key={s}
            type="button"
            size="sm"
            variant={value.status === s ? "default" : "outline"}
            onClick={() => onChange({ ...value, status: s })}
          >
            {s === "todas" ? "Todos os status" : STATUS_LABEL[s]}
          </Button>
        ))}
      </div>
    </div>
  );
}