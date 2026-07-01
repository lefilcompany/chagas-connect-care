# Plano: Central Superadmin WhatsApp + Correções da Integração Meta

Escopo grande. Proposta de execução em 10 commits lógicos, preservando fluxos existentes (auth, RLS, isolamento por instituição, janela 24h, opt-out, monotonicidade de status, auditoria de mensagens).

## 1. Migrations e tipos (schema)

Arquivo: `supabase/migrations/<ts>_whatsapp_superadmin_and_templates.sql`

- `ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'superadmin'` (bloco DO seguro).
- `message_templates`: `ADD COLUMN IF NOT EXISTS` para
  `meta_parameter_format text`, `meta_body_parameter_order jsonb`,
  `meta_header_parameter_order jsonb`, `meta_creation_payload jsonb`,
  `meta_rejection_info jsonb`, `meta_idempotency_key text`,
  `meta_submitted_at timestamptz`, `meta_submitted_by uuid`,
  `meta_header_handle text` (distinto de `meta_media_id`).
- Migração de dados: `UPDATE ... SET meta_body_parameter_order = meta_parameter_order WHERE meta_body_parameter_order IS NULL AND meta_parameter_order IS NOT NULL` (só se coluna legada existir — bloco `IF EXISTS`).
- Detecção de duplicidades antes do índice único parcial:
  `CREATE UNIQUE INDEX IF NOT EXISTS ux_message_templates_meta_scope ON public.message_templates (institution, meta_template_name, meta_language) WHERE template_kind = 'meta'`.
  Se `SELECT` de duplicados retornar linhas, abortar a criação e gerar tabela `whatsapp_template_duplicates_review` com as linhas para revisão manual.
- Nova tabela `whatsapp_integration_health` (últimas validações por chave, resultado, timestamp, correlação).
- Nova tabela `whatsapp_admin_audit_log` (user_id, role, institution, entity, entity_id, action, before jsonb sanitizado, after jsonb sanitizado, result, error_code, correlation_id, ip, created_at).
- GRANTs completos + RLS: superadmin acesso total; admin institucional lê apenas própria instituição em audit; usuários comuns sem acesso.
- Funções auxiliares: `public.is_superadmin(_uid uuid) returns boolean` security definer.
- Idempotência de webhook de template: tabela `whatsapp_template_events` (chave `meta_template_id + event + entry_timestamp + payload_hash`).

## 2. Segurança e papel Superadmin

- `SuperadminRoute.tsx`: usa `useAuth` + query `has_role(uid,'superadmin')`. Frontend bloqueia UI, mas toda Edge Function revalida via `is_superadmin(auth.uid())`.
- RLS de `institution_whatsapp_settings`, `whatsapp_channels`, `message_templates`: adicionar policies "superadmin all".
- Nenhuma leitura direta de secrets no frontend. Novo endpoint `whatsapp-admin-secrets-status` retorna somente `{name, configured, last4?}`.

## 3. Upload de mídia (Resumable Upload API)

`supabase/functions/upload-whatsapp-template-media/index.ts`

- Multipart `file`, valida JWT + papel.
- Etapa 1: `POST /{GRAPH}/{APP_ID}/uploads?file_length&file_type&file_name` com `Authorization: Bearer {token}` → `upload session id`.
- Etapa 2: `POST /{GRAPH}/{session_id}` com `Authorization: OAuth {token}`, `file_offset: 0`, body binário → `{ h }`.
- Retorna `{ ok, handle, format, mime, size }`. Persiste em `whatsapp_media_assets` com `kind='template_header_handle'`.
- Substitui uso incorreto de `meta_header_media_url` como handle.

## 4. Criação de template + idempotência

`create-whatsapp-template/index.ts` (refactor):

- `local_template_id` obrigatório.
- Constrói payload com `parameter_format` (POSITIONAL default para legado, NAMED novo quando editor marcar).
- Chave de idempotência: `sha256(institution|local_id|name|language|normalized_payload)`. Se já existe row com mesma chave e `meta_template_id`, retorna cached.
- Valida COPY_CODE (`{type:"COPY_CODE", example:["CODE"]}`), URL https, quantidade/ordem de variáveis, tamanho de FOOTER (60), tamanhos de BODY/HEADER.
- Grava `meta_creation_payload` (payload enviado) separado de `meta_definition` (definição sincronizada).
- Após 200, dispara sync direcionado por `meta_template_id` (não copia response resumida como definição).
- Erros padronizados `{ok:false,error_code,error,meta_error:{code,error_subcode,message,type,fbtrace_id,http_status}}`.

## 5. Sincronização (paginada, escopo correto)

`sync-whatsapp-templates/index.ts` (refactor):

- Loop `paging.next` até fim.
- Requisita `parameter_format` no `fields`.
- Upsert por `(institution, meta_template_name, meta_language)`; matching por `meta_template_id` quando presente.
- Cria esqueletos locais para templates que existem apenas na Meta.
- Divergência: normalização estruturada (compara componentes semânticos, não texto vs posicional cru). Marca `meta_has_local_differences`.
- Persiste `meta_rejection_info`, `quality_score`, `meta_definition`, campos parseados existentes.

## 6. Builder puro de payload de envio

`supabase/functions/_shared/whatsapp-template-payload.ts` (novo, puro):

- Input: `{definition, semanticParams, mapping, media}` → output `{payload}|{error}`.
- Suporta POSITIONAL (usa `meta_body_parameter_order`) e NAMED (`parameter_name`).
- Header: TEXT/IMAGE/VIDEO/DOCUMENT com Media ID (não handle).
- Buttons: QUICK_REPLY, URL dinâmica, PHONE_NUMBER estático, COPY_CODE.
- `send-whatsapp/index.ts`: passa a selecionar `meta_definition`, `meta_body_parameter_order`, `meta_parameter_format`, `meta_has_local_differences`, `meta_status`. Bloqueia envio quando não aprovado/divergente/sem definição/sem mapeamento/mídia ausente.
- Padronização: usar exclusivamente `meta_body_parameter_order`.

