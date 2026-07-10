# Arquitetura — Chagas Digital Care

> Onboarding técnico denso. Leia antes `CONTEXT.md` (domínio) e
> `AGENTS.md` (papéis). Este documento é a **fonte da verdade** para
> contratos de edge function, matriz RLS e ficha de tabelas nucleares.

Sumário:

1. Visão C4 nível 1
2. Módulos frontend (por slice)
3. Edge functions — contrato formal
4. Modelo de dados (buckets + fichas nucleares)
5. Catálogo de helpers `SECURITY DEFINER`
6. Fluxos críticos (ASCII)
7. Matriz de permissões
8. Deploy, cron, storage
9. Riscos e dívidas

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
                    ┌─────────────┴────────────┐   ┌─────────────────┐
                    │  Paciente / Rede de      │   │  Assistente     │
                    │  cuidado (WhatsApp, link │   │  externo (MCP,  │
                    │  público de onboarding)  │   │  OAuth 2.1)     │
                    └──────────────────────────┘   └────────┬────────┘
                                                            │
                                             consome → edge `mcp`
```

**Atores humanos:** Superadmin, Admin institucional, Equipe, Paciente,
Rede de cuidado.

**Sistemas externos:** Meta WhatsApp Cloud API, provedor de CEP,
assistentes externos (via MCP).

**Núcleo:** SPA React que fala apenas com Lovable Cloud (Postgres +
Auth + Storage + Edge Functions). Não há servidor Node próprio.

---

## 2. Módulos frontend

Organização por **feature slice** em `src/features/*`. Cada slice reúne
componentes, hooks (`useX`), tipos e utilitários de uma área.

| Slice | Responsabilidade | Tabelas primárias |
| --- | --- | --- |
| `people/` | Lista, detalhe, orbit, timeline; derivação de pendências e próxima melhor ação. | `patients`, `contacts`, `messages`, `adherence_events`, `medications` |
| `journeys/` | Editor de grafo, listagem, enroll, painel de runs, catálogo de nós. | `journeys`, `journey_runs`, `journey_run_steps`, `journey_tasks` |
| `inbox/` | Conversas (thread + composer + filtros + contexto). | `messages`, `whatsapp_conversations`, `quick_replies` |
| `library/` | Biblioteca de conteúdo clínico com filtros e detalhe. | `content_library`, `content_folders` |
| `today/` | Tela "Hoje": agenda, fila de atenção, resumo de comunicação. | `messages`, `patients`, `message_templates` (derivado) |
| `insights/` | Métricas de entrega e funis. | `messages`, `message_batches` |
| `audiences/` | Cartão de audiência, contagem, sentença legível. | `audience_segments`, `patients` |
| `channels/` | Configuração e status de canais. | `whatsapp_channels`, `whatsapp_identities`, `institution_whatsapp_settings` |
| `meta-templates/` | Ciclo de vida de templates Meta (rascunho → aprovado). | `message_templates`, `whatsapp_template_submissions`, `whatsapp_template_events`, `whatsapp_template_header_media` |
| `privacy/` | Auditoria, consentimento, prévia de segurança de mensagem. | `contacts`, `whatsapp_admin_audit_log` |

**Camadas transversais** (`src/`):

- `lib/auth.tsx`, `lib/access.tsx` — sessão + papéis + instituição.
- `lib/segments.ts`, `lib/whatsapp*.ts`, `lib/templates.ts` — regras
  de domínio reutilizáveis.
- `lib/mcp/*` — servidor MCP (bundle em `supabase/functions/mcp/`).
- `components/app/shell/*` — layout autenticado (sidebar, top bar).
- `components/superadmin/*` — layout paralelo do superadmin com
  `InstitutionScope`.
- `pages/` — rotas (app, superadmin, public, legal).
- `integrations/supabase/*` — **auto-gerado, não editar**.

---

## 3. Edge functions — contrato formal

Convenções gerais:

- Todas em Deno, expostas em `POST https://<project>.functions.supabase.co/<nome>`
  (o dev usa `/functions/v1/<nome>` proxy).
- **Auth padrão:** JWT do chamador em `Authorization: Bearer <token>`
  (obtido do cliente Supabase). Exceções: `whatsapp-webhook` (assinatura
  HMAC), `public-onboarding` (token de convite), `journey-runner`
  (secret ou JWT), `mcp` (OAuth 2.1).
- **Envelope de erro padrão:** `{ error: string, code?: string, details?: unknown }`
  com HTTP 4xx/5xx apropriado. Sucesso: `{ ok: true, ... }` ou payload
  direto quando indicado.
- Todas fazem CORS: preflight `OPTIONS` responde 204 com headers
  padrão.
- Envs listados são **obrigatórios** salvo indicação em contrário.

### 3.1 `send-whatsapp`
- **Método/path:** `POST /send-whatsapp`
- **Auth:** JWT (usuário autenticado com acesso ao paciente destino via
  `can_access_patient`). Chamado também pelo `journey-runner` com
  `service_role`.
- **Request:**
  ```json
  {
    "message_id": "uuid",              // linha em messages já criada (status=queued)
    "template": {                       // opcional: envio via template Meta
      "name": "string",
      "language": "pt_BR",
      "components": [ /* Meta components */ ]
    },
    "text": "string",                   // opcional: mensagem livre (só se janela aberta)
    "to": "+55...",                     // E.164
    "media_asset_id": "uuid"            // opcional: whatsapp_media_assets
  }
  ```
- **Response 200:** `{ ok: true, wa_message_id: "wamid...", status: "sent" }`
- **Side-effects:** atualiza `messages` (`status`, `sent_at`,
  `wa_message_id`, `provider_error`); pode marcar
  `whatsapp_media_assets.status`; escreve em
  `whatsapp_integration_health` em falha; consulta
  `whatsapp_window_open` para bloquear texto livre fora da janela 24 h.
- **Chamadas externas:** `POST graph.facebook.com/v25.0/<phone_number_id>/messages`.
- **Códigos de erro:** `400` payload inválido; `403` sem acesso ao
  paciente; `422` janela 24 h fechada (mensagem livre); `502` erro Meta
  (com `details.meta_error`); `500` inesperado.
- **Envs:** `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`,
  `WHATSAPP_GRAPH_VERSION`, `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`,
  `WHATSAPP_TEST_MODE` (opcional), `WHATSAPP_TEST_TEMPLATE_NAME`,
  `WHATSAPP_TEST_TEMPLATE_LANGUAGE`.
- **Invariantes:** nunca envia sem `message_id` existente; nunca envia
  fora da janela sem `template`.

### 3.2 `whatsapp-webhook`
- **Método/path:** `GET /whatsapp-webhook` (verificação Meta) e
  `POST /whatsapp-webhook` (eventos).
- **Auth:** `X-Hub-Signature-256` HMAC-SHA256 com `WHATSAPP_APP_SECRET`.
- **Request GET:** query `hub.mode=subscribe`, `hub.verify_token`,
  `hub.challenge` → responde texto do challenge.
- **Request POST:** payload padrão Meta (statuses + messages).
- **Response:** 200 `{ ok: true }` sempre que a assinatura confere
  (mesmo em evento não reconhecido) — Meta re-entrega em não-200.
- **Side-effects:** atualiza `messages.status`; cria linhas
  `messages` (`direction='in'`); atualiza `whatsapp_conversations`
  (`service_window_expires_at`); grava eventos de template em
  `whatsapp_template_events`; incidentes em `whatsapp_unmatched_events`
  e `whatsapp_webhook_activity`.
- **Códigos de erro:** `401` HMAC inválido; `400` payload malformado.
- **Envs:** `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`,
  `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_DEFAULT_INSTITUTION`,
  `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- **Invariantes:** idempotente por `wa_message_id`.

