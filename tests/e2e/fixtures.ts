import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { expect, test as base, type Page } from "@playwright/test";
import type { Database } from "../../src/integrations/supabase/types";

const pageErrors = new WeakMap<Page, string[]>();

export const accounts = {
  adminA: {
    email: "admin.a@e2e.local",
    password: "E2eAdminA!2026",
  },
  adminB: {
    email: "admin.b@e2e.local",
    password: "E2eAdminB!2026",
  },
  superadmin: {
    email: "superadmin@e2e.local",
    password: "E2eSuperadmin!2026",
  },
} as const;

export const institutions = {
  a: "hospital-e2e-a",
  b: "hospital-e2e-b",
  platform: "plataforma-e2e",
} as const;

export const patients = {
  a: { id: "11111111-1111-4111-8111-111111111111", name: "Paciente A E2E" },
  b: { id: "22222222-2222-4222-8222-222222222222", name: "Paciente B E2E" },
} as const;

export const onboardingInviteToken = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

export const authStateDir = resolve(process.cwd(), ".playwright-auth");
export const authStates = {
  adminA: resolve(authStateDir, "admin-a.json"),
  superadmin: resolve(authStateDir, "superadmin.json"),
} as const;

export function ensureAuthStateDir() {
  mkdirSync(authStateDir, { recursive: true });
}

function requiredEnv(...names: string[]) {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  throw new Error(`Variável E2E ausente: ${names.join(" ou ")}`);
}

export function backendConfig() {
  return {
    url: requiredEnv("E2E_SUPABASE_URL", "SUPABASE_URL", "VITE_SUPABASE_URL"),
    anonKey: requiredEnv("E2E_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY", "VITE_SUPABASE_PUBLISHABLE_KEY"),
    serviceRoleKey: process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? null,
  };
}

export function createPublicClient() {
  const { url, anonKey } = backendConfig();
  return createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createServiceClient() {
  const { url, serviceRoleKey } = backendConfig();
  if (!serviceRoleKey) throw new Error("Service role local ausente para verificação funcional.");
  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function createSignedInClient(account: { email: string; password: string }) {
  const client = createPublicClient();
  const { error } = await client.auth.signInWithPassword(account);
  if (error) throw new Error(`Falha no login funcional de ${account.email}: ${error.message}`);
  return client;
}

export async function loginThroughUi(page: Page, account: { email: string; password: string }) {
  await page.goto("/auth");
  await page.locator("#li-email").fill(account.email);
  await page.locator("#li-pass").fill(account.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/app\/hoje$/);
  await expect(page.locator("main")).toBeVisible();
}

export const test = base;
export { expect };

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.stack ?? error.message));
});

test.afterEach(async ({ page }, testInfo) => {
  const errors = pageErrors.get(page) ?? [];
  if (errors.length) {
    await testInfo.attach("page-errors", {
      body: Buffer.from(errors.join("\n\n")),
      contentType: "text/plain",
    });
  }
  expect(errors, "A página não deve produzir exceções JavaScript").toEqual([]);
});

export async function expectRouteLoaded(page: Page, path: string) {
  await expect(page).toHaveURL(new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  await expect(page.locator("body")).not.toContainText("Oops! Page not found");
  await expect(page.locator("body")).not.toContainText("Carregando…");
}
