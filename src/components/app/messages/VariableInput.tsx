import * as React from "react";
import { format, parse, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** Heuristic: variable name suggests a calendar date. */
export function isDateVariable(key: string): boolean {
  const k = key.toLowerCase();
  if (/(hora|horario|hour|time|horario_inicio|horario_fim|horario_consulta|hora_consulta|hora_medicacao)/.test(k)) return false;
  return /(^|_)(data|date|dia|vencimento|prazo|agendamento|retorno|consulta_em|nascimento)(_|$)/.test(k)
    || k === "data"
    || k.startsWith("data_")
    || k.endsWith("_data");
}

/** Heuristic: variable name suggests a time (hour). */
export function isTimeVariable(key: string): boolean {
  const k = key.toLowerCase();
  return /(^|_)(hora|horario|hour|time)(_|$)/.test(k)
    || k.startsWith("hora_")
    || k.startsWith("horario_")
    || k.endsWith("_hora")
    || k.endsWith("_horario");
}

function formatTimeInput(raw: string): string {
  // Remove non-digits
  const digits = raw.replace(/\D/g, "");
  // Format as HH:mm
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
}

const DATE_FMT = "dd/MM/yyyy";

function parseDate(value: string): Date | undefined {
  if (!value) return undefined;
  const fmts = [DATE_FMT, "yyyy-MM-dd", "dd-MM-yyyy", "dd/MM/yy"];
  for (const f of fmts) {
    const d = parse(value, f, new Date());
    if (isValid(d)) return d;
  }
  return undefined;
}

export function VariableInput({
  varKey,
  value,
  onChange,
  placeholder,
  className,
}: {
  varKey: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const isDate = isDateVariable(varKey);
  const [open, setOpen] = React.useState(false);

  if (!isDate) {
    return (
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={className}
      />
    );
  }

  const selected = parseDate(value);

  return (
    <div className={cn("flex gap-2", className)}>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "dd/mm/aaaa"}
        className="flex-1"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0"
            aria-label="Escolher data"
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            locale={ptBR}
            selected={selected}
            onSelect={(d) => {
              if (d) {
                onChange(format(d, DATE_FMT, { locale: ptBR }));
                setOpen(false);
              }
            }}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}