import { accounts, authStates, ensureAuthStateDir, expect, loginThroughUi, test as setup } from "./fixtures";

setup("autenticar admin institucional real", async ({ page }) => {
  ensureAuthStateDir();
  await loginThroughUi(page, accounts.adminA);
  await expect(page.getByText("Admin A E2E").first()).toBeVisible();
  await page.context().storageState({ path: authStates.adminA });
});

setup("autenticar superadmin real", async ({ page }) => {
  ensureAuthStateDir();
  await loginThroughUi(page, accounts.superadmin);
  await page.goto("/superadmin/dashboard");
  await expect(page).toHaveURL(/\/superadmin\/dashboard$/);
  await page.context().storageState({ path: authStates.superadmin });
});
