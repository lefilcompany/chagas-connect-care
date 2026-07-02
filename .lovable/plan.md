
# Fase 6 — Utilização e envio de template aprovado

Fatia vertical: usuário abre `/app/modelos`, aciona "Usar modelo" em um template `approved`, preenche variáveis, envia, e vê o WAMID salvo com status `sent`. Modelos fora de `approved` são bloqueados em UI e backend.

## O que já existe (reutilizar)

- `UseTemplateDialog` completo (destinatário / variáveis / preview / envio).
- `queueAndSendFromTemplate` → insere `messages` em `queued` e chama `send-whatsapp`.
- `send-whatsapp/index.ts` já valida `meta_status === approved`, `meta_template_name`, opt-out, e persiste o WAMID retornado pela Meta (fluxo `sent` → webhook `delivered`/`read`).
- Coluna `meta_body_parameter_order` já existe em `message_templates` (grava no editor); coluna legada `meta_parameter_order` ainda é lida no backend.
- `TemplateCard` catálogo com prop `onUse` e `useDisabledReason` já suporta os textos por status.

## Lacunas cobertas nesta fase

1. `/app/modelos` não abre o dialog — `onUse` está vazio.
2. Backend lê a coluna legada `meta_parameter_order`; precisa passar a usar exclusivamente `meta_body_parameter_order`.
3. Faltam guards: `meta_has_local_differences`, `meta_definition` ausente, `meta_language` ausente, template de outra instituição, canal inativo, WABA divergente, Phone Number ID divergente.
4. Não há builder puro reutilizável nem testável isoladamente.
5. Media de header não valida que o `meta_media_id` pertence ao canal/WABA corrente.

## Entregas

### 1. Builder puro `buildApprovedTemplateMessage`

Novo arquivo `supabase/functions/_shared/approvedTemplatePayload.ts` exportando:

```ts
buildApprovedTemplateMessage(input): { ok: true; payload } | { ok: false; errorCode; error }
```

Entrada:
- `template` sincronizado (`meta_template_name`, `meta_language`, `meta_status`, `meta_has_local_differences`, `meta_definition`, `meta_header_type`, `meta_body_parameter_order`, `meta_buttons`, `meta_carousel_cards`, `institution`, `waba_id`).
- `to` (E.164 já normalizado).
- `variables` semânticas (`Record<string,string>`).
- `header` opcional (`{ format, media_id }` para IMAGE/VIDEO/DOCUMENT; nunca aceita `header_handle`).
- `buttons` runtime já normalizados.

Regras internas:
- Rejeita se `meta_status !== "approved"` → `TEMPLATE_NOT_APPROVED`.
- Rejeita se `meta_has_local_differences === true` → `TEMPLATE_LOCAL_DIFFERENCES`.
- Rejeita se `meta_definition` ausente → `TEMPLATE_DEFINITION_MISSING`.
- Rejeita se `meta_template_name` ausente → `TEMPLATE_NAME_MISSING`.
- Rejeita se `meta_language` ausente → `TEMPLATE_LANGUAGE_MISSING`.
- Usa exclusivamente `meta_body_parameter_order` para BODY; se `{{n}}` existe e a ordem está vazia → `TEMPLATE_PARAMETER_ORDER_MISSING`. Variável ausente/placeholder → `TEMPLATE_PARAMETER_MISSING`.
- Para header IMAGE/VIDEO/DOCUMENT usa `{ id: media_id }` (nunca `header_handle`). Sem `media_id` → `MEDIA_NOT_UPLOADED`.
- Não faz `fetch`; recebe tudo já resolvido.

### 2. Refactor de `send-whatsapp/index.ts`

- Alterar o `SELECT` do template para incluir `meta_language, meta_has_local_differences, meta_definition, meta_body_parameter_order, waba_id, institution` e remover leitura de `meta_parameter_order`.
- Delegar montagem do payload de template (não-auth, não-carrossel) para o builder novo. Manter os fluxos AUTHENTICATION e CAROUSEL onde estão (fora do escopo da fatia).
- Adicionar guards antes da chamada Meta:
  - `template.institution !== msg.institution` → `TEMPLATE_INSTITUTION_MISMATCH`.
  - canal (`institution_whatsapp_settings`) inativo → `WHATSAPP_CHANNEL_INACTIVE`.
  - `template.waba_id` divergente do canal → `WHATSAPP_WABA_MISMATCH`.
  - `PHONE_NUMBER_ID` do canal divergente do secreto/resolvido → `WHATSAPP_PHONE_NUMBER_MISMATCH`.
