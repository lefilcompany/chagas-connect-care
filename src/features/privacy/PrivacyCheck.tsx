import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { normalizeConsent, type ConsentValue } from "./ConsentStatus";

export type PrivacyCheckInput = {
  consent?: ConsentValue | string | null;
  channel?: string | null;
  phone?: string | null;
  relation?: string | null;
  /** true when the message content includes clinical/sensitive data */
  hasClinicalContent?: boolean;
};

export type PrivacyIssue = { code: string; message: string; severity: "block" | "warn" };

/**
 * Central privacy gate. Returns an ordered list of issues plus a boolean.
 * "block" issues must halt the send; "warn" issues surface confirmations.
 */
export function evaluatePrivacy(input: PrivacyCheckInput): { ok: boolean; issues: PrivacyIssue[] } {
  const issues: PrivacyIssue[] = [];
  const consent = normalizeConsent(input.consent as string);

  if (consent === "revoked") {
    issues.push({ code: "consent_revoked", severity: "block", message: "Consentimento foi revogado — envio não é permitido." });
  } else if (consent === "unknown") {
    issues.push({ code: "consent_unknown", severity: "warn", message: "Sem registro de consentimento. Confirme antes de enviar." });
  } else if (consent === "pending") {
    issues.push({ code: "consent_pending", severity: "warn", message: "Consentimento pendente — o envio deve ser somente para coleta de consentimento." });
  }

  if (!input.phone || input.phone.trim().length < 8) {
    issues.push({ code: "invalid_phone", severity: "block", message: "Número de contato inválido ou ausente." });
  }
  if (input.channel && !["whatsapp", "sms"].includes((input.channel ?? "").toLowerCase())) {
    issues.push({ code: "unsupported_channel", severity: "warn", message: `Canal "${input.channel}" ainda não é enviado automaticamente.` });
  }
  if (input.hasClinicalContent && input.relation && input.relation !== "paciente") {
    issues.push({ code: "clinical_to_third_party", severity: "warn", message: "Conteúdo clínico será enviado a alguém diferente do paciente — verifique autorização específica." });
  }

  return { ok: !issues.some((i) => i.severity === "block"), issues };
}

/** Inline UI component: renders the issues list with tones. */
export function PrivacyCheck(props: PrivacyCheckInput & { className?: string }) {
  const { className, ...input } = props;
  const { issues } = evaluatePrivacy(input);

  if (issues.length === 0) {
    return (
      <div className={`flex items-start gap-2 rounded-lg border border-care/30 bg-mint-soft/60 p-3 text-sm text-care ${className ?? ""}`}>
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>Envio dentro das políticas: consentimento ok, contato válido, canal compatível.</span>
      </div>
    );
  }

  return (
    <ul aria-live="polite" className={`space-y-1.5 ${className ?? ""}`}>
      {issues.map((i) => (
        <li
          key={i.code}
          className={
            "flex items-start gap-2 rounded-lg border p-3 text-sm " +
            (i.severity === "block"
              ? "border-destructive/30 bg-destructive/5 text-destructive"
              : "border-coral/40 bg-coral-soft/60 text-primary")
          }
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            <span className="font-semibold">
              {i.severity === "block" ? "Bloqueio: " : "Atenção: "}
            </span>
            {i.message}
          </span>
        </li>
      ))}
    </ul>
  );
}