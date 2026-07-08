import { e2eUrl, expect, expectRouteLoaded, test } from "./fixtures";

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
  test(`${route.label}: rota superadmin carrega sem exceções`, async ({ page }) => {
    await page.goto(e2eUrl(route.path, { role: "superadmin" }));

    await expectRouteLoaded(page, route.path);
    await expect(page.locator("body")).toContainText(/superadmin|institui|whatsapp|auditoria|canal/i);
  });
}

test("superadmin acessa também a aplicação institucional", async ({ page }) => {
  await page.goto(e2eUrl("/app/hoje", { role: "superadmin" }));

  await expectRouteLoaded(page, "/app/hoje");
});
