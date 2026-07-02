// Pure handler for the manual sync endpoint. All I/O is injected so we can
// exercise the pagination / scope / match logic without touching Meta or the
// database.

export interface CallerContext {
  userId: string;
  role: "admin" | "superadmin" | "other";
  institution: string | null;
}

export interface LocalTemplateRow {
  id: string;
  institution: string;
  meta_template_id: string | null;
  meta_template_name: string | null;
  meta_language: string | null;
  meta_waba_id: string | null;
  meta_status: string | null;
  meta_footer_text: string | null;
  body_patient: string | null;
  body_contact: string | null;
  body_segment: string | null;
}

export interface SyncDeps {
  fetchPage(url: string): Promise<{
    ok: boolean;
    status: number;
    data: any[];
    nextUrl: string | null;
    errorMessage?: string;
  }>;
  resolveWabaForInstitution(institution: string): Promise<string | null>;
  loadTemplateById(id: string): Promise<LocalTemplateRow | null>;
  findLocalRow(
    institution: string,
    metaItem: any,
  ): Promise<LocalTemplateRow | null>;
  updateTemplate(id: string, patch: Record<string, unknown>): Promise<void>;
  now(): Date;
  graphVersion: string;
  fallbackWaba: string | null;
}

export type SyncBody = {
  local_template_id?: string;
  institution?: string;
};

export type SyncResult =
  | { ok: true; matched: number; updated: number; pages: number; missing_meta_ids: string[] }
  | { ok: false; status: number; error: string };

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

function parseComponents(components: unknown) {
  const list = Array.isArray(components) ? (components as any[]) : [];
  let headerType: string | null = null;
  let headerText: string | null = null;
  let bodyText: string | null = null;
  let footerText: string | null = null;
  let buttons: any[] | null = null;
  let carouselCards: any[] | null = null;
  let authConfig: any = null;
  for (const comp of list) {
    const type = String(comp?.type ?? "").toUpperCase();
    if (type === "HEADER") {
      headerType = String(comp?.format ?? "TEXT").toLowerCase();
      headerText = comp?.text ?? null;
    } else if (type === "BODY") bodyText = comp?.text ?? null;
    else if (type === "FOOTER") footerText = comp?.text ?? null;
    else if (type === "BUTTONS") buttons = Array.isArray(comp?.buttons) ? comp.buttons : null;
    else if (type === "CAROUSEL") carouselCards = Array.isArray(comp?.cards) ? comp.cards : null;
    else if (type === "LIMITED_TIME_OFFER" || type === "ONE_TIME_PASSWORD" || type === "OTP") authConfig = comp;
  }
  return { headerType, headerText, bodyText, footerText, buttons, carouselCards, authConfig };
}

export function buildInitialUrl(graphVersion: string, waba: string): string {
  return (
    `https://graph.facebook.com/${graphVersion}/${waba}/message_templates` +
    `?fields=id,name,language,status,category,components,rejected_reason,quality_score,parameter_format&limit=100`
  );
}

export async function fetchAllPages(
  deps: Pick<SyncDeps, "fetchPage">,
  initialUrl: string,
  maxPages = 20,
): Promise<{ ok: true; items: any[]; pages: number } | { ok: false; status: number; error: string }> {
  let url: string | null = initialUrl;
  const items: any[] = [];
  let pages = 0;
  while (url && pages < maxPages) {
    const page = await deps.fetchPage(url);
    pages++;
    if (!page.ok) {
      return { ok: false, status: page.status || 502, error: page.errorMessage ?? "Meta sync failed" };
    }
    items.push(...page.data);
    url = page.nextUrl;
  }
  return { ok: true, items, pages };
}

