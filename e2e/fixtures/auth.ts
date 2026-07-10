import { Page, expect } from "@playwright/test";

/**
 * Faz login com o usuário de teste definido nos secrets do CI
 * (TEST_USER_EMAIL / TEST_USER_PASSWORD) e aguarda a chegada em /app.
 */
export async function loginAsTestUser(page: Page) {
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "TEST_USER_EMAIL/TEST_USER_PASSWORD não configurados. Ver e2e/README.md.",
    );
  }

  await page.goto("/auth");
  await page.getByLabel("E-mail").first().fill(email);
  await page.getByLabel("Senha").first().fill(password);
  await page.getByRole("button", { name: /entrar/i }).click();

  await expect(page).toHaveURL(/\/app(\/|$)/, { timeout: 15_000 });
}