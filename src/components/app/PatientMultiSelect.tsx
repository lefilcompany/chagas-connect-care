import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queries";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

type PatientOpt = { id: string; full_name: string; phone: string | null };

export function PatientMultiSelect({
  selected,
  onChange,
  placeholder = "Selecione pacientes",
  disabled,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: patients = [] } = useQuery<PatientOpt[]>({
    queryKey: [...qk.patients, "multi-select"],
    queryFn: async () => {
      const { data } = await supabase
        .from("patients")
        .select("id, full_name, phone")
        .order("full_name");
      return (data as PatientOpt[]) ?? [];
    },
  });

  const byId = useMemo(() => new Map(patients.map((p) => [p.id, p])), [patients]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter(
      (p) =>
        p.full_name.toLowerCase().includes(q) ||
        (p.phone ?? "").toLowerCase().includes(q),
    );
  }, [patients, search]);

  const toggle = (id: string) => {
    if (selectedSet.has(id)) onChange(selected.filter((x) => x !== id));
    else onChange([...selected, id]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex min-h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            open && "ring-2 ring-ring ring-offset-2",
          )}
        >
          <span className="flex-1 truncate text-left">
            {selected.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              <span className="flex flex-wrap gap-1">
                {selected.map((id) => {
                  const p = byId.get(id);
                  return (
                    <Badge key={id} variant="secondary" className="text-[10px] font-normal gap-1 pr-1">
                      {p?.full_name ?? id.slice(0, 6)}
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); toggle(id); }}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); toggle(id); } }}
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
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar paciente..." value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>Nenhum paciente encontrado.</CommandEmpty>
            <CommandGroup>
              {filtered.map((p) => (
                <CommandItem
                  key={p.id}
                  value={p.id}
                  onSelect={() => toggle(p.id)}
                  className="flex items-center gap-2"
                >
                  <Checkbox checked={selectedSet.has(p.id)} />
                  <span className="flex-1 truncate">{p.full_name}</span>
                  {p.phone && <span className="text-[10px] text-muted-foreground">{p.phone}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}