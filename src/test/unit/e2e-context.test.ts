import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("e2e mock context", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_E2E_MOCK", "true");
    window.history.replaceState({}, "", "/");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("cria sessão autenticada de admin por padrão", async () => {
    const { getE2EMockContext } = await import("@/lib/e2e");
    const context = getE2EMockContext();

    expect(context).toMatchObject({
      enabled: true,
      authenticated: true,
      role: "admin",
      institution: "instituicao-e2e",
    });
    expect(context.user?.email).toBe("e2e.admin@example.test");
    expect(context.session?.user.id).toBe(context.user?.id);
  });

  it("lê papel, instituição e anonimato da URL e persiste na sessão", async () => {
    window.history.replaceState(
      {},
      "",
      "/superadmin/dashboard?__e2e_role=superadmin&__e2e_institution=hospital-teste&__e2e_auth=anonymous",
    );

    const { getE2EMockContext } = await import("@/lib/e2e");
    const anonymous = getE2EMockContext();

    expect(anonymous).toMatchObject({
      enabled: true,
      authenticated: false,
      role: "superadmin",
      institution: "hospital-teste",
      user: null,
      session: null,
    });

    window.history.replaceState({}, "", "/outra-rota");
    expect(getE2EMockContext()).toMatchObject({
      authenticated: false,
      role: "superadmin",
      institution: "hospital-teste",
    });
  });

  it("limpa a autenticação sintética no logout", async () => {
    const { clearE2EMockSession, getE2EMockContext } = await import("@/lib/e2e");
    expect(getE2EMockContext().authenticated).toBe(true);

    clearE2EMockSession();

    expect(getE2EMockContext().authenticated).toBe(false);
  });
});
