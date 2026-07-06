import { CheckCircle2, XCircle, User } from "lucide-react";

export type AuditRow = {
  id: string;
  created_at: string;
  actor_role: string | null;
  entity: string | null;
  entity_id: string | null;
  action: string | null;
  result: string | null;
  error_code: string | null;
  correlation_id: string | null;
};

/** Masks a UUID-like identifier for privacy display. */
function maskId(id: string | null | undefined): string {
  if (!id) return "—";
  if (id.length <= 8) return id;
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

export function AuditEventItem({ row }: { row: AuditRow }) {
  const ok = (row.result ?? "").toLowerCase() === "success" || (row.result ?? "").toLowerCase() === "ok";
  const Icon = ok ? CheckCircle2 : XCircle;
  const when = new Date(row.created_at).toLocaleString("pt-BR");
  return (
    <li className="flex items-start gap-3 border-b border-border py-3 last:border-b-0">
      <div className={ok ? "text-care" : "text-destructive"}>
        <Icon className="h-4 w-4" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-ink">
          <span className="font-medium">{row.action ?? "ação"}</span>
          {row.entity ? <> em <span className="font-medium">{row.entity}</span></> : null}
          {row.entity_id ? <> · <span className="font-mono text-xs text-muted-foreground">{maskId(row.entity_id)}</span></> : null}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          <User className="mr-1 inline h-3 w-3" aria-hidden />
          {row.actor_role ?? "sistema"} · {when}
          {row.correlation_id ? <> · <span className="font-mono">{maskId(row.correlation_id)}</span></> : null}
          {row.error_code ? <> · <span className="text-destructive">{row.error_code}</span></> : null}
        </p>
      </div>
    </li>
  );
}