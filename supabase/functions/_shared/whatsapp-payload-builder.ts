// Pure builders for WhatsApp Cloud API payloads.
// No I/O. No fetch. No env. Safe to unit test in isolation.

import type {
  BuildTemplateArgs,
  BuiltPayload,
  ButtonParamInput,
  CarouselCardInput,
  HeaderParamInput,
  MetaButtonDefinition,
  MetaComponent,
  MetaTemplateDefinition,
  ValidationResult,
} from "./whatsapp-types.ts";
import { WhatsAppErrorCode } from "./whatsapp-errors.ts";

// ---------- Text and simple media ----------------------------------------

export function buildTextPayload(to: string, body: string): BuiltPayload {
  return {
    kind: "text",
    payload: {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body, preview_url: false },
    },
  };
}

export function buildMediaPayload(
  to: string,
  kind: "image" | "video" | "document",
  media: { meta_media_id?: string; link?: string; filename?: string; caption?: string },
): BuiltPayload {
  const mediaObj: Record<string, unknown> = {};
  if (media.meta_media_id) mediaObj.id = media.meta_media_id;
  else if (media.link) mediaObj.link = media.link;
  if (media.caption) mediaObj.caption = media.caption;
  if (kind === "document" && media.filename) mediaObj.filename = media.filename;
  return {
    kind,
    payload: {
      messaging_product: "whatsapp",
      to,
      type: kind,
      [kind]: mediaObj,
    },
  };
}

// ---------- Interactive (button/list) ------------------------------------

export interface InteractiveButtonArgs {
  to: string;
  bodyText: string;
  buttons: Array<{ id: string; title: string }>;
  footerText?: string;
  header?: { type: "text"; text: string };
}

export function buildInteractiveButtonPayload(args: InteractiveButtonArgs): BuiltPayload {
  const interactive: Record<string, unknown> = {
    type: "button",
    body: { text: args.bodyText },
    action: {
      buttons: args.buttons.slice(0, 3).map((b) => ({
        type: "reply",
        reply: { id: b.id, title: b.title.slice(0, 20) },
      })),
    },
  };
  if (args.header) interactive.header = args.header;
  if (args.footerText) interactive.footer = { text: args.footerText };
  return {
    kind: "interactive",
    payload: {
      messaging_product: "whatsapp",
      to: args.to,
      type: "interactive",
      interactive,
    },
  };
}

export interface InteractiveListArgs {
  to: string;
  bodyText: string;
  buttonText: string;
  sections: Array<{
    title: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  }>;
  footerText?: string;
  headerText?: string;
}

export function buildInteractiveListPayload(args: InteractiveListArgs): BuiltPayload {
  const interactive: Record<string, unknown> = {
    type: "list",
    body: { text: args.bodyText },
    action: { button: args.buttonText.slice(0, 20), sections: args.sections },
  };
  if (args.headerText) interactive.header = { type: "text", text: args.headerText };
  if (args.footerText) interactive.footer = { text: args.footerText };
  return {
    kind: "interactive",
    payload: {
      messaging_product: "whatsapp",
      to: args.to,
      type: "interactive",
      interactive,
    },
  };
}

// ---------- Template payloads --------------------------------------------

export function buildTemplatePayload(args: BuildTemplateArgs): BuiltPayload {
  const { to, definition, headerParams, bodyParams, buttonParams, carouselCards } = args;
  const components: Array<Record<string, unknown>> = [];

  const headerDef = definition.components.find((c) => c.type === "HEADER") as
    | Extract<MetaComponent, { type: "HEADER" }>
    | undefined;
  if (headerDef && headerParams && headerParams.type !== "none") {
    const headerComp = buildHeaderComponent(headerDef, headerParams);
    if (headerComp) components.push(headerComp);
  }

  const bodyDef = definition.components.find((c) => c.type === "BODY") as
    | Extract<MetaComponent, { type: "BODY" }>
    | undefined;
  if (bodyDef && bodyParams && bodyParams.length > 0) {
    components.push({
      type: "body",
      parameters: bodyParams.map((t) => ({ type: "text", text: String(t) })),
    });
  }

  const buttonsDef = definition.components.find((c) => c.type === "BUTTONS") as
    | Extract<MetaComponent, { type: "BUTTONS" }>
    | undefined;
  if (buttonsDef && buttonParams && buttonParams.length > 0) {
    for (const b of buttonParams) {
      const built = buildButtonComponent(buttonsDef.buttons, b);
      if (built) components.push(built);
    }
  }

  const carouselDef = definition.components.find((c) => c.type === "CAROUSEL") as
    | Extract<MetaComponent, { type: "CAROUSEL" }>
    | undefined;
  if (carouselDef && carouselCards && carouselCards.length > 0) {
    components.push(buildCarouselComponent(carouselDef, carouselCards));
  }

  const template: Record<string, unknown> = {
    name: definition.name,
    language: { code: definition.language },
  };
  if (components.length > 0) template.components = components;

  return {
    kind: "template",
    payload: {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template,
    },
  };
}

