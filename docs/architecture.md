# Arquitetura — Chagas Digital Care

> Documento único e denso, pensado como **onboarding técnico**. Leia
> antes `docs/CONTEXT.md` — este arquivo assume o glossário.

---

## 1. Visão geral (C4 — nível 1)

```text
                    ┌───────────────────────────┐
                    │        Superadmin         │
                    │  (opera multi-tenant)     │
                    └──────────────┬────────────┘
                                   │
┌────────────────┐   ┌─────────────▼─────────────┐   ┌─────────────────┐
│  Equipe da     │   │                           │   │  Meta WhatsApp  │
│  instituição   ├──►│  Chagas Digital Care      │◄─►│  Cloud API      │
│  (admin/equipe)│   │  (SPA + Lovable Cloud)    │   │  (Graph v25.0)  │
└────────────────┘   │                           │   └─────────────────┘
                    │  Postgres + Auth +        │
                    │  Storage + Edge Functions │
                    │                           │◄── Webhook (status,
                    └─────────────▲─────────────┘    mensagens inbound)
                                  │
                    ┌─────────────┴────────────┐
                    │  Paciente / Rede de      │
                    │  cuidado (WhatsApp, link │
                    │  público de onboarding)  │
                    └──────────────────────────┘
```

**Atores humanos:** Superadmin, Admin institucional, Equipe, Paciente,
Rede de cuidado.

**Sistemas externos:** Meta WhatsApp Cloud API, provedor de CEP.

**Núcleo:** SPA React que fala apenas com Lovable Cloud (Postgres + Auth
+ Storage + Edge Functions). Não há servidor Node próprio.

---

## 2. Módulos frontend

Organização por **feature slice** em `src/features/*`. Cada slice reúne
componentes, hooks (`useX`), tipos e utilitários de uma área do produto.

| Slice | Responsabilidade |
| --- | --- |
| `people/` | Lista, detalhe, orbit e timeline de pessoas; derivação de pendências e próxima melhor ação. |
| `journeys/` | Editor de grafo, listagem, enroll, painel de runs, catálogo de nós. |
| `inbox/` | Conversas (thread + composer + filtros + contexto). |
| `library/` | Biblioteca de conteúdo clínico com filtros e detalhe. |
| `today/` | Tela "Hoje": agenda, fila de atenção, resumo de comunicação. |
| `insights/` | Métricas de entrega e funis. |
| `audiences/` | Cartão de audiência, contagem, sentença legível. |
| `channels/` | Configuração e status de canais. |
| `meta-templates/` | Ciclo de vida de templates Meta (rascunho → aprovado). |
| `privacy/` | Auditoria, consentimento, prévia de segurança de mensagem. |

**Camadas transversais** (`src/`):

- `lib/auth.tsx`, `lib/access.tsx` — sessão + papéis + instituição.
- `lib/segments.ts`, `lib/whatsapp*.ts`, `lib/templates.ts` — regras de
  domínio reutilizáveis.
- `components/app/shell/*` — layout autenticado (sidebar, top bar).
- `components/superadmin/*` — layout paralelo do superadmin com
  `InstitutionScope`.
- `pages/` — rotas (app, superadmin, public, legal).
- `integrations/supabase/*` — **auto-gerado, não editar**.

---

## 3. Edge functions

Todas em Deno, expostas em `/functions/v1/<nome>`. Autenticação por JWT
do chamador, exceto webhooks e o cron.

| Função | Gatilho | Dependências externas |
| --- | --- | --- |
| `send-whatsapp` | UI (envio manual) e `journey-runner`. | Meta Graph API. |
| `whatsapp-webhook` | HTTP público (Meta). | — |
| `whatsapp-diagnostics` | UI superadmin. | Meta Graph API. |
| `create-whatsapp-template` | UI (autoria de template). | Meta Graph API. |
| `sync-whatsapp-templates` | UI + cron. | Meta Graph API. |
| `upload-whatsapp-template-media` | UI (autoria de template). | Meta Graph API + Storage. |
| `upload-whatsapp-media` | UI (envio manual). | Storage. |
| `repair-whatsapp-channel` | UI superadmin. | Meta Graph API. |
| `journey-enroll` | UI e integrações. | — |
| `journey-runner` | Cron (1 min) + invocação manual. | `send-whatsapp`. |
| `process-message-batch` | Cron. | `send-whatsapp`. |
| `public-onboarding` | HTTP público (link de convite). | — |
| `create-onboarding-invite` | UI. | — |
| `delete-account` | UI. | — |

---

## 4. Modelo de dados essencial

Tabelas nucleares (colunas mostradas são o essencial; a fonte da verdade
é `src/integrations/supabase/types.ts`).

- **`institutions`** — tenants.
- **`profiles`** — dados do usuário autenticado + `institution`. **Não**
  guarda papéis.
