// Shared helper for institution-level WhatsApp branding/signature/footer.
// Used by send-whatsapp (and future flows) to keep resolution rules in one place.

export type SignatureMode = "none" | "institution_name" | "powered_by" | "custom";

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

const DEFAULT_APP_NAME = "Chagas Digital Care";

function getDefaultAppName(): string {
  // Non-sensitive env var; falls back to product name.
  // deno-lint-ignore no-explicit-any
  const env = (globalThis as any).Deno?.env?.get?.("APPLICATION_DISPLAY_NAME");
  return (env ?? DEFAULT_APP_NAME) || DEFAULT_APP_NAME;
}

/**
 * Loads the branding row for `institution`. Returns `null` when not configured
 * (callers should then skip any signature/footer mutation).
 */
export async function resolveInstitutionBranding(
  // deno-lint-ignore no-explicit-any
  admin: any,
  institution: string,
): Promise<InstitutionWhatsAppSettings | null> {
  if (!institution) return null;
  const { data } = await admin
    .from("institution_whatsapp_settings")
    .select(
      "id, institution, brand_name, signature_mode, custom_signature_text, application_display_name, append_signature_to_text, use_native_interactive_footer, use_as_template_footer_default, default_template_footer_text, signature_enabled",
    )
    .eq("institution", institution)
    .maybeSingle();
  return (data as InstitutionWhatsAppSettings | null) ?? null;
}

/**
 * Resolves the textual signature according to the configured mode + fallbacks.
 * Returns `null` when signatures are disabled or empty.
 */
export function resolveSignatureText(
  settings: InstitutionWhatsAppSettings | null,
): string | null {
  if (!settings) return null;
  if (!settings.signature_enabled) return null;
  const appName = (settings.application_display_name ?? "").trim() || getDefaultAppName();
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
 * Appends a signature to a free-text body. Idempotent: if the body already
 * ends with the resolved signature (italicized or not), the body is returned
 * unchanged so retries don't duplicate the line.
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
  // Normalize for comparison
  const tail = src.slice(-Math.max(sig.length, italic.length) - 4).toLowerCase();
  if (tail.includes(italic.toLowerCase()) || tail.includes(sig.toLowerCase())) {
    return src;
  }
  return `${src}\n\n${italic}`;
}

/**
 * Resolves the footer text for an interactive message. Respects an explicit
 * override and the institution toggle. Truncates over the Meta 60-char limit
 * (caller may also enforce a hard error).
 */
export function resolveInteractiveFooter(
  settings: InstitutionWhatsAppSettings | null,
  explicit?: string | null,
): string | null {
  const e = (explicit ?? "").trim();
  if (e) return e.slice(0, 60);
  if (!settings) return null;
  if (!settings.signature_enabled) return null;
  if (!settings.use_native_interactive_footer) return null;
  const sig = resolveSignatureText(settings);
  return sig ? sig.slice(0, 60) : null;
}

/**
 * Default footer text when creating new Meta templates from this institution.
 */
export function resolveDefaultTemplateFooter(
  settings: InstitutionWhatsAppSettings | null,
): string | null {
  if (!settings) return null;
  if (!settings.use_as_template_footer_default) return null;
  const explicit = (settings.default_template_footer_text ?? "").trim();
  if (explicit) return explicit.slice(0, 60);
  const sig = resolveSignatureText(settings);
  return sig ? sig.slice(0, 60) : null;
}

/**
 * Returns a non-sensitive snapshot suitable for `messages.branding_settings_snapshot`.
 */
export function brandingSnapshot(
  settings: InstitutionWhatsAppSettings | null,
): Record<string, unknown> | null {
  if (!settings) return null;
  return {
    institution: settings.institution,
    brand_name: settings.brand_name,
    signature_mode: settings.signature_mode,
    signature_enabled: settings.signature_enabled,
    append_signature_to_text: settings.append_signature_to_text,
    use_native_interactive_footer: settings.use_native_interactive_footer,
    application_display_name:
      settings.application_display_name ?? getDefaultAppName(),
  };
}