function buildHeaderComponent(
  def: Extract<MetaComponent, { type: "HEADER" }>,
  params: HeaderParamInput,
): Record<string, unknown> | null {
  const fmt = def.format;
  if (fmt === "TEXT") {
    if (!params.text) return null;
    return {
      type: "header",
      parameters: [{ type: "text", text: params.text }],
    };
  }
  if (!params.media) return null;
  const mediaObj: Record<string, unknown> = {};
  if (params.media.meta_media_id) mediaObj.id = params.media.meta_media_id;
  else if (params.media.link) mediaObj.link = params.media.link;
  if (fmt === "DOCUMENT" && params.media.filename) mediaObj.filename = params.media.filename;

  const paramType = fmt.toLowerCase() as "image" | "video" | "document";
  return {
    type: "header",
    parameters: [{ type: paramType, [paramType]: mediaObj }],
  };
}

function buildButtonComponent(
  defs: MetaButtonDefinition[],
  input: ButtonParamInput,
): Record<string, unknown> | null {
  const def = defs[input.index];
  if (!def) return null;
  if (def.type === "QUICK_REPLY" && input.sub_type === "quick_reply") {
    return {
      type: "button",
      sub_type: "quick_reply",
      index: String(input.index),
      parameters: [{ type: "payload", payload: input.payload ?? "" }],
    };
  }
  if (def.type === "URL" && input.sub_type === "url" && input.url_param) {
    return {
      type: "button",
      sub_type: "url",
      index: String(input.index),
      parameters: [{ type: "text", text: input.url_param }],
    };
  }
  if (def.type === "COPY_CODE" && input.sub_type === "copy_code" && input.copy_code) {
    return {
      type: "button",
      sub_type: "copy_code",
      index: String(input.index),
      parameters: [{ type: "coupon_code", coupon_code: input.copy_code }],
    };
  }
  return null;
}

function buildCarouselComponent(
  def: Extract<MetaComponent, { type: "CAROUSEL" }>,
  cards: CarouselCardInput[],
): Record<string, unknown> {
  const max = def.cards.length;
  const ordered = [...cards].sort((a, b) => a.index - b.index).slice(0, max);
  return {
    type: "carousel",
    cards: ordered.map((card) => {
      const components: Array<Record<string, unknown>> = [];
      if (card.media) {
        const mediaObj: Record<string, unknown> = {};
        if (card.media.meta_media_id) mediaObj.id = card.media.meta_media_id;
        else if (card.media.link) mediaObj.link = card.media.link;
        components.push({
          type: "header",
          parameters: [{ type: "image", image: mediaObj }],
        });
      }
      if (card.body_params && card.body_params.length > 0) {
        components.push({
          type: "body",
          parameters: card.body_params.map((t) => ({ type: "text", text: String(t) })),
        });
      }
      if (card.button_params) {
        const cardDef = def.cards[card.index];
        const buttonsDef = cardDef?.components.find((c) => c.type === "BUTTONS") as
          | Extract<MetaComponent, { type: "BUTTONS" }>
          | undefined;
        if (buttonsDef) {
          for (const b of card.button_params) {
            const built = buildButtonComponent(buttonsDef.buttons, b);
            if (built) components.push(built);
          }
        }
      }
      return { card_index: card.index, components };
    }),
  };
}

// ---------- Validation ---------------------------------------------------