- **`user_roles`** — (`user_id`, `role`) com enum `app_role`.
- **`patients`** — pessoas sob cuidado (`institution`, `stage`, `phone`,
  `channel_pref`, `owner_id`, ...).
- **`care_network_contacts`** — rede ao redor do paciente
  (`patient_id`, `relation`, `authorization_status`,
  `receives_reminders`).
- **`messages`** — mensagens `inbound`/`outbound` por `channel`, com
  `status` (`queued`, `sent`, `delivered`, `read`, `failed`).
- **`templates`** — templates WhatsApp locais espelhando o Meta.
- **`content_library`** — conteúdo clínico reutilizável.
- **`audiences`** — coortes dinâmicas com `targeting_mode`.
- **`journeys`** — grafo (JSON em `graph.columns[].nodes[]`) + status.
- **`journey_runs`** — instâncias por paciente com `current_node_id`,
  `resume_at`, `attempt`, `context`.
- **`journey_run_steps`** — histórico de execução de nós.
- **`journey_tasks`** — tarefas humanas geradas pelo nó `criar-tarefa`.

**Regra transversal:** toda tabela operacional tem coluna `institution`
e políticas RLS que usam `get_user_institution(auth.uid())` ou
`has_role(auth.uid(), 'superadmin')`.

---

## 5. Fluxos críticos

### 5.1 Envio de WhatsApp

```text
UI (Inbox/Composer)
   │  insere row em `messages` (status=queued)
   ▼
Edge `send-whatsapp`
   │  monta payload (template ou texto)
   │  chama Meta Graph API
   ▼
Meta WhatsApp Cloud
   │  entrega → dispositivo do paciente
   │  status callbacks
   ▼
Edge `whatsapp-webhook`
   │  atualiza `messages.status`
   │  se inbound → cria nova row (direction=inbound)
   ▼
UI (realtime/refetch) mostra status atualizado
```

### 5.2 Execução de jornada

```text
UI ou integração
   │  chama `journey-enroll(patient_id, journey_id)`
   ▼
`journey_runs` (status=queued, current_node_id=null)
   ▼
Cron 1 min → `journey-runner`
   │  seleciona batch (queued/running/waiting com resume_at<=now)
   │  para cada run:
   │    - resolve próximo nó
   │    - executa handler por `kind`
   │    - grava `journey_run_steps`
   │    - atualiza status/resume_at
   ▼
Nós terminais: completed | failed | stopped | handoff
```

### 5.3 Onboarding público

```text
Admin/Equipe
   │  cria convite (`create-onboarding-invite`) → link com token
   ▼
Paciente/família
   │  abre link → `pages/public/OnboardingForm.tsx`
   │  POST → `public-onboarding`
   ▼
Edge `public-onboarding`
   │  valida token
   │  cria/atualiza `patients` + `care_network_contacts`
   │  registra consentimento
   ▼
Instituição vê nova pessoa em People / Today
```

---

## 6. Matriz de permissões

| Recurso | Superadmin | Admin (mesma instituição) | Equipe (mesma instituição) | Outra instituição |
| --- | --- | --- | --- | --- |
| Ver/editar pacientes | ✅ | ✅ | ✅ | ❌ |
| Configurar WhatsApp | ✅ (qualquer) | ✅ | ❌ | ❌ |
| Criar/editar jornadas | ✅ (qualquer) | ✅ | ✅ | ❌ |
| Gerir usuários da instituição | ✅ | ✅ | ❌ | ❌ |
| Gerir instituições / superadmins | ✅ | ❌ | ❌ | ❌ |
| Ver audit log | ✅ | ✅ (própria) | ❌ | ❌ |
| Enviar mensagem via Inbox | ✅ | ✅ | ✅ | ❌ |

A checagem é feita por **RLS no banco** (via `has_role` +
`get_user_institution`), não apenas por UI. Nunca confie só no cliente.

---

## 7. Deploy e ambientes

- **Preview Lovable** — cada mudança gera preview URL.
- **Published Lovable** — versão de produção.
- **Banco / Auth / Storage** — Lovable Cloud (Supabase gerenciado).
- **Edge functions** — implantadas pela plataforma a partir de
  `supabase/functions/`.
- **Cron do `journey-runner`** — a cada 1 min; requer `JOURNEY_RUNNER_SECRET`.
- **Bucket `whatsapp-media`** — privado; políticas escopadas por
  instituição via `storage.foldername(name)[1]`.

---

## 8. Riscos conhecidos e dívidas

> Esta seção é intencionalmente um placeholder para o time preencher à
> medida que a experiência com o sistema em produção revelar pontos de
> atrito. Toda entrada deve linkar para o issue correspondente em
> `docs/issue-tracker/`.

- _(a preencher pelo time)_
