import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = resolve(process.cwd(), "supabase/migrations");

function readMigration(name: string) {
  return readFileSync(resolve(migrationsDir, name), "utf8");
}

describe("contratos das migrations", () => {
  it("mantém migrations SQL versionadas e ordenáveis", () => {
    const migrations = readdirSync(migrationsDir)
      .filter((name) => name.endsWith(".sql"))
      .sort();

    expect(migrations.length).toBeGreaterThan(0);
    expect(migrations.every((name) => /^\d{14}_.+\.sql$/.test(name))).toBe(true);
  });

  it("concede ao service role os privilégios exigidos pelo backend", () => {
    const source = readMigration("20260708153000_grant_service_role_backend_access.sql");

    expect(source).toContain("GRANT USAGE ON SCHEMA public TO service_role");
    expect(source).toContain("GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role");
    expect(source).toContain("ALTER DEFAULT PRIVILEGES IN SCHEMA public");
  });

  it("permite leitura e atualização de profiles sem remover a proteção RLS", () => {
    const source = readMigration("20260710135500_grant_authenticated_profile_access.sql");

    expect(source).toContain("GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated");
    expect(source).toContain("GRANT SELECT ON TABLE public.user_roles TO authenticated");
    expect(source).not.toMatch(/DISABLE\s+ROW\s+LEVEL\s+SECURITY/i);
    expect(source).not.toMatch(/DISABLE\s+TRIGGER/i);
  });

  it("não cria identidade de WhatsApp quando o paciente do backfill não existe", () => {
    const source = readMigration("20260626151744_773861fc-8ffb-4681-926b-9a17f5afec3a.sql");

    expect(source).toContain("FROM public.patients p");
    expect(source).toContain("WHERE p.id =");
    expect(source).toContain("AND p.institution = 'Instituição Teste'");
  });

  it("protege migration opcional de tabela histórica ausente", () => {
    const source = readMigration("20260702121617_7e1736b1-3471-4406-bc16-6296bbecd1bf.sql");

    expect(source).toContain("IF EXISTS");
    expect(source).toContain("c.relname = 'whatsapp_template_events'");
    expect(source).toContain("EXECUTE");
  });
});
