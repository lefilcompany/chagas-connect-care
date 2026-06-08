import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { SegmentFilters } from "@/lib/segments";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

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

function MultiSelect({
  options,
  selected,
  onChange,
  placeholder,
  searchPlaceholder,
  disabled,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (vals: string[]) => void;
  placeholder: string;
  searchPlaceholder: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const toggle = (val: string) => {
    if (selected.includes(val)) {
      onChange(selected.filter((v) => v !== val));
    } else {
      onChange([...selected, val]);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q));
  }, [options, search]);

  const selectedMap = useMemo(() => new Set(selected), [selected]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            open && "ring-2 ring-ring ring-offset-2"
          )}
        >
          <span className="flex-1 truncate text-left">
            {selected.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              <span className="flex flex-wrap gap-1">
                {selected.map((s) => {
                  const opt = options.find((o) => o.value === s);
                  return (
                    <Badge key={s} variant="secondary" className="text-[10px] font-normal gap-1 pr-1">
                      {opt?.label ?? s}
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); toggle(s); }}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); toggle(s); } }}
                        className="cursor-pointer hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </span>
                    </Badge>
                  );
                })}
              </span>
            )}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>Nenhum resultado.</CommandEmpty>
            <CommandGroup>
              {filtered.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={opt.value}
                  onSelect={() => toggle(opt.value)}
                  className="flex items-center gap-2"
                >
                  <Checkbox checked={selectedMap.has(opt.value)} />
                  <span className="flex-1">{opt.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

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

  const selectedStates = filters.state ?? [];
  const selectedCities = filters.city ?? [];

  const [citiesByUf, setCitiesByUf] = useState<Record<string, string[]>>({});
  const [loadingUfs, setLoadingUfs] = useState<string[]>([]);

  useEffect(() => {
    const toLoad = selectedStates.filter((uf) => !citiesByUf[uf] && !loadingUfs.includes(uf));
    if (!toLoad.length) return;

    setLoadingUfs((prev) => [...new Set([...prev, ...toLoad])]);

    const controllers = toLoad.map((uf) => {
      const ctrl = new AbortController();
      fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((data) => {
          const names = (data ?? []).map((m: any) => m.nome);
          setCitiesByUf((prev) => ({ ...prev, [uf]: names }));
        })
        .catch(() => {
          setCitiesByUf((prev) => ({ ...prev, [uf]: [] }));
        })
        .finally(() => {
          setLoadingUfs((prev) => prev.filter((u) => u !== uf));
        });
      return ctrl;
    });

    return () => { controllers.forEach((c) => c.abort()); };
  }, [selectedStates]);

  // Remove cities from deselected states
  useEffect(() => {
    const removedUfs = Object.keys(citiesByUf).filter((uf) => !selectedStates.includes(uf));
    if (!removedUfs.length) return;
    setCitiesByUf((prev) => {
      const next = { ...prev };
      for (const uf of removedUfs) delete next[uf];
      return next;
    });
    const removedCityNames = removedUfs.flatMap((uf) => citiesByUf[uf] ?? []);
    if (removedCityNames.length && selectedCities.length) {
      const stillValid = selectedCities.filter((c) => !removedCityNames.includes(c));
      if (stillValid.length !== selectedCities.length) {
        onFiltersChange({ ...filters, city: stillValid });
      }
    }
  }, [selectedStates]);

  const allCityOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    const seen = new Set<string>();
    for (const uf of selectedStates) {
      const cities = citiesByUf[uf] ?? [];
      for (const c of cities) {
        if (seen.has(c)) continue;
        seen.add(c);
        opts.push({ value: c, label: `${c} (${uf})` });
      }
    }
    return opts;
  }, [selectedStates, citiesByUf]);

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
          <Label>Estados (UF)</Label>
          <MultiSelect
            options={UF_LIST.map((s) => ({ value: s.value, label: `${s.value} — ${s.label}` }))}
            selected={selectedStates}
            onChange={(vals) => onFiltersChange({ ...filters, state: vals, city: [] })}
            placeholder="Selecione os estados"
            searchPlaceholder="Buscar estado..."
          />
        </div>
        <div className="space-y-1.5">
          <Label>Cidades</Label>
          <MultiSelect
            options={allCityOptions}
            selected={selectedCities}
            onChange={(vals) => onFiltersChange({ ...filters, city: vals })}
            placeholder={selectedStates.length === 0 ? "Selecione estados primeiro" : loadingUfs.length ? "Carregando cidades..." : "Selecione as cidades"}
            searchPlaceholder="Buscar cidade..."
            disabled={selectedStates.length === 0 || loadingUfs.length > 0}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="space-y-1.5 flex-1 min-w-[180px]">
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
        <div className="space-y-1.5 flex-1 min-w-[180px]">
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
        <div className="space-y-1.5 flex-1 min-w-[180px]">
          <Label>Status</Label>
          <select
            value={filters.status || ""}
            onChange={(e) => onFiltersChange({ ...filters, status: e.target.value as "ativo" | "inativo" | "" })}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <option value="">Todos</option>
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
          </select>
        </div>
        <div className="space-y-1.5 flex-1 min-w-[180px]">
          <Label>Canal preferido</Label>
          <select
            value={filters.channel || ""}
            onChange={(e) => onFiltersChange({ ...filters, channel: e.target.value as "whatsapp" | "sms" | "" })}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <option value="">Todos</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="sms">SMS</option>
          </select>
        </div>
      </div>
    </div>
  );
}