### 3.3 `whatsapp-diagnostics`
- **Método/path:** `POST /whatsapp-diagnostics`
- **Auth:** JWT superadmin (`is_superadmin`).
- **Request:** `{ institution?: string, check: "phone" | "waba" | "webhook" | "all" }`
- **Response:** relatório por check com `ok`, `latency_ms`,
  `meta_response`, `hints[]`.
- **Side-effects:** escreve em `whatsapp_integration_health`.
- **Chamadas externas:** múltiplos endpoints Graph API.

### 3.4 `create-whatsapp-template`
- **Método/path:** `POST /create-whatsapp-template`
- **Auth:** JWT (admin da instituição dona do `waba_id`).
- **Request:** `{ institution, template: { name, language, category, components[] }, media_handles?: { header?: string } }`
- **Response:** `{ ok: true, meta_template_id, status }`
- **Side-effects:** cria/atualiza `message_templates` (status
  `PENDING`); grava `whatsapp_template_submissions`.
- **Códigos:** `409` nome duplicado; `422` payload inválido pelo Meta.

### 3.5 `sync-whatsapp-templates`
- **Método/path:** `POST /sync-whatsapp-templates`
- **Auth:** JWT (admin) ou cron.
- **Request:** `{ institution?: string }` (vazio = todas — só superadmin).
- **Response:** `{ ok: true, updated: n, skipped: n, errors: [...] }`
- **Side-effects:** atualiza `message_templates.meta_status`,
  `meta_category`, `meta_quality_score`, timestamps.

### 3.6 `upload-whatsapp-template-media`
- **Método/path:** `POST /upload-whatsapp-template-media`
  (multipart/form-data)
- **Auth:** JWT (admin).
- **Request:** `file` + `institution`.
- **Response:** `{ ok: true, meta_handle: "4:...", storage_path }`
- **Side-effects:** upload ao bucket `whatsapp-media/<institution>/templates/`,
  cria `whatsapp_template_header_media`.

