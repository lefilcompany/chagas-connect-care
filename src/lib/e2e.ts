import type { Session, User } from "@supabase/supabase-js";

export type E2ERole = "superadmin" | "admin" | "equipe";

export type E2EMockContext = {
  enabled: boolean;
  authenticated: boolean;
  role: E2ERole;
  institution: string;
  user: User | null;
  session: Session | null;
};

const E2E_ENABLED = import.meta.env.VITE_E2E_MOCK === "true";
const DEFAULT_ROLE: E2ERole = "admin";
const DEFAULT_INSTITUTION = "instituicao-e2e";
const DEFAULT_EMAIL = "e2e.admin@example.test";
const DEFAULT_USER_ID = "00000000-0000-4000-8000-000000000001";

function getSearchParams(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

function getSessionStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function persistParam(key: string, value: string | null): string | null {
  const storage = getSessionStorage();
  if (value != null) {
    storage?.setItem(key, value);
    return value;
  }
  return storage?.getItem(key) ?? null;
}

function readRole(params: URLSearchParams): E2ERole {
  const raw = persistParam("e2e-role", params.get("__e2e_role"));
  return raw === "superadmin" || raw === "equipe" || raw === "admin" ? raw : DEFAULT_ROLE;
}

function readAuthentication(params: URLSearchParams): boolean {
  const raw = persistParam("e2e-auth", params.get("__e2e_auth"));
  return raw !== "anonymous";
}

function readInstitution(params: URLSearchParams): string {
  return persistParam("e2e-institution", params.get("__e2e_institution")) || DEFAULT_INSTITUTION;
}

function createMockUser(role: E2ERole): User {
  const createdAt = "2026-01-01T00:00:00.000Z";
  return {
    id: DEFAULT_USER_ID,
    aud: "authenticated",
    role: "authenticated",
    email: DEFAULT_EMAIL,
    email_confirmed_at: createdAt,
    phone: "",
    confirmed_at: createdAt,
    last_sign_in_at: createdAt,
    app_metadata: { provider: "email", providers: ["email"], e2e_role: role },
    user_metadata: { full_name: "Usuário E2E" },
    identities: [],
    created_at: createdAt,
    updated_at: createdAt,
    is_anonymous: false,
  } as User;
}

function createMockSession(user: User): Session {
  return {
    access_token: "e2e-access-token",
    refresh_token: "e2e-refresh-token",
    expires_in: 3600,
    expires_at: 4102444800,
    token_type: "bearer",
    user,
  } as Session;
}

export function getE2EMockContext(): E2EMockContext {
  if (!E2E_ENABLED) {
    return {
      enabled: false,
      authenticated: false,
      role: DEFAULT_ROLE,
      institution: DEFAULT_INSTITUTION,
      user: null,
      session: null,
    };
  }

  const params = getSearchParams();
  const role = readRole(params);
  const authenticated = readAuthentication(params);
  const institution = readInstitution(params);
  const user = authenticated ? createMockUser(role) : null;

  return {
    enabled: true,
    authenticated,
    role,
    institution,
    user,
    session: user ? createMockSession(user) : null,
  };
}

export function clearE2EMockSession(): void {
  const storage = getSessionStorage();
  storage?.setItem("e2e-auth", "anonymous");
}