export function validateTemplateDefinition(def: unknown): ValidationResult {
  const errors = [] as ValidationResult["errors"];
  if (!def || typeof def !== "object") {
    errors.push({ code: WhatsAppErrorCode.TEMPLATE_DEFINITION_MISMATCH, message: "Definition vazia" });
    return { ok: false, errors };
  }
  const d = def as Partial<MetaTemplateDefinition>;
  if (!d.name) errors.push({ code: WhatsAppErrorCode.TEMPLATE_NAME_MISSING, message: "name ausente" });
  if (!d.language) errors.push({ code: WhatsAppErrorCode.TEMPLATE_DEFINITION_MISMATCH, message: "language ausente" });
  if (!Array.isArray(d.components)) {
    errors.push({ code: WhatsAppErrorCode.TEMPLATE_DEFINITION_MISMATCH, message: "components ausente" });
  }
  return { ok: errors.length === 0, errors };
}

export interface RuntimeValidationArgs {
  definition: MetaTemplateDefinition;
  headerParams?: HeaderParamInput;
  bodyParams?: string[];
  buttonParams?: ButtonParamInput[];
  carouselCards?: CarouselCardInput[];
  urlAllowlist?: string[]; // domains
}

export function validateRuntimeParameters(args: RuntimeValidationArgs): ValidationResult {
  const errors: ValidationResult["errors"] = [];
  const { definition } = args;

  const headerDef = definition.components.find((c) => c.type === "HEADER") as
    | Extract<MetaComponent, { type: "HEADER" }>
    | undefined;
  if (headerDef) {
    if (headerDef.format === "TEXT" && !args.headerParams?.text) {
      errors.push({
        code: WhatsAppErrorCode.TEMPLATE_PARAMETER_MISSING,
        message: "Texto do cabeçalho ausente",
        field: "header.text",
      });
    }
    if (
      headerDef.format !== "TEXT" &&
      !(args.headerParams?.media?.meta_media_id || args.headerParams?.media?.link)
    ) {
      errors.push({
        code: WhatsAppErrorCode.MEDIA_NOT_UPLOADED,
        message: "Mídia do cabeçalho não enviada",
        field: "header.media",
      });
    }
  }

  const buttonsDef = definition.components.find((c) => c.type === "BUTTONS") as
    | Extract<MetaComponent, { type: "BUTTONS" }>
    | undefined;
  if (buttonsDef && args.buttonParams) {
    for (const bp of args.buttonParams) {
      if (bp.index < 0 || bp.index >= buttonsDef.buttons.length) {
        errors.push({
          code: WhatsAppErrorCode.BUTTON_INDEX_OUT_OF_RANGE,
          message: `Botão ${bp.index} fora do template`,
          field: `buttons[${bp.index}]`,
        });
        continue;
      }
      const def = buttonsDef.buttons[bp.index];
      if (def.type === "URL" && bp.url_param && args.urlAllowlist?.length) {
        try {
          const u = new URL(def.url.replace("{{1}}", bp.url_param));
          if (u.protocol !== "https:" && u.protocol !== "http:") {
            errors.push({
              code: WhatsAppErrorCode.URL_DOMAIN_NOT_ALLOWED,
              message: `Esquema de URL não permitido: ${u.protocol}`,
            });
          } else if (!args.urlAllowlist.some((d) => u.hostname === d || u.hostname.endsWith("." + d))) {
            errors.push({
              code: WhatsAppErrorCode.URL_DOMAIN_NOT_ALLOWED,
              message: `Domínio não permitido: ${u.hostname}`,
            });
          }
        } catch {
          errors.push({
            code: WhatsAppErrorCode.URL_DOMAIN_NOT_ALLOWED,
            message: "URL inválida no botão",
          });
        }
      }
    }
  }

  const carouselDef = definition.components.find((c) => c.type === "CAROUSEL") as
    | Extract<MetaComponent, { type: "CAROUSEL" }>
    | undefined;
  if (carouselDef && args.carouselCards) {
    if (args.carouselCards.length > carouselDef.cards.length) {
      errors.push({
        code: WhatsAppErrorCode.CAROUSEL_CARD_COUNT_MISMATCH,
        message: `Carrossel aceita no máximo ${carouselDef.cards.length} cards`,
      });
    }
  }

  return { ok: errors.length === 0, errors };
}