### 3.7 `upload-whatsapp-media`
- **Método/path:** `POST /upload-whatsapp-media` (multipart)
- **Auth:** JWT.
- **Request:** `file` + `patient_id`.
- **Response:** `{ ok: true, asset_id, meta_media_id, mime, size }`
- **Side-effects:** validação de MIME/tamanho conforme limites Meta;
  cria `whatsapp_media_assets` (`status='ready'`, `expires_at=+30d`);
  cron `mark_expired_whatsapp_media()` marca como `expired`.

### 3.8 `repair-whatsapp-channel`
- **Método/path:** `POST /repair-whatsapp-channel`
- **Auth:** JWT superadmin.
- **Request:** `{ institution }`
- **Response:** `{ ok: true, actions: [...] }`
- **Side-effects:** reconcilia `whatsapp_channels` e
  `whatsapp_identities` com o estado real do Meta.

### 3.9 `journey-enroll`
- **Método/path:** `POST /journey-enroll`
- **Auth:** JWT (com acesso aos pacientes via `can_access_patient`).
- **Request:** `{ journey_id, patient_ids: string[] }` **OU**
  `{ journey_id, event: string, patient_id }` (enroll por evento).
- **Response:** `{ ok: true, runs: [{ patient_id, run_id, status }] }`
- **Side-effects:** insere `journey_runs` com `status='queued'`,
  `current_node_id=null`, `attempt=0`.
- **Códigos:** `403` jornada não pertence à instituição; `409` já
  enrolado ativo e jornada não permite múltiplas.

### 3.10 `journey-runner`
- **Método/path:** `POST /journey-runner`
- **Auth:** header `x-runner-secret: <JOURNEY_RUNNER_SECRET>` (cron)
  **ou** JWT superadmin (manual).
- **Request:** `{ limit?: number, run_id?: uuid }` (default: batch 25).
- **Response:** `{ ok: true, processed: n, advanced: n, failed: n }`
- **Side-effects:** seleciona runs `queued`/`running`/`waiting` com
  `resume_at<=now`; executa handler por `kind` do nó; grava
  `journey_run_steps`; atualiza `journey_runs.status`, `attempt`,
  `resume_at`; chama `send-whatsapp` quando o nó é de comunicação;
  cria `journey_tasks` no kind `criar-tarefa`.
- **Invariantes:** backoff exponencial `[1, 5, 30]` min;
  `MAX_ATTEMPTS=3`; runs `failed` após esgotar tentativas.

### 3.11 `process-message-batch`
- **Método/path:** `POST /process-message-batch`
- **Auth:** JWT (admin/equipe) ou cron.
- **Request:** `{ batch_id: uuid }` (ou vazio = próximo devido).
- **Response:** `{ ok: true, sent: n, failed: n }`
- **Side-effects:** para cada destinatário do batch, insere `messages`
  (`status='queued'`) e chama `send-whatsapp`; concorrência `CONCURRENCY=3`;
  atualiza `message_batches.status`, `sent_count`, `failed_count`.

### 3.12 `public-onboarding`
- **Método/path:** `POST /public-onboarding` (público, sem auth).
- **Auth:** validação do `invite_token` UUID contra
  `onboarding_invites`.
- **Request:** `{ invite_token, patient: {...}, contacts?: [...], consent: {...} }`
- **Response:** `{ ok: true, patient_id }`
- **Side-effects:** cria/atualiza `patients`, `contacts`; grava
  consentimento; marca `onboarding_invites.consumed_at`.
- **Códigos:** `410` convite expirado/consumido; `422` payload inválido.

### 3.13 `create-onboarding-invite`
- **Método/path:** `POST /create-onboarding-invite`
- **Auth:** JWT (admin/equipe).
- **Request:** `{ institution?, expires_in_hours?: number, prefill?: {...} }`
- **Response:** `{ ok: true, invite_url, token, expires_at }`
- **Side-effects:** insere `onboarding_invites`.

### 3.14 `delete-account`
- **Método/path:** `POST /delete-account`
- **Auth:** JWT do próprio usuário.
- **Request:** `{ confirm: true }`
- **Response:** `{ ok: true }`
- **Side-effects:** LGPD — apaga `auth.users`, `profiles`, `user_roles`
  do chamador; reatribui/anonimiza registros em tabelas operacionais
  onde `owner_id = uid`.

### 3.15 `mcp`
- **Método/path:** `POST /mcp` (JSON-RPC MCP) + endpoints OAuth 2.1
  auxiliares (`/authorize`, `/token`, `/register`).
- **Auth:** OAuth 2.1 (bearer access token emitido pelo próprio
  servidor via consent screen em `/oauth/consent`).
- **Tools expostas** (bundle a partir de `src/lib/mcp/tools/*`):
  `whoami`, `get-patient`, `list-patients`, `list-conversations`,
  `list-journeys`.
- **Auto-gerado:** `supabase/functions/mcp/index.ts` é reescrito por
  `@lovable.dev/mcp-js`. Toda mudança acontece em `src/lib/mcp/*`;
  regenerar via `app_mcp_server--extract_mcp_manifest`.
