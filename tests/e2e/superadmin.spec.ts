import { expect, expectRouteLoaded, institutions, test } from "./fixtures";

const superadminRoutes = [
  { path: "/superadmin/dashboard", label: "Dashboard" },
  { path: "/superadmin/instituicoes", label: "Instituições" },
  { path: "/superadmin/canais", label: "Canais" },
  { path: "/superadmin/whatsapp/configuracoes", label: "Configurações WhatsApp" },
  { path: "/superadmin/whatsapp/templates", label: "Templates WhatsApp" },
  { path: "/superadmin/whatsapp/diagnostico", label: "Diagnóstico WhatsApp" },
  { path: "/superadmin/auditoria", label: "Auditoria" },
] as const;

for (const route of superadminRoutes) {
  test(`${route.label}: rota superadmin usa papel real do banco`, async ({ page }) => {
    await page.goto(route.path);
    await expectRouteLoaded(page, route.path);
    await expect(page.locator("main")).toBeVisible();
  });
}

test("superadmin enxerga instituições persistidas", async ({ page }) => {
  await page.goto("/superadmin/instituicoes");

  await expect(page.getByText(institutions.a, { exact: true })).toBeVisible();
  await expect(page.getByText(institutions.b, { exact: true })).toBeVisible();
  await expect(page.getByText(institutions.platform, { exact: true })).toBeVisible();
});

test("superadmin acessa também a aplicação institucional", async ({ page }) => {
  await page.goto("/app/hoje");
  await expectRouteLoaded(page, "/app/hoje");
});
