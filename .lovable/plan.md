
# Evolução da integração WhatsApp Cloud API

Escopo: evoluir o fluxo atual sem quebrar cadastros, biblioteca de objetivos, templates Meta, mensagens, campanhas, histórico e webhook. Toda a arquitetura (React/TS/Lovable/Supabase/Edge Functions) e as RLS existentes são preservadas.

## 1. Auditoria (entregue antes das mudanças)

Diagnóstico do fluxo atual:
- `send-whatsapp` resolve telefone via `contacts.phone` ou `patients.phone`, monta payload texto, faz fallback silencioso para template `hello_world` quando `WHATSAPP_TEST_MODE=true`, usa `Object.values(template_variables)` como ordem dos parâmetros (frágil), e não valida janela de 24h nem opt-in.
- `whatsapp-webhook` valida HMAC corretamente, mas associa inbound a paciente via `ilike '%últimos 8 dígitos%'` (`findPatientByPhone`), o que é ambíguo entre múltiplos pacientes. Não trata botões/listas, não controla idempotência por `external_message_id`, e não atualiza janela de 24h.
- `process-message-batch` enfileira sem checar janela/opt-in.
- `message_templates` não tem coluna de ordem de parâmetros Meta.
- Não existem tabelas de identidade WhatsApp, conversas, opt-in, nem triagem.

## 2. Migrations (novas, incrementais, com GRANT + RLS por instituição)

Arquivo único `*_whatsapp_evolution.sql`:

- **`whatsapp_identities`**: `id, institution, patient_id?, contact_id?, recipient_type, phone_e164, wa_id?, display_name?, is_active, opt_in_status (pending|opted_in|opted_out|revoked), opt_in_at?, opt_in_source?, opt_in_notice_version?, allowed_purposes text[], opt_out_at?, created_at, updated_at`. Índices únicos parciais: `(institution, wa_id) where wa_id is not null`, `(institution, phone_e164)`. RLS por `institution = get_user_institution(auth.uid())`.
- **`whatsapp_conversations`**: `id, institution, identity_id, patient_id?, contact_id?, last_inbound_at?, service_window_expires_at?, last_outbound_at?, last_message_at?, status, timestamps`. Único por `(institution, identity_id)`.
- **`whatsapp_unmatched_events`**: `id, institution?, external_message_id, wa_id, phone_e164, event_type, received_at, status (pending|linked|ignored), linked_identity_id?, timestamps`. Sem corpo clínico.
- **`contacts`** (ALTER): `authorization_status`, `authorization_scope text[]`, `authorized_at`, `authorized_by`, `revoked_at` (apenas adicionar; default seguro para registros antigos).
- **`message_templates`** (ALTER): `meta_parameter_order jsonb default '[]'::jsonb`, `rejection_reason text`, `last_synced_at timestamptz`.
- **`messages`** (ALTER): `interaction_type text`, `interaction_id text`, `interaction_title text`, `raw_message_type text`. Índice único parcial `where external_message_id is not null and direction = 'inbound'` para idempotência de inbound; para outbound mantemos atualização por `external_message_id` sem duplicar.
- Função `public.whatsapp_window_open(_identity_id uuid)` security definer.
- Backfill: gera `phone_e164` a partir de `patients.phone`/`contacts.phone` e popula `whatsapp_identities` para registros existentes; não toca mensagens antigas.

## 3. Edge Functions

- **`send-whatsapp`** (modificado):
  - Resolve `identity` por `(institution, contact_id|patient_id)`. Sem identidade ativa → `WHATSAPP_OPT_IN_REQUIRED` ou erro de identidade.
  - Decide modo:
    - `template_id` com `template_kind='meta'`, `meta_status='approved'`, `meta_template_name`, `meta_language` definidos → envia template usando `meta_parameter_order` (ordem explícita). Valida count, ausência de placeholders, nulos.
    - Caso contrário (texto livre/objetivo interno) → exige `whatsapp_window_open`. Fora da janela → `SERVICE_WINDOW_CLOSED` (sem chamar a Meta).
  - Valida `opt_in_status='opted_in'` e, para contato, `authorization_scope` adequado ao objetivo.
  - Remove fallback automático para `hello_world` quando `WHATSAPP_TEST_MODE=false`.
  - Atualiza `whatsapp_conversations.last_outbound_at`.
  - Códigos de erro estruturados: `SERVICE_WINDOW_CLOSED`, `WHATSAPP_OPT_IN_REQUIRED`, `WHATSAPP_OPT_OUT_ACTIVE`, `PURPOSE_NOT_AUTHORIZED`, `TEMPLATE_PARAMETER_ORDER_MISSING`, `TEMPLATE_PARAMETER_MISSING`, `TEMPLATE_PARAMETER_COUNT_MISMATCH`, `TEMPLATE_NOT_APPROVED`, `TEMPLATE_NAME_MISSING`, `IDENTITY_NOT_FOUND`.
  - Logs sem token, telefone completo, conteúdo clínico ou Authorization.