export async function runSync(
  deps: SyncDeps,
  caller: CallerContext,
  body: SyncBody,
): Promise<SyncResult> {
  // Scope resolution
  let scopedInstitution: string | null;
  let scopedTemplate: LocalTemplateRow | null = null;

  if (body.local_template_id) {
    scopedTemplate = await deps.loadTemplateById(body.local_template_id);
    if (!scopedTemplate) return { ok: false, status: 404, error: "TEMPLATE_NOT_FOUND" };
    if (
      caller.role !== "superadmin" &&
      scopedTemplate.institution !== caller.institution
    ) {
      return { ok: false, status: 403, error: "FORBIDDEN" };
    }
    scopedInstitution = scopedTemplate.institution;
  } else if (body.institution) {
    if (caller.role !== "superadmin" && body.institution !== caller.institution) {
      return { ok: false, status: 403, error: "FORBIDDEN" };
    }
    scopedInstitution = body.institution;
  } else {
    if (caller.role !== "admin" && caller.role !== "superadmin") {
      return { ok: false, status: 403, error: "FORBIDDEN" };
    }
    if (!caller.institution) return { ok: false, status: 400, error: "INSTITUTION_UNRESOLVED" };
    scopedInstitution = caller.institution;
  }

  const waba =
    (await deps.resolveWabaForInstitution(scopedInstitution)) ?? deps.fallbackWaba;
  if (!waba) return { ok: false, status: 400, error: "WABA_NOT_CONFIGURED" };

  const initialUrl = buildInitialUrl(deps.graphVersion, waba);
  const pagedResult = await fetchAllPages(deps, initialUrl);
  if (!pagedResult.ok) return pagedResult;

  let items = pagedResult.items;
  if (scopedTemplate) {
    items = items.filter((it: any) => {
      if (scopedTemplate!.meta_template_id) return String(it?.id) === scopedTemplate!.meta_template_id;
      return (
        it?.name === scopedTemplate!.meta_template_name &&
        it?.language === scopedTemplate!.meta_language
      );
    });
  }

  const nowIso = deps.now().toISOString();
  let updated = 0;
  let matched = 0;
  const missing: string[] = [];

  for (const t of items) {
    const existing = await deps.findLocalRow(scopedInstitution, t);
    if (!existing) {
      if (t?.id) missing.push(String(t.id));
      continue;
    }
    matched++;
    // Never overwrite across language collisions.
    if (
      existing.meta_language &&
      t?.language &&
      existing.meta_language !== t.language
    ) continue;

    const rawStatus = String(t?.status ?? "").toUpperCase();
    const status = STATUS_MAP[rawStatus] ?? existing.meta_status ?? "submitted";
    const parsed = parseComponents(t?.components);
    const localBody = existing.body_patient ?? existing.body_contact ?? existing.body_segment ?? null;
    const footerDifferent = (existing.meta_footer_text ?? null) !== (parsed.footerText ?? null);
    const bodyDifferent =
      parsed.bodyText != null && localBody != null && parsed.bodyText !== localBody;

    const patch: Record<string, unknown> = {
      meta_template_id: t?.id ?? existing.meta_template_id ?? null,
      meta_waba_id: existing.meta_waba_id ?? waba,
      meta_language: t?.language ?? existing.meta_language ?? "pt_BR",
      meta_category: t?.category ?? null,
      meta_status: status,
      meta_status_raw: rawStatus || null,
      meta_rejection_reason: t?.rejected_reason ?? null,
      meta_last_synced_at: nowIso,
      meta_definition: t ?? null,
      meta_header_type: parsed.headerType,
      meta_header_text: parsed.headerText,
      meta_footer_text: parsed.footerText,
      meta_footer_source: parsed.footerText ? "meta_synced" : null,
      meta_buttons: parsed.buttons,
      meta_carousel_cards: parsed.carouselCards,
      meta_authentication_config: parsed.authConfig,
      meta_has_local_differences: footerDifferent || bodyDifferent,
    };
    await deps.updateTemplate(existing.id, patch);
    updated++;
  }

  return { ok: true, matched, updated, pages: pagedResult.pages, missing_meta_ids: missing };
}