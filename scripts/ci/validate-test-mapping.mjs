import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const matrixPath = resolve(root, "tests/test-matrix.json");
const matrix = JSON.parse(readFileSync(matrixPath, "utf8"));
const baseSha = process.env.BASE_SHA || "";
const headSha = process.env.HEAD_SHA || "HEAD";

function git(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function usableBase(sha) {
  return sha && !/^0+$/.test(sha) && sha !== headSha;
}

function changedFiles() {
  if (usableBase(baseSha)) {
    return git(["diff", "--name-only", `${baseSha}...${headSha}`]).split("\n").filter(Boolean);
  }
  try {
    return git(["diff", "--name-only", `${headSha}^`, headSha]).split("\n").filter(Boolean);
  } catch {
    return git(["show", "--pretty=", "--name-only", headSha]).split("\n").filter(Boolean);
  }
}

function escapeRegex(char) {
  return "\\^$.*+?()[]{}|".includes(char) ? `\\${char}` : char;
}

function globToRegex(glob) {
  let pattern = "^";
  for (let index = 0; index < glob.length; index += 1) {
    const char = glob[index];
    if (char === "*" && glob[index + 1] === "*") {
      pattern += ".*";
      index += 1;
    } else if (char === "*") {
      pattern += "[^/]*";
    } else {
      pattern += escapeRegex(char);
    }
  }
  return new RegExp(`${pattern}$`);
}

function isFunctionalSource(file) {
  if (file.startsWith("src/test/") || file.startsWith("tests/")) return false;
  if (file.startsWith("src/integrations/supabase/")) return false;
  if (file.startsWith("src/assets/")) return false;
  if (file.endsWith(".d.ts")) return false;
  return file.startsWith("src/")
    || file.startsWith("supabase/functions/")
    || file.startsWith("supabase/migrations/");
}

const errors = [];
const ids = new Set();
const matchers = matrix.functionalities.map((functionality) => {
  if (ids.has(functionality.id)) errors.push(`ID de funcionalidade duplicado: ${functionality.id}`);
  ids.add(functionality.id);

  if (!functionality.unitTests?.length) errors.push(`${functionality.id}: nenhum teste unitário mapeado`);
  if (!functionality.e2eTests?.length) errors.push(`${functionality.id}: nenhum teste E2E mapeado`);

  for (const testFile of [...(functionality.unitTests ?? []), ...(functionality.e2eTests ?? [])]) {
    if (!existsSync(resolve(root, testFile))) errors.push(`${functionality.id}: teste inexistente ${testFile}`);
  }

  return {
    ...functionality,
    sourceMatchers: functionality.sources.map(globToRegex),
  };
});

const files = changedFiles();
const changedSet = new Set(files);
const functionalFiles = files.filter(isFunctionalSource);
const affected = new Map();

for (const file of functionalFiles) {
  const featureMatch = file.match(/^src\/features\/([^/]+)\//);
  if (featureMatch && !matrix.knownFeatureRoots.includes(featureMatch[1])) {
    errors.push(`Novo feature root sem cadastro em knownFeatureRoots: ${featureMatch[1]} (${file})`);
  }

  const edgeMatch = file.match(/^supabase\/functions\/([^/]+)\//);
  if (edgeMatch && edgeMatch[1] !== "_shared" && !matrix.knownEdgeFunctions.includes(edgeMatch[1])) {
    errors.push(`Nova edge function sem cadastro em knownEdgeFunctions: ${edgeMatch[1]} (${file})`);
  }

  const matches = matchers.filter((entry) => entry.sourceMatchers.some((matcher) => matcher.test(file)));
  if (!matches.length) {
    errors.push(`Arquivo funcional sem mapeamento: ${file}`);
    continue;
  }
  for (const entry of matches) affected.set(entry.id, entry);
}

for (const entry of affected.values()) {
  const changedUnit = entry.unitTests.some((file) => changedSet.has(file));
  const changedE2E = entry.e2eTests.some((file) => changedSet.has(file));
  if (!changedUnit) {
    errors.push(`${entry.id}: mudança funcional sem atualização de teste unitário mapeado`);
  }
  if (!changedE2E) {
    errors.push(`${entry.id}: mudança funcional sem atualização de teste E2E mapeado`);
  }
}

if (errors.length) {
  console.error("\nFalhas no mapa de testes:\n- " + errors.join("\n- "));
  process.exit(1);
}

console.log(`Mapa válido: ${matrix.functionalities.length} funcionalidades, ${functionalFiles.length} arquivo(s) funcional(is) alterado(s), ${affected.size} domínio(s) afetado(s).`);
