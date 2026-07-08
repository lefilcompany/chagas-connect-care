import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");

const publicRoutes = [
  "/",
  "/auth",
  "/politica-de-privacidade",
  "/termos-de-uso",
  "/exclusao-de-dados",
  "/cadastro/:token",
];

const institutionalRoutes = [
  "hoje",
  "pessoas",
  "pessoas/:id",
  "caixa",
  "jornadas",
  "jornadas/tarefas",
  "jornadas/:id",
  "biblioteca",
  "audiencias",
  "insights",
  "admin/modelos-meta",
  "admin/modelos-meta/novo",
  "admin/modelos-meta/:templateId",
  "admin/instituicao",
  "admin/equipe",
  "admin/privacidade",
  "admin/perfil",
];

const superadminRoutes = [
  "dashboard",
  "instituicoes",
  "canais",
  "whatsapp/configuracoes",
  "whatsapp/templates",
  "whatsapp/diagnostico",
  "auditoria",
];

const legacyRoutes = [
  "pacientes",
  "mensagens",
  "conversas",
  "conteudos",
  "conteudos/campanha",
  "modelos",
  "segmentos",
  "relatorios",
  "integracoes",
  "perfil",
];

describe("route contracts", () => {
  it.each(publicRoutes)("mantém a rota pública %s", (route) => {
    expect(appSource).toContain(`path="${route}"`);
  });

  it.each(institutionalRoutes)("mantém a rota institucional %s", (route) => {
    expect(appSource).toContain(`path="${route}"`);
  });

  it.each(superadminRoutes)("mantém a rota superadmin %s", (route) => {
    expect(appSource).toContain(`path="${route}"`);
  });

  it.each(legacyRoutes)("mantém contrato ou redirect legado %s", (route) => {
    expect(appSource).toContain(`path="${route}"`);
  });

  it("mantém catch-all após as rotas customizadas", () => {
    const catchAllIndex = appSource.lastIndexOf('path="*"');
    const appIndex = appSource.indexOf('path="/app"');
    expect(catchAllIndex).toBeGreaterThan(appIndex);
  });
});
