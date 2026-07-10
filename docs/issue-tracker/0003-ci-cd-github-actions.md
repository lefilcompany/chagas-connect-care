---
id: 0003
titulo: CI/CD com GitHub Actions (lint, unit, deno, e2e)
status: em-andamento
tipo: chore
prioridade: alta
criado_em: 2026-07-10
atualizado_em: 2026-07-10
responsavel: null
relacionados: []
adr: null
---

## Contexto

Não havia pipeline de verificação automatizada. Todo push para `main`
e todo PR (qualquer branch → qualquer branch) precisa validar lint,
testes unitários (Vitest), testes Deno (edge functions) e testes E2E
(Playwright contra preview publicado).

## O que fazer

- Adicionar `.github/workflows/ci.yml` com 4 jobs paralelos: `lint`,
  `unit`, `deno-test`, `e2e`.
- Introduzir Playwright: `playwright.config.ts`, pasta `e2e/`, spec
  smoke inicial, helper de login.
- Novos scripts em `package.json`: `test:unit`, `test:e2e`,
  `test:e2e:install`.
- Adicionar `@playwright/test` como devDependency.
- Atualizar `.gitignore` com artefatos do Playwright.
- Introduzir template de PR com checklist da Definition of Done.
- Atualizar `AGENTS.md`: nova §14 (Definition of Done por
  funcionalidade) e linha na matriz §4 exigindo teste E2E em novos
  slices frontend.
- Atualizar `README.md` apontando o pipeline e como rodar E2E.

## Critérios de aceitação

- [x] Workflow criado e disparado em `pull_request` e `push` para `main`
- [x] Job de lint executando `bun run lint`
- [x] Job de unit executando `bun run test:unit`
- [x] Job Deno rodando `deno test supabase/functions/`
- [x] Job E2E rodando Playwright contra `PLAYWRIGHT_BASE_URL`
- [x] `AGENTS.md §14` publicada com regra obrigatória
- [x] Template de PR com checklist
- [ ] Secrets `PLAYWRIGHT_BASE_URL`, `TEST_USER_EMAIL`,
      `TEST_USER_PASSWORD` configurados no GitHub (ação do usuário)

## Fora de escopo

- Deploy automatizado (Lovable já publica).
- Coverage report.
- E2E multi-browser (Firefox/Webkit).
- Job dedicado de `tsc --noEmit`.
- Branch protection rules (configuração manual no GitHub).

## Notas

- Job E2E falha explicitamente com mensagem instrutiva se qualquer um
  dos 3 secrets estiver ausente; os outros 3 jobs continuam operando
  normalmente enquanto o usuário não configurar.
- `concurrency` cancela runs obsoletos do mesmo ref para economizar
  tempo de execução.