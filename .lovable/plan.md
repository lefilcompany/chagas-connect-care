
# Documentação do Chagas Digital Care

Criar a estrutura de documentação do projeto seguindo o entendimento consolidado:

- **Domínio central:** Jornada de cuidado do paciente
- **Issue-tracker:** markdown local, um arquivo por issue
- **ADRs:** só template + README agora (sem retroativos)
- **AGENTS.md:** "nunca decidir sozinho" + pacote base (pt-BR, leitura prévia, atualização pós-tarefa) + guard-rails técnicos (design, segurança, auto-gen) + issue-first
- **Arquitetura:** documento único e denso, servindo como onboarding

Toda a documentação em **pt-BR**.

## Estrutura de arquivos a criar

```text
docs/
├── CONTEXT.md
├── AGENTS.md
├── architecture.md
├── issue-tracker/
│   ├── README.md              # convenções: nomenclatura, frontmatter, ciclo de vida
│   ├── TEMPLATE.md            # template de novo issue
│   └── 0001-exemplo-issue.md  # 1 issue-exemplo preenchido
└── adr/
    ├── README.md              # o que é ADR, quando criar, ciclo de vida
    └── 0000-template.md       # template MADR
```

## Conteúdo de cada arquivo

### `docs/CONTEXT.md` (glossário + stack, 100% detalhado)

Estrutura:

1. **Visão do produto** — plataforma para instituições de saúde acompanharem a jornada de cuidado do paciente (entrada → engajamento → alta), com comunicação multicanal (WhatsApp/SMS/e-mail), automações (jornadas), biblioteca de conteúdo clínico e privacidade LGPD.
2. **Glossário de domínio** (núcleo: jornada do paciente) — cada termo com definição canônica e sinônimos proibidos:
   - Paciente / Pessoa (`patients`, `people`)
   - Rede de cuidado / Contato (`care_network_contacts`) — cuidador, familiar, responsável
   - Consentimento / Autorização — `authorization_status`
   - Canal / Preferência de canal — WhatsApp, SMS, e-mail
   - Pendência — o que falta para o paciente ficar "em dia" (canal válido, cuidador, consentimento)
   - Jornada (`journeys`) — grafo de nós representando fluxo automatizado
   - Nó / Coluna — unidades do grafo (`entrada`, `whatsapp`, `aguardar`, `condicao`, `encerrar`, etc.)
   - Run (`journey_runs`) — instância de execução de uma jornada para um paciente
   - Tarefa da jornada (`journey_tasks`)
   - Template Meta / WhatsApp — mensagem aprovada pelo Meta Business
   - Audiência / Segmento — coorte dinâmica de pacientes
   - Biblioteca de conteúdo (`content_library`) — cápsulas clínicas reutilizáveis
   - Inbox / Conversa — thread bidirecional
   - Instituição — tenant (isolamento por `institution` + RLS)
   - Papéis: `superadmin`, `admin` (institucional), `equipe`
   - Today / Próxima melhor ação
3. **Fronteiras do domínio** — o que NÃO é responsabilidade do produto (prontuário eletrônico, faturamento, telemedicina síncrona).
4. **Stack técnica 100% detalhada**:
   - Frontend: React 18, Vite 5, TypeScript 5, Tailwind CSS v3, shadcn/ui (Radix), TanStack Query v5, React Router, Zustand ausente (server-state é TanStack), design tokens semânticos em `src/index.css`.
   - Backend: Lovable Cloud (Supabase gerenciado) — Postgres, Auth, Storage (`whatsapp-media`), Edge Functions Deno.
   - Autorização: `user_roles` + `has_role()` SECURITY DEFINER, isolamento por `institution` via `get_user_institution()`.
   - Integrações externas: Meta WhatsApp Cloud API (Graph v25.0), CEP (endereço).
   - Edge functions ativas (lista completa a partir de `supabase/functions/`): `send-whatsapp`, `whatsapp-webhook`, `whatsapp-diagnostics`, `journey-runner`, `journey-enroll`, `process-message-batch`, `create/sync/upload-whatsapp-template`, `upload-whatsapp-media`, `repair-whatsapp-channel`, `public-onboarding`, `create-onboarding-invite`, `delete-account`.
   - Testes: Vitest + Testing Library.
   - Build/deploy: Lovable (preview + published).
5. **Convenções de código** — pt-BR nos comentários, tokens semânticos obrigatórios, sem cores hardcoded, sem edição de arquivos auto-gerados.

### `docs/AGENTS.md`

Regra-mãe destacada no topo:

> **Nunca tomar decisões automaticamente.** Diante de qualquer ambiguidade — escopo, nomenclatura, UX, modelagem, migração, política RLS, escolha de biblioteca — pare e faça perguntas objetivas antes de escrever código.

Depois, seções:

