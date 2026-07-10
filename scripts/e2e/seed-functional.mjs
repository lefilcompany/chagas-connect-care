import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function required(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  throw new Error(`Variável obrigatória ausente: ${names.join(" ou ")}`);
}

const supabaseUrl = required("SUPABASE_URL", "API_URL");
const serviceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY", "SERVICE_ROLE_KEY");

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const fixtures = {
  institutions: {
    a: "hospital-e2e-a",
    b: "hospital-e2e-b",
    platform: "plataforma-e2e",
  },
  accounts: {
    adminA: {
      email: "admin.a@e2e.local",
      password: "E2eAdminA!2026",
      fullName: "Admin A E2E",
      role: "admin",
      institution: "hospital-e2e-a",
    },
    adminB: {
      email: "admin.b@e2e.local",
      password: "E2eAdminB!2026",
      fullName: "Admin B E2E",
      role: "admin",
      institution: "hospital-e2e-b",
    },
    superadmin: {
      email: "superadmin@e2e.local",
      password: "E2eSuperadmin!2026",
      fullName: "Superadmin E2E",
      role: "superadmin",
      institution: "plataforma-e2e",
    },
  },
  patients: {
    a: {
      id: "11111111-1111-4111-8111-111111111111",
      full_name: "Paciente A E2E",
      institution: "hospital-e2e-a",
      city: "Recife",
      state: "PE",
      stage: "cronico",
      status: "ativo",
      channel_pref: "whatsapp",
      phone: "5581999990001",
      email: "paciente.a@example.test",
    },
    b: {
      id: "22222222-2222-4222-8222-222222222222",
      full_name: "Paciente B E2E",
      institution: "hospital-e2e-b",
      city: "Olinda",
      state: "PE",
      stage: "diagnostico",
      status: "ativo",
      channel_pref: "whatsapp",
      phone: "5581999990002",
      email: "paciente.b@example.test",
    },
  },
  taskA: {
    id: "33333333-3333-4333-8333-333333333333",
    title: "Confirmar retorno E2E",
    description: "Tarefa sintética criada para validação funcional.",
    institution: "hospital-e2e-a",
    patient_id: "11111111-1111-4111-8111-111111111111",
    status: "aberta",
    priority: "alta",
  },
  onboardingInvite: {
    id: "44444444-4444-4444-8444-444444444444",
    token: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    institution: "hospital-e2e-a",
    intended_role: "paciente",
    status: "pending",
    phone: "5581999990099",
    wa_id: "5581999990099",
    expires_at: "2099-12-31T23:59:59.000Z",
  },
};

async function ensureNoError(label, result) {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }
  return result.data;
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function localDatabaseContainer() {
  const config = readFileSync(resolve(process.cwd(), "supabase/config.toml"), "utf8");
  const projectId = config.match(/^project_id\s*=\s*"([^"]+)"/m)?.[1];
  if (!projectId) {
    throw new Error("Não foi possível identificar project_id em supabase/config.toml.");
  }
  return `supabase_db_${projectId}`;
}

function runLocalSql(sql) {
  const docker = process.platform === "win32" ? "docker.exe" : "docker";
  const result = spawnSync(
    docker,
    [
      "exec",
      "-i",
      localDatabaseContainer(),
      "psql",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "postgres",
      "-d",
      "postgres",
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      input: sql,
      timeout: 60_000,
    },
  );

  if (result.error) throw result.error;
  if (result.status !== 0) {
    const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
    throw new Error(`Falha ao preparar perfil no Postgres local: ${output}`);
  }
}

async function createAuthAccount(account) {
  const created = await ensureNoError(
    `Criar usuário ${account.email}`,
    await admin.auth.admin.createUser({
      email: account.email,
      password: account.password,
      email_confirm: true,
      user_metadata: {
        full_name: account.fullName,
        role_label: account.role === "superadmin" ? "Superadmin" : "Administrador",
        professional_registry: "E2E-TEST",
      },
    }),
  );

  const userId = created.user.id;
  const roles = account.role === "superadmin"
    ? [
        { user_id: userId, role: "superadmin" },
        // O trigger legado verifica explicitamente o papel admin. A fixture
        // mantém também superadmin para validar os dois contratos reais.
        { user_id: userId, role: "admin" },
      ]
    : [{ user_id: userId, role: account.role }];

  await ensureNoError(
    `Criar papel ${account.email}`,
    await admin.from("user_roles").upsert(roles, { onConflict: "user_id,role" }),
  );

  return userId;
}

function completeProfile(actorId, userId, account) {
  const roleLabel = account.role === "superadmin" ? "Superadmin" : "Administrador";

  // O banco local é efêmero e executado pelo owner apenas para preparar fixtures.
  // RLS é bypassada pelo owner, mas o trigger permanece ativo. Os claims do ator
  // são definidos para que a própria regra de autorização do trigger seja
  // exercitada, sem desativar policy ou trigger.
  runLocalSql(`
BEGIN;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', ${sqlLiteral(actorId)}, 'role', 'authenticated')::text,
  true
);

UPDATE public.profiles
SET full_name = ${sqlLiteral(account.fullName)},
    role_label = ${sqlLiteral(roleLabel)},
    professional_registry = 'E2E-TEST',
    institution = ${sqlLiteral(account.institution)}
WHERE id = ${sqlLiteral(userId)}::uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = ${sqlLiteral(userId)}::uuid
      AND institution = ${sqlLiteral(account.institution)}
  ) THEN
    RAISE EXCEPTION 'Perfil E2E não recebeu a instituição esperada';
  END IF;
END $$;

COMMIT;
`);
}

const superadminId = await createAuthAccount(fixtures.accounts.superadmin);
completeProfile(superadminId, superadminId, fixtures.accounts.superadmin);

const adminAId = await createAuthAccount(fixtures.accounts.adminA);
completeProfile(superadminId, adminAId, fixtures.accounts.adminA);

const adminBId = await createAuthAccount(fixtures.accounts.adminB);
completeProfile(superadminId, adminBId, fixtures.accounts.adminB);

await ensureNoError(
  "Criar pacientes funcionais",
  await admin.from("patients").insert([
    { ...fixtures.patients.a, owner_id: adminAId },
    { ...fixtures.patients.b, owner_id: adminBId },
  ]),
);

await ensureNoError(
  "Criar tarefa funcional",
  await admin.from("journey_tasks").insert(fixtures.taskA),
);

await ensureNoError(
  "Criar convite funcional",
  await admin.from("onboarding_invites").insert(fixtures.onboardingInvite),
);

console.log("Seed funcional concluído com dados exclusivamente sintéticos.");
