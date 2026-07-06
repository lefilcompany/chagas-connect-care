import { ShieldCheck, ShieldAlert, ShieldOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export type ConsentValue = "authorized" | "pending" | "revoked" | "unknown";

export function normalizeConsent(raw: string | null | undefined): ConsentValue {
  const v = (raw ?? "").toLowerCase();
  if (v === "authorized" || v === "ativo" || v === "granted") return "authorized";
  if (v === "revoked" || v === "revogado") return "revoked";
  if (v === "pending" || v === "pendente") return "pending";
  return "unknown";
}

const META: Record<ConsentValue, { label: string; tone: string; Icon: typeof ShieldCheck }> = {
  authorized: { label: "Consentimento ativo", tone: "border-care/30 bg-mint-soft text-care", Icon: ShieldCheck },
  pending:    { label: "Consentimento pendente", tone: "border-coral/40 bg-coral-soft text-primary", Icon: ShieldAlert },
  revoked:    { label: "Consentimento revogado", tone: "border-destructive/30 bg-destructive/5 text-destructive", Icon: ShieldOff },
  unknown:    { label: "Consentimento não registrado", tone: "border-border bg-secondary text-muted-foreground", Icon: ShieldOff },
};

export function ConsentStatus({
  value, size = "sm",
}: { value: ConsentValue | string | null | undefined; size?: "sm" | "md" }) {
  const v = typeof value === "string" ? normalizeConsent(value) : (value ?? "unknown");
  const meta = META[v];
  const iconClass = size === "md" ? "h-4 w-4" : "h-3 w-3";
  return (
    <Badge variant="outline" className={`gap-1 ${meta.tone}`}>
      <meta.Icon className={iconClass} aria-hidden />
      {meta.label}
    </Badge>
  );
}