- **Status atual:** issue aberto em
  `docs/issue-tracker/0002-mcp-oauth.md`.

---

## 4. Modelo de dados

**Regra transversal:** toda tabela operacional carrega coluna
`institution` (ou é acessada via join que a carrega) e políticas RLS
usam `get_user_institution(auth.uid())`, `has_role`, `is_superadmin` ou
`can_access_patient`. Toda `CREATE TABLE public.*` exige o combo
`GRANT + ENABLE RLS + CREATE POLICY` na **mesma** migration.

### 4.1 Classificação

- **Nucleares (17)** — ficha completa nesta seção.
  `institutions`, `profiles`, `user_roles`, `patients`, `contacts`,
  `messages`, `message_templates`, `message_batches`, `content_library`,
  `content_folders`, `audience_segments`, `journeys`, `journey_runs`,
  `journey_run_steps`, `journey_tasks`, `medications`,
  `adherence_events`.
- **Semi-nucleares WhatsApp (7)** — ficha resumida.
  `whatsapp_channels`, `whatsapp_identities`, `whatsapp_conversations`,
  `whatsapp_media_assets`, `whatsapp_template_submissions`,
  `whatsapp_template_header_media`, `institution_whatsapp_settings`.
- **Auxiliares (8)** — só linha em tabela-resumo.
  `onboarding_invites`, `quick_replies`, `crm_sync_log`,
  `whatsapp_admin_audit_log`, `whatsapp_integration_health`,
  `whatsapp_otp_codes`, `whatsapp_template_events`,
  `whatsapp_unmatched_events`, `whatsapp_webhook_activity`.

### 4.2 Ficha por tabela nuclear

Formato: **propósito · colunas nucleares · FKs · invariantes · RLS ·
GRANTs · helpers `SECURITY DEFINER` que a tocam**.

> Fonte da verdade das colunas exatas: `src/integrations/supabase/types.ts`.
> As fichas listam o essencial para revisar mudanças; colunas de
> auditoria (`created_at`, `updated_at`) ficam implícitas.

#### `institutions`
- **Propósito:** tenant. Todas as tabelas operacionais referenciam por
  `institution` (text slug).
- **Colunas:** `id`, `slug`, `display_name`, `default_footer`.
- **RLS:** SELECT autenticado (leitura ampla, sem dados sensíveis);
  INSERT/UPDATE/DELETE superadmin.
- **GRANTs:** `SELECT` para `authenticated`; `ALL` para `service_role`.

#### `profiles`
- **Propósito:** dados do usuário autenticado + instituição atribuída.
  **Não** guarda papéis.
- **Colunas:** `id (=auth.users.id)`, `full_name`, `role_label`,
  `institution`, `professional_registry`.
- **Trigger:** `handle_new_user()` insere na criação;
  `prevent_institution_self_change()` bloqueia mudança de `institution`
  por não-admin.
- **RLS:** SELECT próprio + admin/superadmin da instituição; UPDATE
  próprio (exceto `institution`); INSERT via trigger.
- **GRANTs:** `SELECT, UPDATE` para `authenticated`; `ALL` para
  `service_role`.

#### `user_roles`
- **Propósito:** papéis do usuário (enum `app_role`:
  `superadmin|admin|equipe`).
- **Colunas:** `id`, `user_id → auth.users`, `role`.
- **Invariantes:** único (user_id, role); nunca ler papéis do frontend
  sem passar por `has_role`.
- **RLS:** SELECT próprio + `is_superadmin`; INSERT/UPDATE/DELETE só
  superadmin.
- **GRANTs:** `SELECT` para `authenticated`; `ALL` para `service_role`.
  Sem `anon`.
- **Helpers:** `has_role`, `is_superadmin`.

#### `patients`
- **Propósito:** pessoa sob cuidado (o núcleo do domínio).
- **Colunas:** `id`, `institution`, `full_name`, `stage`, `phone`,
  `channel_pref`, `owner_id`, `city`, `state`, `birth_date`, `status`,
  `cpf`, `email`, `address`, `authorization_status`,
  `authorization_scope`, `authorized_at`, `authorized_by`,
  `revoked_at`.
- **Invariantes:** `institution` obrigatório; `owner_id` opcional
  (responsável clínico).
- **RLS:** SELECT/UPDATE por `institution` OU `owner_id=auth.uid()` OU
  admin; INSERT com `institution=get_user_institution(uid)`; DELETE
  admin/superadmin.
- **GRANTs:** `SELECT, INSERT, UPDATE, DELETE` `authenticated`; `ALL`
  `service_role`.
- **Helpers:** `can_access_patient` (usa esta tabela).

#### `contacts`
- **Propósito:** rede de cuidado (cuidadores, familiares). **Sinônimo
  banido no glossário:** `care_network_contacts` (nome antigo em docs;
  a tabela real é `contacts`).
- **Colunas:** `id`, `patient_id`, `full_name`, `relation`, `phone`,
  `email`, `channel_pref`, `receives_reminders`, `authorization_*`,
  `birth_date`, `cpf`, `address`, `city`, `state`, `status`.