## 7. Webhook

`whatsapp-webhook/index.ts` (extensão):

- Dispatch por `change.field` antes de acessar `metadata`.
- Handler `message_template_status_update`: independente de phone_number_id; atualiza por `meta_template_id`, fallback (WABA→institution, name, language).
- Mapeamento completo: APPROVED/PENDING/REJECTED/PAUSED/DISABLED/FLAGGED/ARCHIVED/UNARCHIVED/DELETED/PENDING_DELETION/IN_APPEAL/REINSTATED/LOCKED/LIMIT_EXCEEDED.
- Persiste `event, reason, rejection_info, categoria, id, nome, idioma, timestamp` + audit.
- Idempotência via `whatsapp_template_events`.
- Preserva monotonicidade de statuses de mensagem (guard: não rebaixar de `read` para `failed`).

## 8. Central Superadmin (frontend)

Rotas em `src/App.tsx` sob `/superadmin/whatsapp/*` protegidas por `SuperadminRoute`.

Páginas:
- `WhatsAppAdmin.tsx` (layout com tabs/subrotas + `InstitutionPicker`).
- `WhatsAppOverview.tsx` — dashboard de saúde (dados reais de novas Edge Functions `whatsapp-admin-overview`).
- `WhatsAppIntegration.tsx` — status sanitizado de secrets + ações (test token, validate WABA/PhoneID, list numbers, quality, permissions, graph version).
- `WhatsAppChannels.tsx` — CRUD de vínculo, detecção de conflito, sync.
- `WhatsAppTemplates.tsx` — lista, filtros, ações (criar, editar draft, nova versão, submeter, sync um/todos, ver payload/definição, ver divergência, corrigir mapeamento, arquivar, duplicar idioma, testar envio).
- `WhatsAppWebhook.tsx` — URL callback, estado do verify token/app secret, últimos eventos, campos inscritos (via Graph `/subscribed_apps`), logs sanitizados.
- `WhatsAppDiagnostics.tsx` — checagens listadas no prompt, cada uma retorna `{id,title,status,description,recommendation,action?,checked_at}`.
- `WhatsAppAudit.tsx` — leitura de `whatsapp_admin_audit_log` com filtros.

Componentes:
- `SuperadminRoute.tsx`, `WhatsAppHealthCard.tsx`, `SecretStatusField.tsx`, `InstitutionPicker.tsx`, `TemplateDivergenceView.tsx`, `WebhookEventLog.tsx`.

Editor existente `TemplateEditorDialog.tsx`:
- Substitui campo `meta_header_media_url` por upload real (chama nova função de resumable upload).
- Toggle POSITIONAL/NAMED explícito.
- Status/rejeição somente leitura.
- Desabilita envio quando bloqueado.

## 9. Edge Functions administrativas

Novas / ampliadas — todas validam JWT + papel + retornam erros padronizados + audit + timeout + correlation id:

- `whatsapp-admin-overview` (agrega counts + timestamps).
- `whatsapp-admin-validate-credentials` (token, WABA, PhoneID, permissions, graph version).
- `whatsapp-admin-list-numbers`.
- `whatsapp-admin-webhook-status` (consulta `/subscribed_apps`).
- `whatsapp-admin-secrets-status`.
- `whatsapp-admin-run-diagnostics` (reusa `whatsapp-diagnostics` + novas checagens).
- `whatsapp-admin-audit-write` (helper interno).
- `upload-whatsapp-template-media`.

## 10. Testes, lint, build

Unitários (`src/test` + `supabase/functions/**/*.test.ts` com Deno-compat):
- Builder: POSITIONAL, NAMED, header mídia, buttons, erros.
- Normalização e divergência.
- Validação de componentes/COPY_CODE/URL.
- Sanitização de secrets (nunca vazam).
- Monotonicidade de status.
- Idempotência de criação e de webhook.
- Rota Superadmin: acesso negado a admin institucional/anônimo.

Integração (fetch mockado):
- Criação (200, 400 Meta), upload resumable (2 etapas), sync com paginação >200, envio (aprovado/divergente/sem mídia), webhook (message_template_status_update sem metadata, duplicado, read→failed).

Executa `npm test`, `npm run lint`, `npm run build`; corrige regressões sem desabilitar regras.

## Notas técnicas relevantes

- **Secrets não editáveis via UI**: `WHATSAPP_*` são secrets de Edge Function; a interface mostra estado (`configured|missing|invalid|expired|last_validated_at`) e permite validar/rotacionar apenas registrando solicitação — a rotação real segue procedimento documentado (não invento integração com plataforma de deploy).
- **`header_handle` ≠ `media_id`**: campos separados no banco e no builder.
- **`meta_parameter_order` legado**: migração one-way para `meta_body_parameter_order`; código passa a ler apenas o novo campo.
- **Duplicidades pré-existentes**: migration detecta e aborta com relatório antes de criar índice único — nada é apagado silenciosamente.
- **RLS**: nenhuma policy permissiva "authenticated all"; superadmin via `is_superadmin(auth.uid())` security definer.

## Perguntas antes de iniciar

1. Confirma criar o valor `'superadmin'` no enum `app_role` existente (vs tabela separada)?
2. Existe hoje algum usuário que deva ser promovido a `superadmin` automaticamente nesta migration, ou deixo apenas o mecanismo e você atribui depois?
3. Posso remover a coluna legada `meta_parameter_order` ao final da migração de dados, ou mantenho por compatibilidade?
