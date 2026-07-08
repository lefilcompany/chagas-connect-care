import { e2eUrl, expect, test } from "./fixtures";

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
  test(`${from} redireciona para ${to}`, async ({ page }) => {
    await page.goto(e2eUrl(from, { role: "admin" }));
    await expect(page).toHaveURL(new RegExp(to.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });
}

test("rota técnica legada leva admin institucional para Hoje", async ({ page }) => {
  await page.goto(e2eUrl("/app/admin/canais", { role: "admin" }));
  await expect(page).toHaveURL(/\/app\/hoje/);
});

test("rota técnica legada leva superadmin para Canais", async ({ page }) => {
  await page.goto(e2eUrl("/app/admin/canais", { role: "superadmin" }));
  await expect(page).toHaveURL(/\/superadmin\/canais/);
});

test("configuração WhatsApp legada respeita o papel", async ({ page }) => {
  await page.goto(e2eUrl("/app/configuracoes/whatsapp", { role: "superadmin" }));
  await expect(page).toHaveURL(/\/superadmin\/whatsapp\/configuracoes/);
});