- **RLS:** ALL via `can_access_patient(auth.uid(), patient_id)`.
- **GRANTs:** `SELECT, INSERT, UPDATE, DELETE` `authenticated`; `ALL`
  `service_role`.

#### `messages`
- **Propósito:** mensagem enviada/recebida em qualquer canal.
- **Colunas nucleares:** `id`, `institution`, `patient_id`, `channel`,
  `direction` (`in`/`out`), `status` (`queued|sent|delivered|read|failed`),
  `body`, `template_id`, `template_variables`, `wa_message_id`,
  `sent_at`, `delivered_at`, `read_at`, `failed_at`, `provider_error`,
  `media_asset_id`, `run_id` (quando gerada por jornada), `batch_id`.
- **Invariantes:** `direction='out'` sempre nasce `queued` na UI e é
  atualizada por `send-whatsapp` + `whatsapp-webhook`; `direction='in'`
  só criada por webhook.
- **RLS:** SELECT por instituição/paciente; INSERT via
  `can_access_patient`; UPDATE só `service_role` (edge functions).
- **GRANTs:** `SELECT, INSERT` `authenticated`; `ALL` `service_role`.
- **Realtime:** habilitado para inbox/thread.

#### `message_templates`
- **Propósito:** template WhatsApp local (espelha o Meta).
  **Sinônimo banido:** `templates`.
- **Colunas nucleares:** `id`, `institution`, `name`, `language`,
  `category`, `meta_status`, `meta_template_id`, `components` (JSONB),
  `variables`, `header_media_id`, `quality_score`, `submitted_at`,
  `approved_at`, `rejected_at`, `rejection_reason`.
- **Invariantes:** `(institution, name, language)` único; envio só
  quando `meta_status='approved'`.
- **RLS:** SELECT por instituição + superadmin; INSERT/UPDATE admin +
  edge functions (`service_role`); DELETE admin/superadmin.
- **GRANTs:** `SELECT, INSERT, UPDATE, DELETE` `authenticated`; `ALL`
  `service_role`.

#### `message_batches`
- **Propósito:** lote de mensagens agendado para uma coorte.
- **Colunas nucleares:** `id`, `institution`, `name`, `template_id`,
  `audience_segment_id`, `scheduled_for`, `status`
  (`draft|scheduled|running|done|failed|cancelled`), `sent_count`,
  `failed_count`, `created_by`, `channel`, `payload_defaults`.
- **Invariantes:** `template_id` obrigatório se `channel='whatsapp'` e
  fora da janela 24 h de cada destinatário.
- **RLS:** SELECT/INSERT/UPDATE/DELETE por instituição + admin.
- **GRANTs:** `SELECT, INSERT, UPDATE, DELETE` `authenticated`; `ALL`
  `service_role`.

#### `content_library`
- **Propósito:** cápsula de conteúdo clínico reutilizável.
- **Colunas:** `id`, `title`, `body`, `category`, `audience`,
  `targeting_mode`, `audience_types`, `segment_id`, `filters`,
  `folder_id`.
- **RLS:** SELECT autenticado (biblioteca compartilhada em leitura);
  INSERT/UPDATE/DELETE `admin`.
- **GRANTs:** `SELECT` `authenticated`; `ALL` `service_role`.
- **Nota:** admins gerenciam a curadoria; leitura ampla é intencional.

#### `content_folders`
- **Propósito:** organização hierárquica da biblioteca por instituição.
- **Colunas:** `id`, `institution`, `slug`, `label`, `description`,
  `icon`, `created_by`.
- **RLS:** ALL por instituição + admin.
- **GRANTs:** `SELECT, INSERT, UPDATE, DELETE` `authenticated`; `ALL`
  `service_role`.

#### `audience_segments`
- **Propósito:** coorte dinâmica de pacientes.
  **Sinônimo banido:** `audiences`.
- **Colunas:** `id`, `institution`, `name`, `description`,
  `audience_types` (array), `filters` (JSONB), `owner_id`.
- **RLS:** SELECT por instituição/owner/admin; INSERT com
  `institution=get_user_institution(uid)`; UPDATE por instituição/admin;
  DELETE owner/admin.
- **GRANTs:** `SELECT, INSERT, UPDATE, DELETE` `authenticated`; `ALL`
  `service_role`.

#### `journeys`
- **Propósito:** definição do fluxo automatizado (grafo).
- **Colunas nucleares:** `id`, `institution`, `name`, `status`
  (`rascunho|ativa|pausada|arquivada`), `trigger` (`manual|event`),
  `event_key`, `audience_segment_id`, `graph` (JSONB com
  `columns[].nodes[]`), `version`, `created_by`.
- **Invariantes:** graph válido (todo nó tem `kind` reconhecido; existe
  ao menos um `entrada`).
- **RLS:** ALL por instituição + admin.
- **GRANTs:** `SELECT, INSERT, UPDATE, DELETE` `authenticated`; `ALL`
  `service_role`.

