import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SegmentFilters } from "@/lib/segments";
import { useEffect, useState } from "react";

const UF_LIST: { value: string; label: string }[] = [
  { value: "AC", label: "Acre" }, { value: "AL", label: "Alagoas" }, { value: "AP", label: "Amapá" },
  { value: "AM", label: "Amazonas" }, { value: "BA", label: "Bahia" }, { value: "CE", label: "Ceará" },
  { value: "DF", label: "Distrito Federal" }, { value: "ES", label: "Espírito Santo" }, { value: "GO", label: "Goiás" },
  { value: "MA", label: "Maranhão" }, { value: "MT", label: "Mato Grosso" }, { value: "MS", label: "Mato Grosso do Sul" },
  { value: "MG", label: "Minas Gerais" }, { value: "PA", label: "Pará" }, { value: "PB", label: "Paraíba" },
  { value: "PR", label: "Paraná" }, { value: "PE", label: "Pernambuco" }, { value: "PI", label: "Piauí" },
  { value: "RJ", label: "Rio de Janeiro" }, { value: "RN", label: "Rio Grande do Norte" }, { value: "RS", label: "Rio Grande do Sul" },
  { value: "RO", label: "Rondônia" }, { value: "RR", label: "Roraima" }, { value: "SC", label: "Santa Catarina" },
  { value: "SP", label: "São Paulo" }, { value: "SE", label: "Sergipe" }, { value: "TO", label: "Tocantins" },
];

const STAGES = [
  { value: "diagnostico", label: "Diagnóstico" },
  { value: "agudo", label: "Agudo" },
  { value: "cronico", label: "Crônico" },
];

export function SegmentFiltersForm({
  filters,
  onFiltersChange,
}: {
  filters: SegmentFilters;
  onFiltersChange: (f: SegmentFilters) => void;
}) {
  const toggleStage = (s: string, on: boolean) => {
    const cur = filters.stages ?? [];
    onFiltersChange({ ...filters, stages: on ? Array.from(new Set([...cur, s])) : cur.filter((x) => x !== s) });
  };

  const [cities, setCities] = useState<string[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const uf = filters.state ?? "";

  useEffect(() => {
    let cancelled = false;
    if (!uf) { setCities([]); return; }
    setLoadingCities(true);
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`)
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setCities((data ?? []).map((m: any) => m.nome)); })
      .catch(() => { if (!cancelled) setCities([]); })
      .finally(() => { if (!cancelled) setLoadingCities(false); });
    return () => { cancelled = true; };
  }, [uf]);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>Etapa do paciente</Label>
        <div className="flex flex-wrap gap-2">
          {STAGES.map((s) => {
            const on = (filters.stages ?? []).includes(s.value);
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => toggleStage(s.value, !on)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-muted"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Estado (UF)</Label>
          <Select
            value={uf || "todos"}
            onValueChange={(v) =>
              onFiltersChange({ ...filters, state: v === "todos" ? "" : v, city: "" })
            }
          >
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {UF_LIST.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.value} — {s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Cidade</Label>
          <Select
            value={filters.city || "todas"}
            onValueChange={(v) => onFiltersChange({ ...filters, city: v === "todas" ? "" : v })}
            disabled={!uf || loadingCities}
          >
            <SelectTrigger>
              <SelectValue placeholder={!uf ? "Selecione um estado" : loadingCities ? "Carregando..." : "Todas"} />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="todas">Todas</SelectItem>
              {cities.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Idade mínima</Label>
          <Input
            type="number"
            min={0}
            max={130}
            value={filters.age_min ?? ""}
            onChange={(e) =>
              onFiltersChange({ ...filters, age_min: e.target.value === "" ? null : Number(e.target.value) })
            }
            placeholder="Sem mínimo"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Idade máxima</Label>
          <Input
            type="number"
            min={0}
            max={130}
            value={filters.age_max ?? ""}
            onChange={(e) =>
              onFiltersChange({ ...filters, age_max: e.target.value === "" ? null : Number(e.target.value) })
            }
            placeholder="Sem máximo"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={filters.status || "todos"} onValueChange={(v) => onFiltersChange({ ...filters, status: v === "todos" ? "" : (v as "ativo" | "inativo") })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="inativo">Inativo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Canal preferido</Label>
          <Select value={filters.channel || "todos"} onValueChange={(v) => onFiltersChange({ ...filters, channel: v === "todos" ? "" : (v as "whatsapp" | "sms") })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="sms">SMS</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}