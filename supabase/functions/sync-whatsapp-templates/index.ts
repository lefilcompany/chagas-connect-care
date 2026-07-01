import { withEdgeHandler, jsonOk, jsonError } from "../_shared/http.ts";
import { requireAuth } from "../_shared/auth.ts";
import { resolveChannel, graphUrl } from "../_shared/resolve-channel.ts";

const STATUS_MAP: Record<string, string> = {
  APPROVED: "approved",
  REJECTED: "rejected",
  PENDING: "submitted",
  IN_APPEAL: "submitted",
  PAUSED: "paused",
  DISABLED: "disabled",
  PENDING_DELETION: "disabled",
  DELETED: "disabled",
};

/** Extract structured fields from Meta `components` array. */
function parseComponents(components: unknown) {
  const list = Array.isArray(components) ? (components as any[]) : [];
  let headerType: string | null = null;
  let headerText: string | null = null;
  let bodyText: string | null = null;
  let footerText: string | null = null;
  let buttons: any[] | null = null;
  let carouselCards: any[] | null = null;
  let authConfig: any | null = null;

  for (const comp of list) {
    const type = String(comp?.type ?? "").toUpperCase();
    if (type === "HEADER") {
      headerType = String(comp?.format ?? "TEXT").toLowerCase();
      headerText = comp?.text ?? null;
    } else if (type === "BODY") {
      bodyText = comp?.text ?? null;
    } else if (type === "FOOTER") {
      footerText = comp?.text ?? null;
    } else if (type === "BUTTONS") {
      buttons = Array.isArray(comp?.buttons) ? comp.buttons : null;
    } else if (type === "CAROUSEL") {
      carouselCards = Array.isArray(comp?.cards) ? comp.cards : null;
    } else if (type === "LIMITED_TIME_OFFER" || type === "ONE_TIME_PASSWORD" || type === "OTP") {
      authConfig = comp;
    }
  }

  return { headerType, headerText, bodyText, footerText, buttons, carouselCards, authConfig };
}

Deno.serve(withEdgeHandler(async (req) => {
  if (req.method !== "POST") {
    return jsonError(405, "INVALID_INPUT", "Method not allowed");
  }

  const ctx = await requireAuth(req);
  if (ctx instanceof Response) return ctx;
  if (!ctx.isAdmin && !ctx.isSuperadmin) {
    return jsonError(403, "FORBIDDEN", "Requires admin or superadmin role.");
  }
  const admin = ctx.serviceClient;

  // Superadmins may target any institution via ?institution= query param.
  const url = new URL(req.url);
  const requestedInstitution = url.searchParams.get("institution");
  const targetInstitution: string =
    (requestedInstitution && ctx.isSuperadmin ? requestedInstitution : "") ||
    (Deno.env.get("WHATSAPP_DEFAULT_INSTITUTION") ?? "").trim() ||
    ctx.institution ||
    "";

  const channel = await resolveChannel(admin, targetInstitution || null);
  if (channel instanceof Response) return channel;
  if (!channel.wabaId) {
    return jsonError(400, "CHANNEL_MISCONFIGURED", "WABA id is not configured for this channel.");
  }

  // ---- Paginated fetch of ALL templates on the WABA. -------------------
  const items: any[] = [];
  let next: string | null = graphUrl(
    `${channel.wabaId}/message_templates?fields=name,language,status,category,id,rejected_reason,quality_score,components,parameter_format&limit=100`,
  );
  let pageGuard = 0;
  while (next && pageGuard++ < 50) {
    let res: Response;
    try {
      res = await fetch(next, { headers: { Authorization: `Bearer ${channel.token}` } });
    } catch (e) {
      return jsonError(502, "META_API_ERROR", e instanceof Error ? e.message : String(e), {
        error_code: "NETWORK_ERROR",
      });
    }
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = body?.error ?? {};
      return jsonError(200, "META_API_ERROR", err.message ?? "Meta sync failed", {
        error_code: "META_SYNC_FAILED",
        meta_error: {
          code: err.code ?? null,
          error_subcode: err.error_subcode ?? null,
          message: err.message ?? null,
          fbtrace_id: err.fbtrace_id ?? null,
          http_status: res.status,
        },
      });
    }
    if (Array.isArray(body?.data)) items.push(...body.data);
    next = body?.paging?.next ?? null;
  }

  const nowIso = new Date().toISOString();
  let updated = 0;
  let created = 0;

  for (const t of items) {
    const status = STATUS_MAP[String(t?.status ?? "").toUpperCase()] ?? "submitted";
    const parsed = parseComponents(t?.components);
    const metaTemplateId = t?.id != null ? String(t.id) : null;
    const name: string = t?.name ?? "";
    const language: string = t?.language ?? "pt_BR";

    // Match by meta_template_id first (stable), then by (institution, name, language).
    let existing: any = null;
    if (metaTemplateId) {
      const { data } = await admin
        .from("message_templates")
        .select("id, meta_footer_text, meta_definition, meta_body_parameter_order, body_patient, body_contact, body_segment, institution")
        .eq("meta_template_id", metaTemplateId)
        .maybeSingle();
      existing = data;
    }
    if (!existing && name && targetInstitution) {
      const { data } = await admin
        .from("message_templates")
        .select("id, meta_footer_text, meta_definition, meta_body_parameter_order, body_patient, body_contact, body_segment, institution")
        .eq("template_kind", "meta")
        .eq("institution", targetInstitution)
        .eq("meta_template_name", name)
        .eq("meta_language", language)
        .maybeSingle();
      existing = data;
    }

    // Compute divergence (structured): local footer/body vs Meta.
    const localBody = existing
      ? (existing.body_patient ?? existing.body_contact ?? existing.body_segment ?? null)
      : null;
    const footerDifferent = existing
      ? (existing.meta_footer_text ?? null) !== (parsed.footerText ?? null)
      : false;
    const bodyDifferent =
      existing && parsed.bodyText != null && localBody != null && parsed.bodyText !== localBody;

    const commonPatch: Record<string, unknown> = {
      meta_template_id: metaTemplateId,
      meta_template_name: name,
      meta_language: language,
      meta_category: t?.category ?? null,
      meta_status: status,
      meta_rejection_reason: t?.rejected_reason ?? null,
      meta_rejection_info: t?.rejected_reason ? { reason: t.rejected_reason } : null,
      meta_last_synced_at: nowIso,
      meta_definition: t ?? null,
      meta_header_type: parsed.headerType,
      meta_header_text: parsed.headerText,
      meta_footer_text: parsed.footerText,
      meta_footer_source: parsed.footerText ? "meta_synced" : null,
      meta_buttons: parsed.buttons,
      meta_carousel_cards: parsed.carouselCards,
      meta_authentication_config: parsed.authConfig,
      meta_parameter_format: t?.parameter_format
        ? String(t.parameter_format).toUpperCase()
        : null,
      meta_has_local_differences: !!(footerDifferent || bodyDifferent),
    };

    if (existing) {
      await admin.from("message_templates").update(commonPatch).eq("id", existing.id);
      updated++;
    } else if (targetInstitution) {
      // Create a local skeleton so admins can see + adopt this Meta template.
      await admin.from("message_templates").insert({
        institution: targetInstitution,
        template_kind: "meta",
        name: name,
        objective: "custom",
        ...commonPatch,
      } as any);
      created++;
    }
  }

  return jsonOk({ count: items.length, updated, created, institution: targetInstitution });
}));