# Chagas Digital Care

Plataforma multi-instituição para coordenar comunicação, acompanhamento,
automações e trabalho humano ao redor da jornada de cuidado.

> Idioma oficial do produto e da documentação: **pt-BR**.

## Estado do produto

O repositório implementa:

- pacientes e contatos da rede de cuidado;
- dados clínicos limitados para contexto e adesão;
- WhatsApp bidirecional, identidades, conversas, mídia e templates Meta;
- audiências e envios em lote;
- jornadas em grafo, execuções, passos e tarefas;
- área institucional e área de superadmin;
- backend Supabase/Lovable Cloud com RLS e Edge Functions;
- CI/CD com governança, lint, TypeScript, unitários, cobertura, build e E2E.

SMS aparece no schema, mas permanece parcial até validação ponta a ponta. E-mail
é visão futura e não faz parte do enum atual.

---

## Documentação canônica

Leia nesta ordem:

1. [`CONTEXT.md`](./CONTEXT.md) — propósito, fronteiras, estado e invariantes.
2. [`AGENTS.md`](./AGENTS.md) — fluxo obrigatório e Definition of Done.
3. [`docs/domain/`](./docs/domain/) — domínio, consentimento e estados.
4. [`docs/architecture.md`](./docs/architecture.md) — arquitetura e fluxos.
5. [`docs/testing-and-ci.md`](./docs/testing-and-ci.md) — pipeline, testes,
   artifacts, matriz e branch protection.
6. [`docs/risks.md`](./docs/risks.md) — riscos e dívidas.
7. [`docs/adr/`](./docs/adr/) — decisões.
8. [`docs/issue-tracker/`](./docs/issue-tracker/) — trabalho versionado.

Marcadores:

- **[ATUAL]** — comprovado pelo código/schema;
- **[DECISÃO]** — ADR aceito;
- **[ALVO]** — direção futura;
- **[HIPÓTESE]** — questão não validada.

---

## Regra para novas funcionalidades

Antes do primeiro commit funcional:

1. criar issue;
2. criar ADR;
3. mapear fontes, unitários e E2E em `tests/test-matrix.json`.

Antes de concluir:

1. adicionar/atualizar testes unitários;
2. adicionar/atualizar E2E;
3. passar em lint, TypeScript, cobertura, build e Playwright;
4. obter **Quality gate** verde;
5. concluir issue e atualizar ADR/docs.

A CI bloqueia mudança funcional sem issue, ADR ou testes mapeados.

---

## Decisões principais

| ADR | Estado | Decisão |
| --- | --- | --- |
| [0001](./docs/adr/0001-adotar-supabase-lovable-como-backend.md) | aceito | Supabase/Lovable como backend. |
| [0002](./docs/adr/0002-isolar-instituicoes-com-rls.md) | aceito | Isolamento com RLS. |
| [0003](./docs/adr/0003-armazenar-papeis-em-user-roles.md) | aceito | Papéis em `user_roles`. |
| [0004](./docs/adr/0004-representar-jornadas-como-grafos-versionados.md) | aceito | Jornadas como grafos versionados. |
| [0005](./docs/adr/0005-separar-identidade-conversa-e-pessoa-no-whatsapp.md) | aceito | Identidade/conversa/pessoa separadas. |
| [0006](./docs/adr/0006-limitar-dados-clinicos-ao-cuidado-coordenado.md) | proposto | Limite dos dados clínicos. |
| [0007](./docs/adr/0007-manter-issue-tracker-local-em-markdown.md) | aceito | Issue tracker local. |
| [0008](./docs/adr/0008-adotar-ci-cd-com-testes-por-funcionalidade.md) | aceito | CI/CD e testes por funcionalidade. |

---

## Stack atual

### Aplicação

- React 18;
- TypeScript 5;
- Vite 5;
- React Router 6;
- TanStack Query 5;
- Tailwind CSS 3;
- shadcn/ui + Radix.

### Backend

- Supabase/Lovable Cloud;
- Postgres, Auth, RLS, Storage e Edge Functions Deno;
- Meta WhatsApp Cloud API.

### Qualidade

- ESLint;
- TypeScript sem emissão;
- Vitest + Testing Library;
- cobertura V8;
- Playwright Chromium;
- GitHub Actions.

---

## Estrutura relevante

```text
.
├── .github/workflows/ci-cd.yml
├── CONTEXT.md
├── AGENTS.md
├── docs/
│   ├── architecture.md
│   ├── testing-and-ci.md
│   ├── risks.md
│   ├── domain/
│   ├── adr/
│   └── issue-tracker/
├── scripts/ci/
├── src/
│   ├── pages/
│   ├── features/
│   ├── components/
│   ├── lib/
│   ├── test/unit/
│   └── integrations/supabase/   # gerado; não editar manualmente
├── tests/
│   ├── e2e/
│   └── test-matrix.json
├── supabase/
│   ├── functions/
│   └── migrations/
├── playwright.config.ts
├── vitest.config.ts
└── package.json
```

---

## Rodando localmente

Pré-requisito: Node.js 22 LTS.

```bash
npm install --no-audit --no-fund --legacy-peer-deps
npx playwright install chromium
npm run dev
```

Qualidade:

```bash
npm run ci:governance
npm run ci:test-map
npm run lint
npm run typecheck
npm run test:unit
npm run test:coverage
npm run build
npm run test:e2e
```

Pipeline local completa:

```bash
npm run test:ci
```

O repositório ainda possui `bun.lockb`; a CI usa `npm install` até a equipe
regenerar e versionar um lockfile congelável atualizado.

---

## CI/CD

`.github/workflows/ci-cd.yml` executa em:

- qualquer PR, entre quaisquer branches;
- push na `main`;
- execução manual.

Jobs:

- governança e test matrix;
- lint/typecheck;
- unitários por funcionalidade;
- cobertura;
- build;
- E2E público, institucional, superadmin e legado;
- Quality gate;
- artifact validado da `main`.

O Actions não usa dados/secrets reais nos testes de PR. O deploy efetivo
continua no Lovable; a pipeline produz o bundle validado e manifesto.

---

## Variáveis e segredos

`VITE_SUPABASE_*` são valores públicos/gerenciados conforme o contrato do
Supabase. Token Meta, app secret, verify token, service role e segredo do runner
vivem apenas no ambiente das edge functions.

Nunca coloque segredo ou dado clínico real em código, issue, fixture, log,
trace, screenshot, vídeo ou documentação.

---

## Questões ainda não decididas

Veja [`docs/domain/open-questions.md`](./docs/domain/open-questions.md):

- vertical de Chagas versus núcleo genérico;
- fronteira clínica;
- autorização do contato versus opt-in da identidade;
- telefone compartilhado;
- pausa, versão e handoff de jornadas;
- tenancy da biblioteca;
- ambiente protegido para testes reais de Supabase/Meta.