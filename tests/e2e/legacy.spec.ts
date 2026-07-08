import { authStates, expect, test } from "./fixtures";

const institutionalRedirects = [
  ["/app/dashboard", "/app/hoje"],
  ["/app/pacientes", "/app/pessoas"],
  ["/app/mensagens", "/app/caixa"],
  ["/app/conversas", "/app/caixa"],
  ["/app/conteudos", "/app/biblioteca"],
  ["/app/conteudos/campanha", "/app/jornadas"],
  ["/app/modelos", "/app/admin/modelos-meta"],
  ["/app/segmentos", "/app/audiencias"],
  ["/app/relatorios", "/app/insights"],
  ["/app/perfil", "/app/admin/perfil"],
] as const;

for (const [from, to] of institutionalRedirects) {
  test(`${from} redireciona para ${to} com sessão real`, async ({ page }) => {
    await page.goto(from);
    await expect(page).toHaveURL(new RegExp(to.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });
}

test("rota técnica legada leva admin institucional para Hoje", async ({ page }) => {
  await page.goto("/app/admin/canais");
  await expect(page).toHaveURL(/\/app\/hoje$/);
});

test("rota técnica legada leva superadmin real para Canais", async ({ browser }) => {
  const context = await browser.newContext({ storageState: authStates.superadmin });
  const page = await context.newPage();

  await page.goto("/app/admin/canais");
  await expect(page).toHaveURL(/\/superadmin\/canais$/);

  await context.close();
});

test("configuração WhatsApp legada respeita papel superadmin real", async ({ browser }) => {
  const context = await browser.newContext({ storageState: authStates.superadmin });
  const page = await context.newPage();

  await page.goto("/app/configuracoes/whatsapp");
  await expect(page).toHaveURL(/\/superadmin\/whatsapp\/configuracoes$/);

  await context.close();
});