- Para header de mídia, validar que `whatsapp_media_assets.institution` e `channel_id` combinam com o canal usado; senão `MEDIA_CHANNEL_MISMATCH`.
- Persistir `external_message_id` (WAMID) já é feito — cobrir por teste.

### 3. Frontend

- `MessageTemplates.tsx`: passar a abrir `UseTemplateDialog` no `onUse` (`useState<MessageTemplate | null>` + estado `useOpen`, seguindo padrão de `Content.tsx`). Botão só aparece para `template_kind === "internal"` ou `template_kind === "meta" && meta_status === "approved"`; para os demais status `useDisabledReason` continua exibido, mostrando:
  - `submitted` → "Aguardando análise da Meta."
  - `rejected` → "Rejeitado — ver motivo no editor."
  - `paused` / `disabled` → "Indisponível."
  - `not_submitted` → "Ainda não submetido."
- `TemplateCard` catálogo: passar a esconder o botão "Usar modelo" quando `disabledReason` está setado (hoje ele fica visível cinza — manter comportamento visual, apenas garantir `disabled`).
- Nenhuma mudança em `UseTemplateDialog` além de propagar novos `error_code` que o backend passar a retornar (já são exibidos por `friendlyWhatsAppError`, adicionar as novas chaves ali).

### 4. Migração de dados (não schema)

- Nada de DDL nesta fase. Apenas parar de ler `meta_parameter_order` no backend. Coluna legada permanece no banco (limpeza é fora de escopo).

## TDD — ordem

Ciclo 1 (RED → GREEN mínimo):
- `supabase/functions/_shared/approvedTemplatePayload.test.ts`: template `approved` + variáveis válidas → payload BODY correto.
- `supabase/functions/send-whatsapp/handler.test.ts` (novo, se ainda não existe): stub Meta retornando `wamid.xxx` → mensagem fica `sent` e `external_message_id === "wamid.xxx"`.
- `src/pages/app/MessageTemplates.useDialog.test.tsx`: clicar "Usar modelo" em template `approved` abre o dialog; em `submitted`/`rejected` o botão está desabilitado e mostra o motivo.

Ciclos seguintes (um teste por ciclo):
- builder bloqueia `submitted`, `rejected`, `meta_has_local_differences`, `meta_definition` ausente, `meta_body_parameter_order` vazio com `{{n}}`, variável ausente.
- send-whatsapp bloqueia template de outra instituição, canal inativo, WABA divergente, Phone Number ID divergente, opt-out, telefone inválido (regras já existentes cobertas com teste).
- header IMAGE usa `{ id: media_id }` e nunca `header_handle`; `MEDIA_CHANNEL_MISMATCH` quando `whatsapp_media_assets` não bate com canal.
- webhook: `delivered` e `read` avançam status; `sent → delivered → read` não regride; `failed` não sobrescreve `read`.

## Arquivos afetados

- Novo `supabase/functions/_shared/approvedTemplatePayload.ts` + `.test.ts`.
- `supabase/functions/send-whatsapp/index.ts` (SELECT, delegação ao builder, novos guards).
- Novo `supabase/functions/send-whatsapp/guards.test.ts` (Deno) — cobrindo os novos error codes.
- `src/pages/app/MessageTemplates.tsx` (wire do dialog).
- `src/components/app/messages/TemplateCard.tsx` (garantir `disabled` no botão do catálogo).
- `src/lib/whatsapp.ts` (`friendlyWhatsAppError` — mensagens dos novos códigos).
- Novo `src/pages/app/MessageTemplates.useDialog.test.tsx`.

## Fora do escopo (parar antes)

- Sem novo webhook (usa o existente).
- Sem alteração no envio de mensagens livres (não-template).
- Sem migração/limpeza de `meta_parameter_order`.
- Sem tocar em fluxo AUTHENTICATION nem CAROUSEL.
