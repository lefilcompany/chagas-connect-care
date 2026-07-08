import { e2eUrl, expect, expectRouteLoaded, test } from "./fixtures";

const institutionalRoutes = [
  { path: "/app/hoje", label: "Hoje" },
  { path: "/app/pessoas", label: "Pessoas" },
  { path: "/app/caixa", label: "Caixa" },
  { path: "/app/jornadas", label: "Jornadas" },
  { path: "/app/jornadas/tarefas", label: "Tarefas" },
  { path: "/app/biblioteca", label: "Biblioteca" },
  { path: "/app/audiencias", label: "Audiências" },
  { path: "/app/insights", label: "Insights" },
  { path: "/app/admin/modelos-meta", label: "Modelos Meta" },
  { path: "/app/admin/instituicao", label: "Instituição" },
  { path: "/app/admin/equipe", label: "Equipe" },
  { path: "/app/admin/privacidade", label: "Privacidade" },
  { path: "/app/admin/perfil", label: "Perfil" },
] as const;

for (const route of institutionalRoutes) {
  test(`${route.label}: rota institucional carrega sem exceções`, async ({ page }) => {
    await page.goto(e2eUrl(route.path, { role: "admin" }));

    await expectRouteLoaded(page, route.path);
    await expect(page.getByText("Chagas Connect Care", { exact: true }).first()).toBeVisible();
  });
}

test("usuário institucional não acessa a área superadmin", async ({ page }) => {
  await page.goto(e2eUrl("/superadmin/dashboard", { role: "admin" }));

  await expect(page).toHaveURL(/\/app\/hoje/);
});