#### `journey_runs`
- **Propósito:** instância de execução de uma jornada para um paciente.
- **Colunas nucleares:** `id`, `journey_id`, `patient_id`,
  `institution`, `status`
  (`queued|running|waiting|completed|failed|stopped|handoff`),
  `current_node_id`, `resume_at`, `attempt`, `context` (JSONB),
  `started_at`, `ended_at`, `last_error`.
- **Invariantes:** `attempt<=MAX_ATTEMPTS`; `resume_at` obrigatório em
  `waiting`; transição terminal (`completed|failed|stopped`) não volta.
- **RLS:** SELECT por instituição/paciente; INSERT via
  `journey-enroll` (service_role); UPDATE só service_role.
- **GRANTs:** `SELECT` `authenticated`; `ALL` `service_role`.

#### `journey_run_steps`
- **Propósito:** histórico de execução dos nós de um run.
- **Colunas:** `id`, `run_id`, `node_id`, `kind`, `status`,
  `started_at`, `ended_at`, `output` (JSONB), `error`.
- **RLS:** SELECT via existência do parent run acessível ao usuário.
- **GRANTs:** `SELECT` `authenticated`; `ALL` `service_role`.

#### `journey_tasks`
- **Propósito:** tarefa humana gerada por nó `criar-tarefa`.
- **Colunas:** `id`, `institution`, `patient_id`, `run_id`, `node_id`,
  `title`, `description`, `status` (`aberta|concluida|cancelada`),
  `assignee_id`, `due_at`, `completed_at`, `completed_by`.
- **RLS:** ALL por instituição + admin; assignee pode UPDATE próprio.
- **GRANTs:** `SELECT, INSERT, UPDATE, DELETE` `authenticated`; `ALL`
  `service_role`.

#### `medications`
- **Propósito:** medicamento associado a um paciente (uso contínuo ou
  período definido).
- **Colunas:** `id`, `patient_id`, `name`, `dose`, `frequency`,
  `starts_at`, `ends_at`, `notes`.
- **RLS:** ALL via `can_access_patient(auth.uid(), patient_id)`.
- **GRANTs:** `SELECT, INSERT, UPDATE, DELETE` `authenticated`; `ALL`
  `service_role`.

#### `adherence_events`
- **Propósito:** ocorrência de confirmação/recusa/omissão de dose.
- **Colunas:** `id`, `patient_id`, `medication_id`, `event_type`,
  `occurred_at`, `source` (`patient_reply|team|integration`).
- **RLS:** ALL via `can_access_patient(auth.uid(), patient_id)`.
- **GRANTs:** `SELECT, INSERT, UPDATE, DELETE` `authenticated`; `ALL`
  `service_role`.

### 4.3 Semi-nucleares WhatsApp (ficha resumida)

| Tabela | Propósito | Escopo RLS |
| --- | --- | --- |
| `whatsapp_channels` | Canais WhatsApp por instituição (metadata + status). | instituição + superadmin |
| `whatsapp_identities` | Identidades (números) e verificação. | instituição + superadmin |
| `whatsapp_conversations` | Estado da janela 24 h por identity/patient. | via `can_access_patient` |
| `whatsapp_media_assets` | Mídia enviada/recebida com TTL (Meta). | instituição + service_role |
| `whatsapp_template_submissions` | Log de submissões de template ao Meta. | admin da instituição |
| `whatsapp_template_header_media` | Handle de mídia usada em headers de template. | admin da instituição |
| `institution_whatsapp_settings` | Configuração operacional (WABA, phone_id, footer). | superadmin gerencia; instituição lê própria |

### 4.4 Auxiliares (tabela-resumo)

| Tabela | Uso | Consumidor típico |
| --- | --- | --- |
| `onboarding_invites` | Tokens de convite público. | `create-onboarding-invite`, `public-onboarding` |
| `quick_replies` | Respostas rápidas do inbox. | `inbox/` |
| `crm_sync_log` | Log de sincronização com CRM externo. | admin |
| `whatsapp_admin_audit_log` | Auditoria de ações administrativas WhatsApp. | superadmin |
| `whatsapp_integration_health` | Snapshot de saúde da integração. | `whatsapp-diagnostics` |
| `whatsapp_otp_codes` | OTP para verificação de número. | fluxo de setup de canal |
| `whatsapp_template_events` | Eventos de status de template (webhook). | `whatsapp-webhook` |
| `whatsapp_unmatched_events` | Eventos que não bateram com nenhuma entidade. | debug superadmin |
| `whatsapp_webhook_activity` | Log bruto de payloads recebidos. | debug superadmin |

---

## 5. Catálogo de helpers `SECURITY DEFINER`

Toda função em `public` com `SECURITY DEFINER` deve ter `SET search_path = public`
e ser `STABLE` quando não escreve. Nunca chame estas funções com dados
não sanitizados — elas rodam como owner.

