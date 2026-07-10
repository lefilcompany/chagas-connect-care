# Plano — CI/CD com GitHub Actions + regra no AGENTS.md

## Escopo

Configurar CI que roda em **todo PR (qualquer branch → qualquer branch)** e em **todo push para `main`**, cobrindo:

1. **Lint** (ESLint, sem erros)
2. **Testes unitários** (Vitest — já existente)
3. **Testes Deno** das edge functions (job separado)
4. **Testes E2E** (Playwright contra preview publicado Lovable)

E acrescentar no `AGENTS.md` a regra: toda funcionalidade nova entrega testes unitários + testes E2E + lint limpo, obrigatoriamente.

## Arquivos a criar

```text
.github/workflows/ci.yml         # workflow único com 4 jobs paralelos
playwright.config.ts             # config raiz do Playwright
e2e/
  fixtures/auth.ts               # helper de login usando TEST_USER_EMAIL/TEST_USER_PASSWORD
  smoke.spec.ts                  # 1 spec inicial: login → /app/today carrega
  README.md                      # como rodar local e no CI
.github/PULL_REQUEST_TEMPLATE.md # checklist: lint OK, unit OK, e2e OK
```

## Alterações em arquivos existentes

- `package.json` — novos scripts:
  - `"test:unit": "vitest run"` (alias do atual `test`)
  - `"test:e2e": "playwright test"`
  - `"test:e2e:install": "playwright install --with-deps chromium"`
- `package.json` devDependencies — `@playwright/test`
- `.gitignore` — adicionar `playwright-report/`, `test-results/`, `e2e/.auth/`
- `AGENTS.md` — nova seção **§14 Definition of Done por funcionalidade** (detalhe em "Regra no AGENTS.md" abaixo)
- `README.md` — parágrafo curto apontando o novo workflow e como rodar E2E local

## Estrutura do workflow `.github/workflows/ci.yml`

```text
name: CI
on:
  pull_request:            # qualquer branch → qualquer branch
  push:
    branches: [main]

jobs:
  lint:            # bun install → bun run lint
  unit:            # bun install → bun run test:unit
  deno-test:       # setup deno → deno test supabase/functions/ -A
  e2e:             # bun install → playwright install chromium
                   # → playwright test (usa PLAYWRIGHT_BASE_URL do secret)
```

- Todos os 4 jobs rodam em paralelo (economiza tempo; falha de um não bloqueia execução dos outros, mas bloqueia o merge).
- `concurrency` por ref para cancelar runs obsoletos no mesmo PR.
- Cache de `~/.bun/install/cache` por hash do `bun.lockb`.
- Artefatos: `playwright-report/` publicado como artifact em falha do job E2E.

## Segredos necessários (GitHub → Settings → Secrets)

O usuário precisa configurar manualmente antes do primeiro run verde:

- `PLAYWRIGHT_BASE_URL` = `https://chagas-connect-care.lovable.app` (preview publicado)
- `TEST_USER_EMAIL` = e-mail de um usuário de teste (criado por você no Lovable Cloud)
- `TEST_USER_PASSWORD` = senha desse usuário

O plano cria a documentação em `e2e/README.md` explicando exatamente como obter/criar cada um. Sem esses secrets, o job E2E falha com mensagem clara — os outros 3 jobs continuam funcionando.

## Playwright — smoke test inicial

Um único spec (`e2e/smoke.spec.ts`):

1. Vai para `/auth`
2. Faz login com `TEST_USER_EMAIL` / `TEST_USER_PASSWORD`
3. Aguarda redirecionamento para `/app/today`
4. Assere que o cabeçalho "Hoje" está visível

Suficiente para validar o pipeline. Specs por feature entram conforme cada nova funcionalidade (regra do AGENTS.md abaixo).

## Regra no `AGENTS.md` (nova §14)

Texto que será adicionado (resumo):

> **§14 Definition of Done por funcionalidade**
>
> Uma funcionalidade só é considerada concluída quando entrega, na mesma tarefa:
>
> 1. **Testes unitários** cobrindo o caminho feliz + pelo menos 1 borda relevante da lógica de negócio nova (Vitest em `src/**/*.test.ts(x)` ou Deno em `supabase/functions/**/*.test.ts`).
> 2. **Teste E2E** cobrindo o fluxo do usuário exposto pela funcionalidade, em `e2e/<slice>/<fluxo>.spec.ts`. Toda rota nova ou ação crítica (envio, aprovação, exclusão) exige spec.
> 3. **Lint limpo**: `bun run lint` sem erros nem novos warnings introduzidos pela mudança.
>
> QA/Docs (papel §3.6) tem poder de veto: PR que quebre qualquer um dos 3 critérios volta para o autor. O CI (`.github/workflows/ci.yml`) automatiza a verificação em todo PR e no push para `main`.

Também atualiza a matriz §4 acrescentando "Teste E2E obrigatório" na linha de "Novo slice em src/features/*".

## O que fica de fora (explicitamente)

- **Deploy automatizado** — o Lovable já publica; CI só valida.
- **Coverage report** — não pedido; podemos adicionar depois.
- **Testes E2E multi-browser** (Firefox/Webkit) — só Chromium para manter CI rápido; adicionar depois se necessário.
- **Verificação de tipos (`tsc --noEmit`)** — o `vite build` faz check implícito; se quiser job dedicado, é adição futura.
- **Auto-merge / branch protection rules** — configuração manual no GitHub, fora do escopo do repositório.

## Ordem de execução (quando aprovado)

1. Criar `.github/workflows/ci.yml`
2. Criar `playwright.config.ts` + `e2e/` + `e2e/README.md`
3. Ajustar `package.json` (scripts + devDep) e `.gitignore`
4. Atualizar `AGENTS.md` (§14 + linha na matriz §4) e `README.md`
5. Criar issue `docs/issue-tracker/0003-ci-cd-github-actions.md` documentando a entrega
6. Instruir usuário a configurar os 3 secrets no GitHub
