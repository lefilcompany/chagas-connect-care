## Templates de mensagem + envio individual e segmentado

Evolução da integração WhatsApp em `/app/mensagens` com modelos reutilizáveis, envio segmentado controlado e separação clara entre **modelo interno** e **template aprovado pela Meta**.

---

### 1. Banco de dados (migração)

**`message_templates`** — modelos criados no sistema.
- Campos: `id`, `name`, `description`, `category`, `body`, `variables jsonb default '[]'`, `targeting_mode`, `audience_types text[]`, `segment_id`, `filters jsonb`, `channel default 'whatsapp'`, `template_kind default 'internal'` (`internal` | `meta`), `meta_template_name`, `meta_template_id`, `meta_language default 'pt_BR'`, `meta_category`, `meta_status default 'not_submitted'`, `institution`, `created_by`, `is_active default true`, `created_at`, `updated_at`.
- GRANTs para `authenticated` e `service_role`.
- RLS: leitura/edição por instituição (padrão dos demais `audience_segments`); admin acessa tudo.
- Trigger `set_updated_at`.

**`message_batches`** — lotes de envio segmentado.
- Campos: `id`, `template_id`, `content_id`, `name`, `body`, `targeting_mode`, `audience_types`, `segment_id`, `filters`, `channel`, `total_recipients`, `status default 'draft'`, `created_by`, `institution`, `created_at`, `started_at`, `finished_at`, `last_error`.
- GRANTs idem. RLS por instituição/owner.

**`messages` (alterações)** — adicionar somente o que falta:
- `template_id uuid`, `batch_id uuid`.
- (`external_message_id`, `provider`, `message_type`, `template_name`, `template_variables`, `queued_at`, `delivered_at`, `read_at`, `failed_at`, `last_error`, `send_attempts` já existem.)
- Ampliar `message_type` para incluir `template`, `educational`, `medication_reminder`, `campaign` (texto livre, sem CHECK).
- Índices em `template_id`, `batch_id`.

---

### 2. Edge Functions

**`send-whatsapp` (atualizar)**
- Receber `{ message_id }` (já hoje).
- Carregar `template_id` quando houver; se `template_kind = 'meta'` e `meta_status = 'approved'`, montar payload `type: "template"` com `name = meta_template_name`, `language.code`, e `components` derivados de `template_variables` da mensagem.
- Caso contrário, manter `type: "text"` com `body` atual.
- Manter atualização de `sent` / `failed` / `external_message_id` / `last_error` / `send_attempts`.

**`process-message-batch` (novo)**
- Receber `{ batch_id }`. JWT obrigatório.
- Marca lote como `processing`, busca todas as mensagens `queued` desse `batch_id`, dispara `send-whatsapp` internamente (chamando a mesma função via `fetch` com `service_role` ou refatorando a lógica de envio para função compartilhada `sendOne(messageId)` dentro de `_shared/send.ts`).
- Concorrência limitada (pool de 3) e backoff simples em 429.
- Ao final: `sent` (tudo ok), `partial_failed` (alguns falharam), `failed` (todos falharam). Preenche `finished_at` e `last_error` agregado.

**`whatsapp-webhook` (já existe)** — sem mudanças funcionais; confirma que `delivered_at` / `read_at` / `failed_at` / `last_error` são populados pelos `external_message_id`.

---

### 3. Helpers de frontend (`src/lib/whatsapp.ts`)

- Manter `queueAndSend` e `sendBatch`.
- Adicionar `queueAndSendFromTemplate({ template_id, patient_id, contact_id, variables, created_by })` — resolve `body` aplicando `{variavel}` antes de inserir e propaga `template_id`, `template_name`, `template_variables`, `message_type`.
- Adicionar `createBatch({ template_id?, content_id?, name, body, targeting, recipients, created_by })` — cria `message_batches`, insere todas as `messages` queued (com `batch_id`, `template_id`, `message_type`), invoca `process-message-batch`.
- Detector utilitário `extractVariables(body) => string[]` baseado em regex `\{([a-zA-Z0-9_]+)\}` (reuso pelo form de templates e pelo envio individual).

---

### 4. `/app/mensagens` — UI com abas

Refatorar `src/pages/app/Messages.tsx` para usar `Tabs` (`@/components/ui/tabs`) com 4 abas:

