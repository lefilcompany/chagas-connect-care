/**
 * Frontend mirror of supabase/functions/_shared/institution-branding.ts.
 *
 * The backend is the source of truth: it resolves the signature/footer at send
 * time and persists `resolved_footer_text` + `footer_delivery_mode` in the
 * `messages` row. The frontend uses this module to render *previews* (campaign
 * step, settings page) so what the user sees matches what the user will send.
 *
 * Keep the logic in sync with the Deno helper — covered by `branding.test.ts`.
 */
import { APP_DISPLAY_NAME } from "@/config/application";

export type SignatureMode = "none" | "institution_name" | "powered_by" | "custom";

export type FooterDeliveryMode =
  | "none"
  | "body_signature"
  | "interactive_footer"
  | "meta_template_footer";

export type TemplateFooterCompatibility =
  | "matches_institution_default"
  | "differs_from_institution_default"
  | "no_local_footer"
  | "no_institution_default";

export type InstitutionWhatsAppSettings = {
  id?: string;
  institution: string;
  brand_name: string | null;
  signature_mode: SignatureMode;
  custom_signature_text: string | null;
  application_display_name: string | null;
  append_signature_to_text: boolean;
  use_native_interactive_footer: boolean;
  use_as_template_footer_default: boolean;
  default_template_footer_text: string | null;
  signature_enabled: boolean;
};

/** Resolves the textual signature for an institution. `null` when disabled/empty. */
export function resolveSignatureText(
  settings: InstitutionWhatsAppSettings | null,
): string | null {
  if (!settings || !settings.signature_enabled) return null;
  const appName = (settings.application_display_name ?? "").trim() || APP_DISPLAY_NAME;
  const brand = (settings.brand_name ?? "").trim() || settings.institution || "";
  switch (settings.signature_mode) {
    case "none":
      return null;
    case "institution_name":
      return brand || null;
    case "powered_by":
      return `Powered by ${appName}`;
    case "custom": {
      const t = (settings.custom_signature_text ?? "").trim();
      return t.length > 0 ? t : null;
    }
    default:
      return null;
  }
}

/**
 * Appends a signature to a free-text body. Idempotent: existing signature lines
 * (with or without italic markers) are not duplicated.
 */
export function appendSignatureToFreeText(
  body: string,
  signature: string | null,
): string {
  const src = (body ?? "").replace(/\s+$/g, "");
  if (!signature) return src;
  const sig = signature.trim();
  if (!sig) return src;
  const italic = `_${sig}_`;
  const tail = src.slice(-Math.max(sig.length, italic.length) - 4).toLowerCase();
  if (tail.includes(italic.toLowerCase()) || tail.includes(sig.toLowerCase())) {
    return src;
  }
  return `${src}\n\n${italic}`;
}

/** Resolves the interactive footer text (≤60 chars). `null` when disabled. */
export function resolveInteractiveFooter(
  settings: InstitutionWhatsAppSettings | null,
  explicit?: string | null,
): string | null {
  if (explicit) return explicit.slice(0, 60);
  if (!settings || !settings.use_native_interactive_footer) return null;
  const sig = resolveSignatureText(settings);
  return sig ? sig.slice(0, 60) : null;
}

/**
 * Compares a template's local footer against the institution default
 * to surface divergence in UI.
 */
export function computeFooterCompatibility(
  templateFooter: string | null | undefined,
  settings: InstitutionWhatsAppSettings | null,
): TemplateFooterCompatibility {
  const local = (templateFooter ?? "").trim();
  const def = (settings?.default_template_footer_text ?? "").trim();
  if (!def) return local ? "no_institution_default" : "no_institution_default";
  if (!local) return "no_local_footer";
  return local === def
    ? "matches_institution_default"
    : "differs_from_institution_default";
}