| Função | Assinatura | Propósito | Chamada por |
| --- | --- | --- | --- |
| `has_role` | `(_user_id uuid, _role app_role) → boolean` | Verifica papel do usuário sem recursão RLS. | Toda policy que checa role |
| `is_superadmin` | `(_user_id uuid) → boolean` | Atalho para `has_role(uid, 'superadmin')`. | Policies de tabelas superadmin |
| `get_user_institution` | `(_user_id uuid) → text` | Retorna `profiles.institution` sem entrar em recursão. | Policies com escopo por instituição |
| `can_access_patient` | `(_user_id uuid, _patient_id uuid) → boolean` | Admin OU paciente na mesma instituição OU owner. | Policies de `contacts`, `messages`, `medications`, `adherence_events`, `whatsapp_conversations` |
| `whatsapp_window_open` | `(_identity_id uuid) → boolean` | Janela 24 h do WhatsApp aberta para aquela identity. | `send-whatsapp`, UI do composer |
| `mark_expired_whatsapp_media` | `() → integer` | Marca `whatsapp_media_assets.status='expired'` para TTL vencido. | Cron |
| `handle_new_user` | `() → trigger` | Cria `profiles` + role `equipe` ao criar `auth.users`. Nunca aceita `institution` do metadata (segurança). | Trigger `AFTER INSERT ON auth.users` |
| `prevent_institution_self_change` | `() → trigger` | Bloqueia usuário não-admin de mudar sua própria `institution`. | Trigger `BEFORE UPDATE ON profiles` |
| `set_updated_at` / `update_updated_at_column` | `() → trigger` | Atualiza `updated_at=now()`. | Triggers em tabelas com `updated_at` |

**Regra:** ao criar helper novo `SECURITY DEFINER`, o RLS/DB Guardian
deve adicioná-lo a esta tabela e listar toda tabela que passa a
chamá-lo.

---

## 6. Fluxos críticos

### 6.1 Envio de WhatsApp + webhook

```text
UI Inbox/Composer                           journey-runner (cron)
     │                                             │
     │ insere messages (status=queued)             │ decide nó whatsapp
     ▼                                             ▼
  ┌───────────────────────────────────────────────────────┐
  │  Edge send-whatsapp                                   │
  │   1. valida can_access_patient                        │
  │   2. checa whatsapp_window_open (se texto livre)      │
  │   3. monta payload (template ou texto)                │
  │   4. POST graph.facebook.com/v25.0/.../messages       │
  │   5. UPDATE messages (status=sent, wa_message_id)     │
  └───────────────────────────┬───────────────────────────┘
                              │
                              ▼
                     Meta WhatsApp Cloud
                              │
       ┌──────────────────────┼──────────────────────┐
       │ status callbacks     │ mensagem inbound     │ template event
       ▼                      ▼                      ▼
  ┌───────────────────────────────────────────────────────┐
  │  Edge whatsapp-webhook (HMAC verificada)              │
  │   • UPDATE messages.status (delivered|read|failed)    │
  │   • INSERT messages (direction='in')                  │
  │   • UPDATE whatsapp_conversations.service_window_...  │
  │   • INSERT whatsapp_template_events                   │
  └───────────────────────────────────────────────────────┘
                              │
                              ▼
                  UI (realtime) mostra atualização
```

### 6.2 Execução de jornada

```text
UI/Integração
     │  POST /journey-enroll { journey_id, patient_ids[] }
     ▼
  journey_runs (status=queued, current_node_id=null)
     │
     │  Cron 1 min (x-runner-secret)
     ▼
  ┌───────────────────────────────────────────────────────┐
  │  Edge journey-runner (batch 25)                       │
  │   loop por run:                                       │
  │     1. SELECT próximo nó a partir do graph            │
  │     2. despacha por kind:                             │
  │        - whatsapp/sms/email → chama send-whatsapp     │
  │        - aguardar → resume_at = now + delay,          │
  │                     status=waiting                    │
  │        - verificar-resposta → status=waiting +        │
  │                     ouvinte em messages(direction=in) │
  │        - criar-tarefa → INSERT journey_tasks          │
  │        - condicao → avalia expressão sobre context    │
  │        - encerrar → status=completed                  │
  │        - encaminhar-humano → status=handoff           │
  │     3. INSERT journey_run_steps                       │
  │     4. UPDATE journey_runs (status, attempt, ...)     │
  │   backoff: [1, 5, 30] min, MAX_ATTEMPTS=3             │
  └───────────────────────────────────────────────────────┘
```

### 6.3 Onboarding público

```text
Admin/Equipe
     │  POST /create-onboarding-invite
     ▼
  onboarding_invites (token, expires_at)  →  link enviado
     │
     ▼
Paciente/família abre link → pages/public/OnboardingForm.tsx
     │  POST /public-onboarding { invite_token, patient, contacts, consent }
     ▼
  Edge public-onboarding
   • valida token (não expirado, não consumido)
   • UPSERT patients (com institution do invite)
   • INSERT contacts vinculados
   • grava consentimento (authorization_status='granted')
   • UPDATE onboarding_invites.consumed_at
     │
     ▼
  Nova pessoa aparece em People / Today da instituição
```

