import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const root = resolve(process.cwd());
const baseSha = process.env.BASE_SHA || "";
const headSha = process.env.HEAD_SHA || "HEAD";
const eventName = process.env.GITHUB_EVENT_NAME || "local";

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

function isFunctional(file) {
  if (file.startsWith("src/test/") || file.startsWith("tests/")) return false;
  if (file.startsWith("src/integrations/supabase/")) return false;
  if (file.startsWith("src/assets/")) return false;
  return file.startsWith("src/")
    || file.startsWith("supabase/functions/")
    || file.startsWith("supabase/migrations/")
    || file === "package.json";
}

function markdownFiles(dir, pattern) {
  const absolute = join(root, dir);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute)
    .filter((name) => pattern.test(name))
    .map((name) => join(dir, name));
}

function frontmatter(file) {
  const content = readFileSync(join(root, file), "utf8");
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) throw new Error(`${file}: frontmatter ausente`);
  const values = {};
  for (const line of match[1].split("\n")) {
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    values[key] = value;
  }
  return values;
}

function validateIssues(errors) {
  const allowed = new Set(["aberto", "em-andamento", "bloqueado", "concluido", "descartado"]);
  const ids = new Set();
  for (const file of markdownFiles("docs/issue-tracker", /^\d{4}-.*\.md$/)) {
    const fm = frontmatter(file);
    const filenameId = basename(file).slice(0, 4);
    if (fm.id !== filenameId) errors.push(`${file}: id ${fm.id || "ausente"} não corresponde ao nome`);
    if (ids.has(fm.id)) errors.push(`${file}: id duplicado ${fm.id}`);
    ids.add(fm.id);
    if (!allowed.has(fm.status)) errors.push(`${file}: status inválido ${fm.status || "ausente"}`);
    if (["em-andamento", "concluido"].includes(fm.status) && (!fm.responsavel || fm.responsavel === "null")) {
      errors.push(`${file}: responsável obrigatório para status ${fm.status}`);
    }
  }
}

function validateAdrs(errors) {
  const ids = new Set();
  for (const file of markdownFiles("docs/adr", /^\d{4}-.*\.md$/).filter((file) => !file.includes("0000-template"))) {
    const fm = frontmatter(file);
    const filenameId = basename(file).slice(0, 4);
    if (fm.id !== filenameId) errors.push(`${file}: id ${fm.id || "ausente"} não corresponde ao nome`);
    if (ids.has(fm.id)) errors.push(`${file}: id duplicado ${fm.id}`);
    ids.add(fm.id);
    const validStatus = ["proposto", "aceito", "descartado"].includes(fm.status)
      || fm.status?.startsWith("substituido-por");
    if (!validStatus) errors.push(`${file}: status inválido ${fm.status || "ausente"}`);
  }
}

function validateOrder(errors, files) {
  if (eventName !== "pull_request" || !usableBase(baseSha) || !files.some(isFunctional)) return;
  const commits = git(["rev-list", "--reverse", `${baseSha}..${headSha}`]).split("\n").filter(Boolean);
  let firstFunctional = Infinity;
  let firstIssue = Infinity;
  let firstAdr = Infinity;

  commits.forEach((commit, index) => {
    const touched = git(["diff-tree", "--no-commit-id", "--name-only", "-r", commit]).split("\n").filter(Boolean);
    if (touched.some(isFunctional)) firstFunctional = Math.min(firstFunctional, index);
    if (touched.some((file) => /^docs\/issue-tracker\/\d{4}-.*\.md$/.test(file))) firstIssue = Math.min(firstIssue, index);
    if (touched.some((file) => /^docs\/adr\/(?!0000)\d{4}-.*\.md$/.test(file))) firstAdr = Math.min(firstAdr, index);
  });

  if (firstIssue > firstFunctional) errors.push("O issue deve aparecer no histórico antes da primeira mudança funcional.");
  if (firstAdr > firstFunctional) errors.push("O ADR deve aparecer no histórico antes da primeira mudança funcional.");
}

const files = changedFiles();
const functional = files.filter(isFunctional);
const changedIssues = files.filter((file) => /^docs\/issue-tracker\/\d{4}-.*\.md$/.test(file));
const changedAdrs = files.filter((file) => /^docs\/adr\/(?!0000)\d{4}-.*\.md$/.test(file));
const errors = [];

validateIssues(errors);
validateAdrs(errors);

if (functional.length) {
  if (!changedIssues.length) errors.push("Mudança funcional sem issue em docs/issue-tracker/.");
  if (!changedAdrs.length) errors.push("Mudança funcional sem ADR em docs/adr/.");
}

validateOrder(errors, files);

if (errors.length) {
  console.error("\nFalhas de governança:\n- " + errors.join("\n- "));
  process.exit(1);
}

console.log(`Governança válida: ${functional.length} arquivo(s) funcional(is), ${changedIssues.length} issue(s) e ${changedAdrs.length} ADR(s) no diff.`);
