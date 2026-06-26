import { describe, it, expect } from "vitest";
import {
  appendSignatureToFreeText,
  computeFooterCompatibility,
  resolveInteractiveFooter,
  resolveSignatureText,
  type InstitutionWhatsAppSettings,
} from "./branding";

const base: InstitutionWhatsAppSettings = {
  institution: "Hospital Central",
  brand_name: null,
  signature_mode: "powered_by",
  custom_signature_text: null,
  application_display_name: "Chagas Digital Care",
  append_signature_to_text: true,
  use_native_interactive_footer: true,
  use_as_template_footer_default: true,
  default_template_footer_text: "Mensagem oficial",
  signature_enabled: true,
};

describe("resolveSignatureText", () => {
  it("returns null when disabled", () => {
    expect(resolveSignatureText({ ...base, signature_enabled: false })).toBeNull();
  });
  it("returns institution name when configured", () => {
    expect(
      resolveSignatureText({ ...base, signature_mode: "institution_name", brand_name: "HC" }),
    ).toBe("HC");
  });
  it("returns powered by line", () => {
    expect(resolveSignatureText(base)).toBe("Powered by Chagas Digital Care");
  });
  it("returns null for empty custom signature", () => {
    expect(
      resolveSignatureText({ ...base, signature_mode: "custom", custom_signature_text: "  " }),
    ).toBeNull();
  });
});

describe("appendSignatureToFreeText", () => {
  it("appends signature when missing", () => {
    expect(appendSignatureToFreeText("Olá", "Powered by Chagas Digital Care")).toBe(
      "Olá\n\n_Powered by Chagas Digital Care_",
    );
  });
  it("is idempotent for italic signature", () => {
    const once = appendSignatureToFreeText("Olá", "HC");
    expect(appendSignatureToFreeText(once, "HC")).toBe(once);
  });
  it("returns body unchanged when signature null", () => {
    expect(appendSignatureToFreeText("Olá", null)).toBe("Olá");
  });
});

describe("resolveInteractiveFooter", () => {
  it("returns null when native interactive footer is disabled", () => {
    expect(
      resolveInteractiveFooter({ ...base, use_native_interactive_footer: false }),
    ).toBeNull();
  });
  it("truncates explicit footer to 60 chars", () => {
    const long = "x".repeat(80);
    expect(resolveInteractiveFooter(base, long)!.length).toBe(60);
  });
});

describe("computeFooterCompatibility", () => {
  it("matches when equal", () => {
    expect(computeFooterCompatibility("Mensagem oficial", base)).toBe(
      "matches_institution_default",
    );
  });
  it("differs when not equal", () => {
    expect(computeFooterCompatibility("Outro", base)).toBe(
      "differs_from_institution_default",
    );
  });
  it("reports no_local_footer when template has no footer", () => {
    expect(computeFooterCompatibility(null, base)).toBe("no_local_footer");
  });
});