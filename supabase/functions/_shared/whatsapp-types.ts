// Shared types for the WhatsApp Cloud API integration.
// Source of truth for builders, validators and edge functions.

export type WhatsAppHeaderType =
  | "none"
  | "text"
  | "image"
  | "video"
  | "document";

export type WhatsAppButtonType =
  | "quick_reply"
  | "url"
  | "phone_number"
  | "copy_code";

export type WhatsAppMessageKind =
  | "text"
  | "template"
  | "interactive"
  | "image"
  | "video"
  | "document";

export type MetaButtonDefinition =
  | { type: "QUICK_REPLY"; text: string; stable_id?: string }
  | { type: "URL"; text: string; url: string; example?: string[] }
  | { type: "PHONE_NUMBER"; text: string; phone_number: string }
  | { type: "COPY_CODE"; text?: string; example?: string };

export type MetaComponent =
  | { type: "HEADER"; format: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT"; text?: string; example?: unknown }
  | { type: "BODY"; text: string; example?: unknown }
  | { type: "FOOTER"; text: string }
  | { type: "BUTTONS"; buttons: MetaButtonDefinition[] }
  | { type: "CAROUSEL"; cards: Array<{ components: MetaComponent[] }> };

export interface MetaTemplateDefinition {
  name: string;
  language: string;
  category: "UTILITY" | "MARKETING" | "AUTHENTICATION";
  status?: string;
  components: MetaComponent[];
}

export interface HeaderMediaAsset {
  media_asset_id?: string;
  meta_media_id?: string;
  link?: string;
  filename?: string;
}

export interface HeaderParamInput {
  type: WhatsAppHeaderType;
  text?: string;
  media?: HeaderMediaAsset;
}

export interface ButtonParamInput {
  index: number;
  sub_type: "quick_reply" | "url" | "copy_code";
  payload?: string; // for quick_reply
  url_param?: string; // for url
  copy_code?: string; // for copy_code
}

export interface CarouselCardInput {
  index: number;
  media?: HeaderMediaAsset;
  body_params?: string[];
  button_params?: ButtonParamInput[];
}

export interface BuildTemplateArgs {
  to: string;
  definition: MetaTemplateDefinition;
  headerParams?: HeaderParamInput;
  bodyParams?: string[]; // ordered list, already resolved
  buttonParams?: ButtonParamInput[];
  carouselCards?: CarouselCardInput[];
}

export interface BuiltPayload {
  payload: Record<string, unknown>;
  kind: WhatsAppMessageKind;
}

export interface ValidationError {
  code: string;
  message: string;
  field?: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationError[];
}