import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AUDIENCE_LABELS, AudienceType, SegmentFilters } from "@/lib/segments";

const STAGES = [
  { value: "diagnostico", label: "Diagnóstico" },
  { value: "agudo", label: "Agudo" },
  { value: "cronico", label: "Crônico" },
];

export function SegmentFiltersForm({
  audienceTypes,
  onAudienceChange,
  filters,
  onFiltersChange,
}: {
  audienceTypes: AudienceType[];
  onAudienceChange: (v: AudienceType[]) => void;
  filters: SegmentFilters;
  onFiltersChange: (f: SegmentFilters) => void;
}) {
  const toggleAud = (a: AudienceType, on: boolean) => {
    onAudienceChange(on ? Array.from(new Set([...audienceTypes, a])) : audienceTypes.filter((x) => x !== a));
  };
  const toggleStage = (s: string, on: boolean) => {
    const cur = filters.stages ?? [];
    onFiltersChange({ ...filters, stages: on ? Array.from(new Set([...cur, s])) : cur.filter((x) => x !== s) });
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>Tipo de público</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(Object.keys(AUDIENCE_LABELS) as AudienceType[]).map((a) => (
            <label key={a} className="flex items-center gap-2 rounded-lg border border-border p-2 text-sm cursor-pointer hover:bg-muted/50">
              <Checkbox
                checked={audienceTypes.includes(a)}
                onCheckedChange={(v) => toggleAud(a, !!v)}
              />
              <span>{AUDIENCE_LABELS[a]}</span>
            </label>
          ))}
        </div>
      </div>

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
          <Label>Cidade</Label>
          <Input
            value={filters.city ?? ""}
            onChange={(e) => onFiltersChange({ ...filters, city: e.target.value })}
            placeholder="Ex: Recife"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Estado (UF)</Label>
          <Input
            value={filters.state ?? ""}
            onChange={(e) => onFiltersChange({ ...filters, state: e.target.value.toUpperCase() })}
            placeholder="SP"
            maxLength={2}
            className="uppercase"
          />
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
        <div className="space-y-1.5">
          <Label>Instituição</Label>
          <Input
            value={filters.institution ?? ""}
            onChange={(e) => onFiltersChange({ ...filters, institution: e.target.value })}
            placeholder="Contém..."
          />
        </div>
      </div>
    </div>
  );
}