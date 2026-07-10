import { test, expect } from "@playwright/test";
import { loginAsTestUser } from "./fixtures/auth";

test.describe("Smoke — login + app shell", () => {
  test("usuário autenticado chega em /app/today e vê o cabeçalho", async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/app/today");
    await expect(page).toHaveURL(/\/app\/today/);
    await expect(page.locator("h1").first()).toBeVisible();
  });
});