- **`whatsapp-webhook`** (modificado):
  - Substitui `findPatientByPhone` por lookup em `whatsapp_identities`: 1) `(institution, wa_id)`, 2) `(institution, phone_e164)`. Como `institution` não vem no payload, busca por `wa_id`/`phone_e164` globais com unicidade já garantida e fallback para `whatsapp_unmatched_events` (status `pending`) quando não houver match.
  - Idempotência: `upsert` por `external_message_id` para inbound; status segue prioridade `queued < sent < delivered < read` e `failed` não regride sucessos.
  - Inbound abre/renova janela (`service_window_expires_at = now()+24h`).
  - Captura `interactive.button_reply` / `list_reply` / `button` em colunas dedicadas.
  - Palavras de cancelamento normalizadas (PARAR/SAIR/CANCELAR/NÃO QUERO/REMOVER) → marca `opt_in_status='opted_out'`, `opt_out_at=now()`, cancela mensagens `queued`.

- **`process-message-batch`** (modificado): antes de enfileirar, classifica cada destinatário (elegível, sem opt-in, fora da janela, número inválido, requer template). Não enfileira inelegíveis; retorna sumário. Não marca campanha como `sent` se tudo falhar.

- **`sync-whatsapp-templates`** (nova): JWT + `has_role(auth.uid(),'admin')`. Lista templates da WABA via `WHATSAPP_WABA_ID`/`WHATSAPP_GRAPH_VERSION`/`WHATSAPP_TOKEN`, faz upsert em `message_templates` (id, name, language, category, status, rejection_reason, last_synced_at). Mapeia estados Meta → internos. Sem expor secrets ao client.

`supabase/config.toml`: adiciona apenas `[functions.sync-whatsapp-templates] verify_jwt = true` se necessário (default já valida). `whatsapp-webhook` permanece `verify_jwt = false`.

## 4. Frontend

- **`src/lib/whatsapp.ts`**: helpers `normalizeToE164`, `getWindowStatus(identity, conversation)`, `formatRemaining`, mapeadores de erro → mensagens humanas em PT-BR.
- **`PatientDetail.tsx`**: badge da janela (Aberta — Xh restantes / Encerrada / Nunca iniciada), indicador de opt-in e botão para gerenciar consentimento.
- **`UseTemplateDialog.tsx`**: desabilita objetivo interno fora da janela com tooltip claro, destaca templates Meta aprovados, mostra a ordem `{{1}}…{{n}}` mapeada para variáveis internas, pré-validação de parâmetros antes de chamar `send-whatsapp`.
- **`CampaignTab.tsx`**: sumário pré-envio (selecionados, elegíveis, sem opt-in, fora da janela, telefone inválido, requer template, estimativa tarifável); bloqueia confirmar quando objetivo interno e existem destinatários fora da janela; opção “remover automaticamente inválidos”.
- **`TemplateEditorDialog.tsx`**: nova seção “Mapeamento das variáveis da Meta” (apenas para `template_kind='meta'`) com lista ordenável (subir/descer), adicionar/remover, validação de duplicidade, preview `{{1}}…{{n}}`, e botão “Sincronizar com a Meta” + exibição de `meta_status`, `last_synced_at`, `rejection_reason`. Impede marcar como `approved` manualmente quando a Meta indica outro estado.
- **`TemplateCard.tsx` / `WhatsAppPreview.tsx`**: badge do status oficial e exibição correta da variante.
- Mensagens de erro específicas (PT-BR) conforme listadas no requisito 13.

## 5. Testes / validações

- `npm run build` e `tsgo` para tipos.
- `deno check` nas 4 functions.
- Testes (vitest) para utilitários `whatsapp.ts`: normalização E.164, janela aberta/fechada, ordenação de parâmetros, validação de placeholders, mapeamento de erros.
- Teste de integração leve do webhook (mock fetch) para: duplicidade, prioridade de status, abertura de janela, palavra de cancelamento, botão/list reply, número desconhecido → `whatsapp_unmatched_events`.

## 6. Deploy

Deploy automático das functions modificadas e da nova `sync-whatsapp-templates`. Sem alteração de secrets. Sem recriação do app Meta.

## 7. Critérios de aceitação

Todos os itens do bloco 18 do pedido cobertos por código + teste, com diagnóstico, lista de arquivos, migrations, functions, telas e resultado dos testes apresentados na resposta final.

## Detalhes técnicos

- Idempotência inbound: índice único parcial em `messages(external_message_id) where direction='inbound'` (outbound pode ter `external_message_id` nulo até retorno da Meta; quando definido, único também).
- Resolução de instituição no webhook: como o payload Meta não traz `institution`, a unicidade global em `whatsapp_identities(wa_id)` e `(phone_e164)` (sem o prefixo de instituição) é necessária para roteamento; valido com índice único global parcial quando `wa_id` definido. Caso existam números compartilhados entre instituições, registra em `whatsapp_unmatched_events` para triagem manual.
- Backfill conservador: telefones sem formato reconhecível ficam com `is_active=false` e `opt_in_status='pending'`.
- Logs administrativos: somente `event`, `status`, `error_code`, `meta_error_code`, `fbtrace_id`, ids internos e `external_message_id` mascarado.
- RLS das novas tabelas: SELECT/INSERT/UPDATE/DELETE para `authenticated` filtrando por `institution = get_user_institution(auth.uid())`; `service_role` total. `whatsapp_unmatched_events` legível por `authenticated` somente quando `institution` casar (ou null para triagem global por admin).
