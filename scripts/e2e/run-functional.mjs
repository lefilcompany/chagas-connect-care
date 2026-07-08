import { spawn, spawnSync } from "node:child_process";
import { createWriteStream, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const supabaseArgs = ["--yes", "supabase@latest"];
const playwrightArgs = ["playwright", "test", ...process.argv.slice(2)];
const resultsDir = resolve(root, "test-results");
const functionsLogPath = resolve(resultsDir, "supabase-functions.log");

mkdirSync(resultsDir, { recursive: true });

function sanitize(text = "") {
  return text
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[JWT_LOCAL_OCULTO]")
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/g, "[DB_URL_LOCAL_OCULTA]")
    .replace(/(ANON_KEY|SERVICE_ROLE_KEY|JWT_SECRET)=[^\s]+/g, "$1=[OCULTO]");
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: options.env ?? process.env,
    encoding: "utf8",
    timeout: options.timeout ?? 10 * 60_000,
    stdio: options.inherit ? "inherit" : "pipe",
  });

  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    const output = sanitize(`${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim());
    throw new Error(`Falha em ${command} ${args.join(" ")} (exit ${result.status})\n${output}`);
  }
  return result;
}

function runSupabase(args, options = {}) {
  return run(npx, [...supabaseArgs, ...args], options);
}

function parseEnv(text) {
  const parsed = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }
  return parsed;
}

async function waitForFunctions(url, anonKey, processRef) {
  const endpoint = `${url}/functions/v1/public-onboarding?token=invalid`;
  let lastError = null;

  for (let attempt = 1; attempt <= 90; attempt += 1) {
    try {
      const response = await fetch(endpoint, {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      });
      if (response.status >= 200) return;
    } catch (error) {
      lastError = error;
    }

    if (processRef.exitCode != null) break;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1_000));
  }

  let logs = "";
  try {
    logs = sanitize(readFileSync(functionsLogPath, "utf8"));
  } catch {
    logs = "Log da Edge Function indisponível.";
  }
  throw new Error(`Edge Functions locais não ficaram prontas. ${lastError ?? ""}\n${logs}`);
}

let functionsProcess = null;
let exitCode = 1;

try {
  console.log("[e2e] Iniciando Supabase local...");
  runSupabase(["start"], { timeout: 15 * 60_000 });

  console.log("[e2e] Aplicando migrations em banco limpo...");
  runSupabase(["db", "reset"], { timeout: 15 * 60_000 });

  const status = runSupabase(["status", "-o", "env"]);
  const local = parseEnv(status.stdout ?? "");
  const apiUrl = local.API_URL;
  const anonKey = local.ANON_KEY;
  const serviceRoleKey = local.SERVICE_ROLE_KEY;

  if (!apiUrl || !anonKey || !serviceRoleKey) {
    throw new Error("Supabase CLI não retornou API_URL, ANON_KEY e SERVICE_ROLE_KEY.");
  }

  const functionalEnv = {
    ...process.env,
    SUPABASE_URL: apiUrl,
    SUPABASE_ANON_KEY: anonKey,
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
    E2E_SUPABASE_URL: apiUrl,
    E2E_SUPABASE_ANON_KEY: anonKey,
    E2E_SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
    VITE_SUPABASE_URL: apiUrl,
    VITE_SUPABASE_PUBLISHABLE_KEY: anonKey,
    VITE_SUPABASE_PROJECT_ID: "local-e2e",
  };

  console.log("[e2e] Criando usuários e dados sintéticos reais...");
  run(process.execPath, ["scripts/e2e/seed-functional.mjs"], { env: functionalEnv });

  console.log("[e2e] Servindo Edge Functions locais...");
  const logStream = createWriteStream(functionsLogPath, { flags: "w" });
  functionsProcess = spawn(npx, [...supabaseArgs, "functions", "serve"], {
    cwd: root,
    env: functionalEnv,
    stdio: ["ignore", logStream, logStream],
  });

  await waitForFunctions(apiUrl, anonKey, functionsProcess);

  console.log("[e2e] Executando Playwright contra Auth, Postgres, RLS e Functions reais...");
  const result = run(npx, playwrightArgs, {
    env: functionalEnv,
    inherit: true,
    allowFailure: true,
    timeout: 45 * 60_000,
  });
  exitCode = result.status ?? 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  exitCode = 1;
} finally {
  if (functionsProcess && functionsProcess.exitCode == null) {
    functionsProcess.kill("SIGTERM");
  }
  console.log("[e2e] Encerrando Supabase local...");
  runSupabase(["stop", "--no-backup"], { allowFailure: true, timeout: 5 * 60_000 });
}

process.exit(exitCode);