**Histórico**
- Mantém listagem atual.
- Novos filtros: por `message_type` (manual / template / educational / campaign) e por modelo (`template_id`).
- Mostra badge do tipo e do modelo quando existir; status passa a tratar `delivered` e `read` (já há mapeamento).

**Novo envio**
- Conteúdo do dialog atual transformado em painel da aba.
- Seleção de paciente + destinatário (paciente / contato).
- Modo de redação: `Texto livre` · `Modelo interno` · `Template Meta aprovado` (combo filtra `template_kind` e `meta_status`).
- Ao escolher modelo: carregar `body`, listar variáveis detectadas com `Input` por variável; preview com substituição em tempo real; botão "Editar texto" só habilitado para `internal` (Meta é fixo).
- Envia via `queueAndSendFromTemplate` ou `queueAndSend`.

**Modelos**
- Lista com busca, filtro por categoria/tipo, badge `Interno`/`Meta · status`.
- CRUD: criar, editar, **duplicar**, **arquivar** (`is_active=false`), excluir.
- Formulário: name, description, category, body (com detecção live de variáveis e preview), tipo (interno/meta), campos Meta (`meta_template_name`, `meta_language`, `meta_category`, `meta_status`) condicionais quando `template_kind=meta`.
- Bloco "Segmentação padrão" reaproveitando `SegmentFiltersForm` + `RecipientPreview` (somente leitura).
- Aviso visível: *"Modelos internos padronizam textos, mas apenas templates aprovados pela Meta podem iniciar conversas fora da janela de 24h."*

**Envio segmentado**
- Selecionar modelo (opcional) → preenche body + variáveis globais.
- Seleção de segmentação: `all` / `audiences` / `segment` / `filters` (mesmos controles de `Content.tsx`).
- `RecipientPreview` com seleção/desmarcação individual (não read-only).
- Confirmação obrigatória ("Confirmar disparo para N destinatários") antes de criar o batch.
- Ao confirmar: `createBatch` → toast com `batch_id` + link para histórico filtrado pelo lote.

---

### 5. Compatibilidade

- `Content.tsx` continua usando `sendBatch` atual; opcionalmente passa a usar `createBatch` para registrar o disparo educativo como lote (mantém comportamento, adiciona rastreio). Mudança mínima, sem refatorar UI.
- `PatientDetail.tsx` mantém envio livre via `queueAndSend`; ganha opcionalmente um seletor de modelo (fora deste escopo se preferir limitar o blast radius — fica fácil adicionar depois).
- `content_library` e `audience_segments` permanecem intocados.

---

### 6. Segurança

- `WHATSAPP_TOKEN` apenas em edge functions (já configurado).
- RLS de `message_templates` / `message_batches` por instituição + admin, mesmo padrão de `audience_segments`.
- Confirmação visual antes de qualquer envio segmentado.
- Edge functions exigem JWT do app (exceto webhook).

---

### Detalhes técnicos

```text
src/
├─ lib/
│  ├─ whatsapp.ts            (+ queueAndSendFromTemplate, createBatch, extractVariables)
│  └─ templates.ts            (helpers de render e validação Meta)
├─ pages/app/Messages.tsx     (Tabs + 4 painéis)
└─ components/app/
   ├─ messages/HistoryTab.tsx
   ├─ messages/SendTab.tsx
   ├─ messages/TemplatesTab.tsx
   └─ messages/CampaignTab.tsx

supabase/
├─ migrations/<ts>_message_templates_batches.sql
└─ functions/
   ├─ send-whatsapp/index.ts          (suporte a template Meta)
   └─ process-message-batch/index.ts  (novo)
```

### Ordem de execução

1. Migração (`message_templates`, `message_batches`, colunas `template_id`/`batch_id` em `messages`).
2. Helpers `whatsapp.ts` + `templates.ts`.
3. Edge `send-whatsapp` (template Meta) e `process-message-batch`.
4. UI: refator de `Messages.tsx` para Tabs + 4 painéis.
5. Teste e2e com número sandbox da Meta.

### Fora do escopo

- Submissão de templates à Meta a partir do app (apenas registro de status manual).
- Envio de mídia (imagem/áudio/documento).
- Janela 24h automatizada (apenas aviso textual).
- Agendamento futuro de campanhas.