1. **Como perguntar bem** — 1 pergunta por vez, com recomendação, alternativas concretas e trade-offs.
2. **Fluxo obrigatório de trabalho:**
   - a. Ler `docs/CONTEXT.md` e o issue correspondente em `docs/issue-tracker/` antes de tocar em código.
   - b. Ler ADRs relacionados em `docs/adr/`.
   - c. Executar a tarefa.
   - d. Atualizar o issue (status, notas, decisões) e, se afetou o domínio, atualizar `CONTEXT.md`.
   - e. Se surgiu decisão arquitetural difícil de reverter → propor ADR novo.
3. **Idioma** — sempre pt-BR (respostas ao usuário, comentários novos, docs, issues, ADRs).
4. **Issue-first obrigatório** — nenhuma mudança de código sem issue correspondente em `docs/issue-tracker/`. Se não existe, criar antes.
5. **Guard-rails de design** — tokens semânticos de `src/index.css`, sem `text-white`/`bg-[#...]`, sem Inter/Poppins default, sem gradientes roxo→azul genéricos.
6. **Guard-rails de segurança** — GRANT+RLS+policies na mesma migration para tabelas em `public`; roles nunca em `profiles`; segredos nunca em `VITE_*`; `has_role()` SECURITY DEFINER para checagens.
7. **Arquivos intocáveis** — `src/integrations/supabase/client.ts`, `src/integrations/supabase/types.ts`, `supabase/config.toml`, chaves `VITE_SUPABASE_*` em `.env`.
8. **Glossário é lei** — usar exatamente os termos do `CONTEXT.md`. Termo novo → atualizar glossário na mesma tarefa.

### `docs/architecture.md` (denso, onboarding)

Seções:

1. **Visão geral (C4 nível 1)** — atores (Equipe da instituição, Superadmin, Paciente/Rede de cuidado, Meta WhatsApp) × sistemas.
2. **Módulos frontend** — mapa de `src/features/*` (people, journeys, inbox, library, today, insights, privacy, audiences, channels, meta-templates) e suas responsabilidades.
3. **Edge functions** — tabela com nome, gatilho, responsabilidade, dependências externas.
4. **Modelo de dados essencial** — tabelas nucleares (`patients`, `care_network_contacts`, `messages`, `templates`, `journeys`, `journey_runs`, `journey_run_steps`, `journey_tasks`, `content_library`, `audiences`, `user_roles`, `profiles`, `institutions`) com relações principais.
5. **Fluxos críticos** (diagramas mermaid inline):
   - Envio de WhatsApp (UI → `messages` → `send-whatsapp` → Meta → `whatsapp-webhook` → status).
   - Execução de jornada (`journey-enroll` → `journey_runs` → cron `journey-runner` → nós).
   - Onboarding público (link → `public-onboarding` → paciente + consentimento).
6. **Matriz de permissões** — superadmin × admin × equipe × RLS por instituição.
7. **Deploy e ambientes** — Lovable preview vs published, edge functions, storage bucket `whatsapp-media`, cron do journey-runner.
8. **Riscos conhecidos e dívidas** — placeholders para o time preencher.

### `docs/issue-tracker/README.md`

Define:

- **Nomenclatura:** `NNNN-slug-curto.md` (4 dígitos zero-padded, incremental).
- **Frontmatter obrigatório:**

  ```yaml
  ---
  id: 0042
  titulo: Nome curto do issue
  status: aberto | em-andamento | bloqueado | concluido | descartado
  tipo: bug | feature | chore | spike | docs
  prioridade: baixa | media | alta | critica
  criado_em: 2026-07-08
  atualizado_em: 2026-07-08
  responsavel: null
  relacionados: []
  adr: null
  ---
  ```

- **Corpo:** Contexto · O que fazer · Critérios de aceitação (checklist) · Fora de escopo · Notas.
- **Ciclo de vida** e regra: agente atualiza o próprio issue ao concluir.

### `docs/issue-tracker/TEMPLATE.md`

Cópia limpa da estrutura acima, pronta para duplicar.

### `docs/issue-tracker/0001-exemplo-issue.md`

Um issue-exemplo preenchido (ex.: "Documentar coluna Pendências da tabela de pessoas") para servir de referência viva.

### `docs/adr/README.md`

- O que é ADR (formato MADR curto).
- **Quando criar** (regra dos 3): decisão difícil de reverter · surpreendente sem contexto · resultado de trade-off real com alternativas descartadas. Se algum critério falha, não criar ADR.
- Ciclo de vida: `proposto → aceito → substituído(por NNNN) | descartado`.
- Numeração incremental `NNNN-titulo-kebab.md`.

### `docs/adr/0000-template.md`

Template MADR em pt-BR: Contexto · Decisão · Alternativas consideradas · Consequências (positivas/negativas) · Status.

## Fora de escopo desta tarefa

- Escrever ADRs retroativos (você optou por só template).
- Preencher `docs/issue-tracker/` com o backlog real (só exemplo + template).
- Criar `CONTEXT-MAP.md` (projeto é single-context).
- Alterar código de aplicação ou migrations.

## Verificação

Após aplicar o plano: listar `docs/` recursivamente e conferir que todos os 9 arquivos existem e que nenhum contém placeholder tipo "TODO" fora das seções explicitamente marcadas como "a preencher pelo time" no `architecture.md`.
