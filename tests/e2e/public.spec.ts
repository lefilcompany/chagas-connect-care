import { e2eUrl, expect, test } from "./fixtures";

test("landing apresenta proposta e acesso ao sistema", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/ELO2.*Chagas Connect Care/i);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Conecte cada pessoa da rede de cuidado");
  await expect(page.getByRole("link", { name: "Acessar o sistema" })).toHaveAttribute("href", "/auth");
});

test("autenticação apresenta login e criação de conta", async ({ page }) => {
  await page.goto(e2eUrl("/auth", { authenticated: false }));

  await expect(page.getByRole("heading", { name: "Acessar Chagas Cuidado Digital" })).toBeAttached();
  await expect(page.getByRole("tab", { name: "Entrar" })).toBeVisible();
  await expect(page.getByLabel("E-mail").first()).toBeVisible();
  await page.getByRole("tab", { name: "Criar conta" }).click();
  await expect(page.getByLabel("Nome completo")).toBeVisible();
  await expect(page.getByLabel("Função")).toBeVisible();
});

for (const [path, heading] of [
  ["/politica-de-privacidade", "Política de Privacidade"],
  ["/termos-de-uso", "Termos de Uso"],
  ["/exclusao-de-dados", "Exclusão de Dados"],
] as const) {
  test(`documento legal ${path} permanece acessível`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  });
}

test("visitante é redirecionado ao login ao abrir área autenticada", async ({ page }) => {
  await page.goto(e2eUrl("/app/hoje", { authenticated: false }));
  await expect(page).toHaveURL(/\/auth$/);
});

test("rota inexistente exibe página 404", async ({ page }) => {
  await page.goto("/rota-que-nao-existe");
  await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
  await expect(page.getByText("Oops! Page not found")).toBeVisible();
});
