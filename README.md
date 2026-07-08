# Chagas Digital Care

Plataforma para instituições de saúde acompanharem a **jornada de
cuidado do paciente** — da entrada na rede até a alta clínica — com
comunicação multicanal (WhatsApp, SMS, e-mail), automações de jornada,
biblioteca clínica versionada, inbox unificada e rotina da equipe.

> Idioma oficial do produto e da documentação: **pt-BR**.

---

## Documentação canônica

Antes de qualquer alteração, leia — nesta ordem:

1. [`CONTEXT.md`](./CONTEXT.md) — glossário do domínio, fronteiras e
   stack técnica detalhada. **Fonte da verdade** para nomenclatura.
2. [`AGENTS.md`](./AGENTS.md) — regras de comportamento para qualquer
   agente (humano ou LLM) que edite este repositório: issue-first,
   guard-rails de design, segurança (RLS/GRANT/policies), arquivos
   intocáveis.
3. [`docs/architecture.md`](./docs/architecture.md) — visão C4 nível 1,
   módulos frontend, edge functions, modelo de dados essencial, fluxos
   críticos e matriz de permissões.
4. [`docs/issue-tracker/`](./docs/issue-tracker/) — issues locais
   versionados em Markdown (um arquivo por issue). Ver
   [README do tracker](./docs/issue-tracker/README.md).
5. [`docs/adr/`](./docs/adr/) — Architecture Decision Records (MADR
   em pt-BR). Ver [regra dos 3](./docs/adr/README.md).

---

## Stack

- **Frontend:** React 18 + TypeScript 5 + Vite 5, Tailwind CSS v3 com
  tokens semânticos em `src/index.css`, shadcn/ui (Radix), TanStack
  Query v5, React Router, Vitest + Testing Library.
- **Backend (Lovable Cloud):** Postgres com RLS em todas as tabelas de
  `public`, Auth gerenciado, Storage (bucket privado
  `whatsapp-media`), Edge Functions em Deno (`supabase/functions/*`).
- **Integrações externas:** Meta WhatsApp Cloud API (Graph v25.0),
  resolução de CEP.

Detalhes completos em [`CONTEXT.md §4`](./CONTEXT.md).

---

## Estrutura do repositório

```text
.
├── CONTEXT.md              # Glossário do domínio + stack
├── AGENTS.md               # Regras para agentes (humano ou LLM)
├── README.md               # Este arquivo
├── docs/
│   ├── architecture.md     # Onboarding técnico (C4, fluxos, permissões)
│   ├── issue-tracker/      # Issues locais (NNNN-slug.md)
│   └── adr/                # Architecture Decision Records
├── src/
│   ├── features/           # Slices por área (people, journeys, inbox, ...)
│   ├── pages/              # Rotas (app/, superadmin/, legal/, public/)
│   ├── components/         # UI compartilhada e shell da aplicação
│   ├── integrations/       # Clientes auto-gerados (NÃO editar)
│   ├── lib/                # Utilitários (auth, queries, templates, ...)
│   └── index.css           # Tokens semânticos (HSL) — única fonte de cores
├── supabase/
│   ├── functions/          # Edge functions em Deno
│   └── migrations/         # SQL versionado (GRANT + RLS + POLICY juntos)
├── public/                 # Assets estáticos
└── package.json
```

---

## Rodando localmente

Pré-requisitos: Node 18+ e [Bun](https://bun.sh) ou npm.

```bash
bun install        # ou: npm install
bun run dev        # sobe o Vite em http://localhost:8080
bun run test       # roda a suíte Vitest
bun run lint       # ESLint
bun run build      # build de produção
```

### Variáveis de ambiente

`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` e
`VITE_SUPABASE_PROJECT_ID` são **auto-gerenciados** pela Lovable Cloud
em `.env` — não edite manualmente. Segredos sensíveis (tokens Meta,
`JOURNEY_RUNNER_SECRET`, etc.) vivem **somente** no ambiente das edge
functions, nunca em `VITE_*` (ver [`AGENTS.md §6`](./AGENTS.md)).

---

## Fluxo de contribuição (resumo)

1. Leia `CONTEXT.md` e `AGENTS.md`.
2. **Issue-first:** crie/abra o issue em `docs/issue-tracker/` antes
   de escrever código.
3. Implemente respeitando os guard-rails (design tokens, RLS, papéis
   em `user_roles`, arquivos auto-gerados intocáveis).
4. Ao concluir: atualize o issue (`status`, `atualizado_em`,
   critérios de aceitação) e, se afetou o domínio, edite
   `CONTEXT.md` na mesma tarefa. Se surgiu decisão arquitetural
   difícil de reverter, proponha um ADR.

Fluxo completo em [`AGENTS.md §2`](./AGENTS.md).

---

## Deploy

Preview e versão publicada são hospedados pela Lovable. Edge functions
em `supabase/functions/` são versionadas no repositório e implantadas
pela plataforma. Migrations em `supabase/migrations/` — cada
`CREATE TABLE` em `public` **exige** `GRANT` + `ENABLE ROW LEVEL
SECURITY` + `CREATE POLICY` na **mesma** migration.
