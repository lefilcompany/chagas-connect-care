# Chagas Digital Care

Plataforma multi-instituição para coordenar comunicação, acompanhamento,
automações e trabalho humano ao redor da jornada de cuidado.

> Idioma oficial do produto e da documentação: **pt-BR**.

## Estado do produto

O repositório implementa, entre outras capacidades:

- pacientes e contatos da rede de cuidado;
- dados clínicos limitados para contexto e adesão;
- WhatsApp bidirecional, identidades, conversas, mídia e templates Meta;
- audiências e envios em lote;
- jornadas em grafo, execuções, passos e tarefas;
- área institucional e área de superadmin;
- backend Supabase/Lovable Cloud com RLS e Edge Functions.

SMS aparece no schema, mas deve ser tratado como capacidade parcial até validação
ponta a ponta. E-mail é visão futura e não faz parte do enum atual.

---

## Documentação canônica

Leia nesta ordem:

1. [`CONTEXT.md`](./CONTEXT.md) — propósito, fronteiras, estado atual, decisões,
   invariantes e mapa dos documentos.
2. [`AGENTS.md`](./AGENTS.md) — autonomia proporcional ao risco, fluxo de
   trabalho, segurança, validação e Definition of Done.
3. [`docs/domain/`](./docs/domain/) — glossário, modelo, consentimento, estados,
   estado atual versus alvo e perguntas abertas.
4. [`docs/architecture.md`](./docs/architecture.md) — containers, rotas, dados,
   tenancy, edge functions, fluxos, segurança e observabilidade.
5. [`docs/risks.md`](./docs/risks.md) — registro de riscos e dívidas.
6. [`docs/adr/`](./docs/adr/) — decisões arquiteturais e de processo.
7. [`docs/issue-tracker/`](./docs/issue-tracker/) — trabalho versionado em
   Markdown.

### Como interpretar afirmações

- **[ATUAL]** — comprovado pelo código/schema;
- **[DECISÃO]** — ADR aceito;
- **[ALVO]** — direção futura;
- **[HIPÓTESE]** — questão ainda não validada.

Quando houver divergência, migrations, tipos gerados e código executável têm
precedência sobre documentação desatualizada.

---

## Decisões principais

| ADR | Estado | Decisão |
| --- | --- | --- |
| [0001](./docs/adr/0001-adotar-supabase-lovable-como-backend.md) | aceito | Supabase/Lovable como backend gerenciado. |
| [0002](./docs/adr/0002-isolar-instituicoes-com-rls.md) | aceito | Isolamento multi-instituição com RLS. |
| [0003](./docs/adr/0003-armazenar-papeis-em-user-roles.md) | aceito | Papéis autorizativos em `user_roles`. |
| [0004](./docs/adr/0004-representar-jornadas-como-grafos-versionados.md) | aceito | Jornadas como grafos JSON versionados. |
| [0005](./docs/adr/0005-separar-identidade-conversa-e-pessoa-no-whatsapp.md) | aceito | Identidade, conversa, mensagem e pessoa separadas. |
| [0006](./docs/adr/0006-limitar-dados-clinicos-ao-cuidado-coordenado.md) | proposto | Limite dos dados clínicos. |
| [0007](./docs/adr/0007-manter-issue-tracker-local-em-markdown.md) | aceito | Issue tracker local em Markdown. |

---

## Stack atual

### Frontend

- React 18;
- TypeScript 5;
- Vite 5;
- React Router 6;
- TanStack Query 5;
- Tailwind CSS 3;
- shadcn/ui + Radix;
- Vitest + Testing Library.

### Backend

- Supabase/Lovable Cloud;
- Postgres;
- Supabase Auth;
- Row-Level Security;
- Storage privado;
- Edge Functions Deno;
- Meta WhatsApp Cloud API.

Detalhes e fontes: [`docs/architecture.md`](./docs/architecture.md).

---

## Estrutura relevante

```text
.
├── CONTEXT.md
├── AGENTS.md
├── README.md
├── docs/
│   ├── architecture.md
│   ├── risks.md
│   ├── domain/
│   │   ├── README.md
│   │   ├── glossary.md
│   │   ├── model.md
│   │   ├── consent-and-privacy.md
│   │   ├── state-machines.md
│   │   ├── current-vs-target.md
│   │   └── open-questions.md
│   ├── adr/
│   └── issue-tracker/
├── src/
│   ├── pages/
│   ├── features/
│   ├── components/
│   ├── lib/
│   └── integrations/supabase/   # gerado; não editar manualmente
├── supabase/
│   ├── functions/
│   └── migrations/
└── package.json
```

---

## Rodando localmente

Pré-requisitos: Node.js 18+ e Bun ou npm.

```bash
bun install        # ou npm install
bun run dev        # Vite
bun run test       # Vitest
bun run lint       # ESLint
bun run build      # build de produção
```

---

## Variáveis e segredos

Valores `VITE_SUPABASE_*` são gerenciados pela plataforma e podem ser
publicáveis conforme o contrato do Supabase. Segredos como token Meta, app
secret, verify token, service role e segredo do runner vivem somente no
ambiente das edge functions.

Nunca coloque segredo em `VITE_*`, código, issue, log ou documentação.

---

## Fluxo de contribuição

1. Leia `CONTEXT.md` e `AGENTS.md`.
2. Abra/localize o issue em `docs/issue-tracker/`.
3. Leia domínio, riscos e ADRs afetados.
4. Valide afirmações no código/schema.
5. Implemente a menor mudança completa e segura.
6. Execute e registre validações proporcionais.
7. Atualize documentação e ADRs na mesma entrega.
8. Conclua o issue e referencie-o no PR.

Mudanças em domínio, dados clínicos, consentimento, RLS, service role, estados,
integrações ou arquitetura exigem atenção especial conforme `AGENTS.md`.

---

## Questões ainda não decididas

A lista completa está em
[`docs/domain/open-questions.md`](./docs/domain/open-questions.md). Prioridades:

- posicionamento: vertical de Chagas, genérico ou núcleo + vertical;
- fronteira de dados clínicos;
- precedência entre autorização do contato e opt-in da identidade;
- telefone compartilhado;
- semântica de pausa, versão e handoff de jornadas;
- tenancy da biblioteca de conteúdo.

Essas questões não devem ser resolvidas silenciosamente por implementação.