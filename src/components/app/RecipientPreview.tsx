import { useEffect, useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Users } from "lucide-react";
import { Recipient, AUDIENCE_LABELS, AudienceType } from "@/lib/segments";

export function RecipientPreview({
  recipients,
  loading,
  selectedKeys,
  onChange,
}: {
  recipients: Recipient[];
  loading?: boolean;
  selectedKeys: Set<string>;
  onChange: (keys: Set<string>) => void;
}) {
  const [q, setQ] = useState("");

  useEffect(() => {
    // when recipient list changes, default-select all
    onChange(new Set(recipients.map((r) => r.key)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipients]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return recipients;
    return recipients.filter(
      (r) =>
        r.name.toLowerCase().includes(term) ||
        r.patient_name.toLowerCase().includes(term) ||
        (r.phone ?? "").toLowerCase().includes(term),
    );
  }, [recipients, q]);

  const breakdown = useMemo(() => {
    const map: Partial<Record<AudienceType, number>> = {};
    for (const r of recipients) if (selectedKeys.has(r.key)) map[r.relation] = (map[r.relation] ?? 0) + 1;
    return map;
  }, [recipients, selectedKeys]);

  const toggle = (key: string, on: boolean) => {
    const next = new Set(selectedKeys);
    if (on) next.add(key); else next.delete(key);
    onChange(next);
  };
  const setAll = (on: boolean) => onChange(on ? new Set(filtered.map((r) => r.key)) : new Set());

  const total = recipients.length;
  const selected = selectedKeys.size;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium">
          <Users className="h-3.5 w-3.5 text-brand" />
          Enviando para <span className="tabular-nums text-brand">{selected}</span> de <span className="tabular-nums">{total}</span>
        </div>
        {(Object.keys(AUDIENCE_LABELS) as AudienceType[]).map((a) =>
          breakdown[a] ? (
            <Badge key={a} variant="secondary">
              {AUDIENCE_LABELS[a]}: {breakdown[a]}
            </Badge>
          ) : null,
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar destinatário..."
            className="pl-9"
          />
        </div>
        <button
          type="button"
          onClick={() => setAll(true)}
          className="rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
        >
          Marcar todos
        </button>
        <button
          type="button"
          onClick={() => setAll(false)}
          className="rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
        >
          Desmarcar
        </button>
      </div>

      <div className="max-h-72 overflow-y-auto rounded-lg border border-border">
        {loading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Calculando destinatários...</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            {total === 0 ? "Nenhum destinatário corresponde aos filtros." : "Nenhum resultado para a busca."}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((r) => (
              <li key={r.key} className="flex items-center gap-3 p-3 text-sm">
                <Checkbox
                  checked={selectedKeys.has(r.key)}
                  onCheckedChange={(v) => toggle(r.key, !!v)}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{r.name}</span>
                    <Badge variant="outline" className="text-[10px] uppercase">{r.relation}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {r.kind === "contact" && <span>Paciente: {r.patient_name} · </span>}
                    {r.phone || "—"} · <span className="uppercase">{r.channel}</span>
                    {r.city ? <> · {r.city}{r.state ? `/${r.state}` : ""}</> : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}