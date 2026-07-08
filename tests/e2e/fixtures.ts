import { expect, test as base, type Page } from "@playwright/test";

const pageErrors = new WeakMap<Page, string[]>();
const SUPABASE_API_PATTERN = /^https?:\/\/[^/]+\/(?:rest|functions|auth|storage)\/v1(?:\/|$)/;

async function installBackendMocks(page: Page) {
  await page.route(SUPABASE_API_PATTERN, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
      "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS, HEAD",
      "content-type": "application/json",
    };

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }

    if (url.pathname.includes("/rest/v1/")) {
      if (request.method() === "HEAD") {
        await route.fulfill({ status: 200, headers: { ...headers, "content-range": "*/0" } });
        return;
      }

      const wantsSingle = (request.headers().accept ?? "").includes("application/vnd.pgrst.object+json");
      await route.fulfill({
        status: 200,
        headers: { ...headers, "content-range": "0-0/0" },
        body: wantsSingle ? "null" : "[]",
      });
      return;
    }

    if (url.pathname.includes("/functions/v1/")) {
      await route.fulfill({ status: 200, headers, body: JSON.stringify({ ok: true }) });
      return;
    }

    if (url.pathname.includes("/auth/v1/")) {
      await route.fulfill({ status: 200, headers, body: JSON.stringify({ user: null, session: null }) });
      return;
    }

    if (url.pathname.includes("/storage/v1/")) {
      await route.fulfill({ status: 200, headers, body: "[]" });
      return;
    }

    await route.fulfill({ status: 200, headers, body: "{}" });
  });
}

export const test = base;
export { expect };

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.stack ?? error.message));
  await installBackendMocks(page);
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

export function e2eUrl(
  path: string,
  options: { role?: "superadmin" | "admin" | "equipe"; authenticated?: boolean; institution?: string } = {},
) {
  const url = new URL(path, "http://127.0.0.1:4173");
  url.searchParams.set("__e2e_role", options.role ?? "admin");
  url.searchParams.set("__e2e_auth", options.authenticated === false ? "anonymous" : "authenticated");
  url.searchParams.set("__e2e_institution", options.institution ?? "instituicao-e2e");
  return `${url.pathname}${url.search}`;
}

export async function expectRouteLoaded(page: Page, path: string) {
  await expect(page).toHaveURL(new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  await expect(page.locator("body")).not.toContainText("Oops! Page not found");
  await expect(page.locator("body")).not.toContainText("Carregando…");
}