### 6.4 OAuth do MCP

```text
Assistente externo (cliente MCP)
     │  POST /mcp/register (dynamic client registration, opcional)
     ▼
  edge mcp responde { client_id, client_secret }
     │
     │  redirect → GET /oauth/authorize?client_id=&redirect_uri=&code_challenge=
     ▼
  SPA (/oauth/consent) — usuário loga (Supabase Auth) e aprova escopos
     │
     │  callback → redirect_uri?code=...
     ▼
  Assistente troca code por token:
     POST /mcp/token { grant_type=authorization_code, code, code_verifier }
     │
     ▼
  Assistente chama tools MCP:
     POST /mcp   Authorization: Bearer <token>
     • whoami, get-patient, list-patients, list-conversations, list-journeys
```

---

## 7. Matriz de permissões

Consolidada. **A checagem real está no banco (RLS)** via `has_role` +
`get_user_institution` + `can_access_patient`; UI só espelha.

| Recurso | Superadmin | Admin (mesma inst.) | Equipe (mesma inst.) | Outra inst. |
| --- | --- | --- | --- | --- |
| `institutions` (leitura) | ✅ | ✅ (própria) | ✅ (própria) | ❌ |
| `institutions` (escrita) | ✅ | ❌ | ❌ | ❌ |
| `profiles` (própria) | ✅ | ✅ | ✅ (não pode mudar `institution`) | ❌ |
| `user_roles` | ✅ | ❌ | ❌ | ❌ |
| `patients` | ✅ | ✅ | ✅ (leitura ampla; escrita se owner/institution) | ❌ |
| `contacts` | ✅ | ✅ | ✅ (via `can_access_patient`) | ❌ |
| `messages` (leitura) | ✅ | ✅ | ✅ | ❌ |
| `messages` (envio) | ✅ | ✅ | ✅ | ❌ |
| `message_templates` (leitura) | ✅ | ✅ | ✅ | ❌ |
| `message_templates` (autoria) | ✅ | ✅ | ❌ | ❌ |
| `message_batches` | ✅ | ✅ | ✅ | ❌ |
| `content_library` (leitura) | ✅ | ✅ | ✅ | ✅ (leitura compartilhada intencional) |
| `content_library` (autoria) | ✅ | ✅ | ❌ | ❌ |
| `content_folders` | ✅ | ✅ | ✅ | ❌ |
| `audience_segments` | ✅ | ✅ | ✅ (owner) | ❌ |
| `journeys` (autoria) | ✅ | ✅ | ✅ | ❌ |
| `journey_runs` / `journey_run_steps` | ✅ | ✅ | ✅ | ❌ |
| `journey_tasks` | ✅ | ✅ | ✅ (assignee) | ❌ |
| `medications` / `adherence_events` | ✅ | ✅ | ✅ (via paciente) | ❌ |
| `whatsapp_*` config | ✅ | ✅ (própria via `institution_whatsapp_settings`) | ❌ | ❌ |
| `whatsapp_admin_audit_log` | ✅ | ✅ (própria) | ❌ | ❌ |
| Gerir usuários da instituição | ✅ | ✅ | ❌ | ❌ |
| Gerir instituições/superadmins | ✅ | ❌ | ❌ | ❌ |

---

## 8. Deploy, cron e storage

- **Preview Lovable** — cada mudança gera preview URL.
- **Published Lovable** — versão de produção.
- **Banco / Auth / Storage** — Lovable Cloud gerenciado.
- **Edge functions** — implantadas pela plataforma a partir de
  `supabase/functions/`.
- **Cron:**
  - `journey-runner` — cada 1 min (header `x-runner-secret`).
  - `sync-whatsapp-templates` — diário (sincronização de status).
  - `mark_expired_whatsapp_media()` — a cada 6 h (marca TTL vencido).
  - `process-message-batch` — a cada 5 min (varre batches devidos).
- **Storage:**
  - Bucket `whatsapp-media` (privado).
  - Prefixo por instituição:
    `<institution>/{messages|templates}/<uuid>.<ext>`.
  - Políticas escopadas por
    `storage.foldername(name)[1] = get_user_institution(auth.uid())`
    + `service_role` para uploaders.
- **Segredos:** ver `CONTEXT.md` §4.7.

---

## 9. Riscos conhecidos e dívidas

Placeholder para o time. Toda entrada linka para issue em
`docs/issue-tracker/`.

- **MCP OAuth** — em amadurecimento. Ver
  `docs/issue-tracker/0002-mcp-oauth.md`.
- **Sinônimos legados em docs** — histórico usava
  `care_network_contacts`, `templates`, `audiences`. Corrigidos em
  `CONTEXT.md`; procurar referências pontuais em issues antigos antes
  de reintroduzir.
- _(a preencher pelo time à medida que produção revelar atrito.)_