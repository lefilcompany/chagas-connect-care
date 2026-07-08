import { expect, expectRouteLoaded, patients, test } from "./fixtures";

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
  test(`${route.label}: rota institucional usa sessão e backend reais`, async ({ page }) => {
    await page.goto(route.path);
    await expectRouteLoaded(page, route.path);
    await expect(page.locator("main")).toBeVisible();
  });
}

test("lista somente pacientes permitidos pela RLS da instituição", async ({ page }) => {
  await page.goto("/app/pessoas");

  await expect(page.getByText(patients.a.name, { exact: true })).toBeVisible();
  await expect(page.getByText(patients.b.name, { exact: true })).toHaveCount(0);
});

test("tarefa persistida no banco aparece na jornada institucional", async ({ page }) => {
  await page.goto("/app/jornadas/tarefas");

  await expect(page.getByText("Confirmar retorno E2E", { exact: true })).toBeVisible();
});

test("alteração de perfil é persistida e sobrevive ao reload", async ({ page }) => {
  await page.goto("/app/admin/perfil");
  const nameInput = page.getByLabel("Nome completo");

  await expect(nameInput).toHaveValue("Admin A E2E");
  await nameInput.fill("Admin A E2E Atualizado");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText("Perfil atualizado")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Nome completo")).toHaveValue("Admin A E2E Atualizado");
});

test("usuário institucional não acessa área superadmin", async ({ page }) => {
  await page.goto("/superadmin/dashboard");
  await expect(page).toHaveURL(/\/app\/hoje$/);
});
