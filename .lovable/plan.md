## Integração WhatsApp Cloud API (Meta) — chagas-connect-care

Integração real de envio via WhatsApp Cloud API, substituindo o envio simulado. Tudo passa por Edge Functions no backend; o token da Meta nunca aparece no front-end.

### Etapa 1 — Schema: ampliar `messages`

Migration adicionando colunas (sem quebrar dados existentes):

- `external_message_id text`
- `provider text default 'meta_whatsapp_cloud'`
- `message_type text default 'manual'`
- `template_name text`
- `template_variables jsonb default '{}'::jsonb`
- `queued_at timestamptz`
- `delivered_at timestamptz`
- `read_at timestamptz`
- `failed_at timestamptz`
- `last_error text`
- `send_attempts int default 0`

Atualizar enum/check de `status` (atualmente texto livre) para aceitar: `queued`, `sent`, `delivered`, `read`, `failed`, `received`. Índice em `external_message_id` para lookup do webhook.

### Etapa 2 — Secrets

Solicitar via tool de secrets:
- `WHATSAPP_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_BUSINESS_ACCOUNT_ID`
- `WHATSAPP_VERIFY_TOKEN`

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já existem.

### Etapa 3 — Edge Function `send-whatsapp`

`supabase/functions/send-whatsapp/index.ts`

- CORS + validação JWT do chamador (`getClaims`) — só usuários autenticados disparam.
- Body: `{ message_id: string }` validado com Zod.
- Usa `service_role` internamente para ler/atualizar `messages` ignorando RLS.
- Busca a mensagem, faz JOIN lógico com `patients` e (se houver) `contacts`.
- Valida `channel === 'whatsapp'` e `status === 'queued'` (evita reenvio acidental).
- Telefone destino: `contact.phone` se houver `contact_id`, senão `patient.phone`.
- Normalização BR: remove tudo que não é dígito; garante prefixo `55`; valida tamanho 12–13 dígitos.
- Incrementa `send_attempts`.
- POST `https://graph.facebook.com/v21.0/{PHONE_NUMBER_ID}/messages` com `{ messaging_product: "whatsapp", to, type: "text", text: { body } }` e header `Authorization: Bearer {TOKEN}`.
- Sucesso → update: `status='sent'`, `sent_at=now()`, `external_message_id`, `provider='meta_whatsapp_cloud'`.
- Erro → update: `status='failed'`, `failed_at=now()`, `last_error=<mensagem Meta>`; retorna 502 com detalhe.
- Retorno tipado: `{ ok: true, external_message_id }` ou `{ ok: false, error }`.

### Etapa 4 — Edge Function `whatsapp-webhook`

`supabase/functions/whatsapp-webhook/index.ts` — config em `supabase/config.toml` com `verify_jwt = false` (webhook público da Meta).

- `GET`: handshake Meta. Lê `hub.mode`, `hub.verify_token`, `hub.challenge`. Se token bate com `WHATSAPP_VERIFY_TOKEN`, devolve `challenge` em texto puro com 200; senão 403.
- `POST`: parse do payload do Cloud API.
  - Para cada `entry[].changes[].value.statuses[]`: localiza por `external_message_id` e atualiza:
    - `delivered` → `status='delivered'`, `delivered_at=now()`
    - `read` → `status='read'`, `read_at=now()`
    - `failed` → `status='failed'`, `failed_at=now()`, `last_error=errors[0].title`
    - `sent` → mantém `status='sent'` (idempotente)
  - Para cada `entry[].changes[].value.messages[]` (inbound): normaliza `from`, tenta achar paciente por telefone (com/sem `55`), e insere `messages` com `channel='whatsapp'`, `direction='inbound'`, `body=text.body`, `status='received'`, `external_message_id=msg.id`. Se nenhum paciente bater, loga e ignora — nunca retorna 500 para a Meta (sempre 200 após processar) para evitar retries em loop.

### Etapa 5 — Front-end: fluxo novo

Helper compartilhado `src/lib/whatsapp.ts`:

```ts
queueAndSend({ patient_id, contact_id?, body, message_type? }): Promise<{ message_id, ok }>
```

Faz:
1. `insert` em `messages` com `status='queued'`, `direction='outbound'`, `channel='whatsapp'`, `queued_at=now()`, `created_by=auth.uid()`.
2. `supabase.functions.invoke('send-whatsapp', { body: { message_id }})`.
3. Retorna resultado para a UI exibir toast.

Aplicar em:

- **`src/pages/app/Messages.tsx`** — substituir o insert direto pelo helper; toast de sucesso/erro; `queryClient.invalidateQueries` para mensagens e dashboard. Reenvio (botão já existente) faz nova insert `queued` + invoke (não reusa registro antigo).
- **`src/pages/app/PatientDetail.tsx`** — mesma substituição no formulário de envio individual.
- **`src/pages/app/Content.tsx`** — envio em massa:
  - Insert em batch (uma query) de todas as mensagens com `status='queued'` e `message_type='content_broadcast'`.
  - Helper `sendBatch(message_ids)` que invoca `send-whatsapp` com **concorrência limitada (ex.: 3 em paralelo)** usando um pequeno pool — evita travar o browser e respeita rate limit da Meta.
  - Toast agregado: "X enviadas, Y falharam".

### Etapa 6 — Segurança / RLS

- Nenhuma mudança de RLS necessária: as Edge Functions usam `service_role`.
- Front-end continua respeitando RLS atual de `messages` (insert via `can_access_patient`).
- Confirmar que `WHATSAPP_TOKEN` nunca é importado em código `src/`.

### Critérios de aceite mapeados

| Critério | Onde |
|---|---|
| Envio cria `queued` | helper `queueAndSend` |
| Edge Function chama Meta | `send-whatsapp` |
| Sucesso → `sent` + `external_message_id` | `send-whatsapp` update |
| Erro → `failed` + `last_error` | `send-whatsapp` update |
| Token nunca no front | secrets only |
| Tipado + erros tratados | Zod + try/catch + tipos de retorno |
| Pronto para trocar número | só trocar `WHATSAPP_PHONE_NUMBER_ID` |

### Ordem de execução

1. Migration (`messages` colunas + índice).
2. Pedir secrets via tool (`add_secret`).
3. Criar `send-whatsapp` + deploy.
4. Criar `whatsapp-webhook` + `config.toml` + deploy. Te passo a URL pública para registrar no painel da Meta.
5. Helper `src/lib/whatsapp.ts`.
6. Refatorar `Messages.tsx`.
7. Refatorar `PatientDetail.tsx`.
8. Refatorar `Content.tsx` (com pool de concorrência).
9. Teste end-to-end com número autorizado no sandbox da Meta.

### Fora do escopo (deixar para depois)

- Templates HSM aprovados (necessário fora da janela de 24h) — estrutura `template_name`/`template_variables` já fica pronta.
- Mídia (imagem/áudio/documento).
- Retry automático com backoff (hoje: reenvio manual via UI).
- Migração para número oficial (só troca de secret).
