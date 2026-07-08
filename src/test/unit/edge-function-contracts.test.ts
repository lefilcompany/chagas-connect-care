import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("edge function contracts", () => {
  it("send-whatsapp autentica e autoriza o chamador antes de usar o client admin", () => {
    const source = read("supabase/functions/send-whatsapp/index.ts");
    const claimsIndex = source.indexOf("auth.getClaims");
    const rlsLookupIndex = source.indexOf('authClient\n    .from("messages")');
    const adminFullReadIndex = source.indexOf('admin\n    .from("messages")');

    expect(claimsIndex).toBeGreaterThanOrEqual(0);
    expect(rlsLookupIndex).toBeGreaterThan(claimsIndex);
    expect(adminFullReadIndex).toBeGreaterThan(rlsLookupIndex);
    expect(source).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(source).toContain("WHATSAPP_GRAPH_VERSION");
  });

  it("webhook exige token de verificação e assinatura HMAC", () => {
    const source = read("supabase/functions/whatsapp-webhook/index.ts");
    const config = read("supabase/config.toml");

    expect(config).toContain("[functions.whatsapp-webhook]");
    expect(config).toContain("verify_jwt = false");
    expect(source).toContain("WHATSAPP_VERIFY_TOKEN");
    expect(source).toContain("WHATSAPP_APP_SECRET");
    expect(source).toContain("verifyMetaSignature");
    expect(source).toContain("timingSafeEqual");
  });

  it("webhook resolve identidade e canal dentro do escopo institucional", () => {
    const source = read("supabase/functions/whatsapp-webhook/index.ts");

    expect(source).toMatch(/admin\s*\.from\("whatsapp_identities"\)/);
    expect(source).toMatch(/admin\s*\.from\("whatsapp_channels"\)/);
    expect(source).toContain('.eq("institution", institution)');
  });

  it("runner e processamento em lote permanecem funções versionadas", () => {
    expect(() => read("supabase/functions/journey-runner/index.ts")).not.toThrow();
    expect(() => read("supabase/functions/process-message-batch/index.ts")).not.toThrow();
  });
});
