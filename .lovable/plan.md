
# Correção integral: banco, webhook e diagnóstico WhatsApp

## Diagnóstico da causa raiz

`last_webhook_at` nunca é atualizado por dois motivos combinados:

1. **Atualização fire-and-forget** em `resolveChannelInstitution` (`whatsapp-webhook/index.ts`): o `.update(...).then(()=>{},()=>{})` sem `await` permite que a Edge Function retorne `200` antes do UPDATE persistir.
2. **Canal sem `phone_number_id` correto**: quando a linha de `whatsapp_channels` da instituição não tem o `phone_number_id` da Meta (`1091284440743937`), o `eq("phone_number_id", phoneNumberId).maybeSingle()` retorna `null`, o fallback do `WHATSAPP_DEFAULT_INSTITUTION` só estampa via `.then()` (também sem await), e o diagnóstico — que olha o `last_webhook_at` mais recente *de qualquer* canal — continua nulo.

Adicionalmente, `whatsapp-diagnostics` consulta o canal globalmente (`order().limit(1)`), não filtra pela instituição do usuário, e colapsa "aguardando primeiro evento" em `nao_configurado`.

## Banco de dados (uma migration incremental)

**Tabela `whatsapp_channels`** (sem recriar):
- Índice único parcial `whatsapp_channels_phone_number_id_unique` em `(phone_number_id) WHERE phone_number_id IS NOT NULL`.
- Índice `whatsapp_channels_institution_idx` em `(institution)`.
- Coluna nova `last_internal_test_at timestamptz` (separar teste interno de evento real).
- **Não** apagar duplicados; conflitos viram estado `conflito` no diagnóstico.

**RLS de `whatsapp_channels`** (revisar):
- `SELECT`: usuário autenticado vê apenas canais da própria `institution` (via `get_user_institution(auth.uid())`).
- `INSERT`/`UPDATE`/`DELETE`: apenas `has_role(auth.uid(),'admin')` E mesma instituição.
- Frontend perde permissão de tocar `last_webhook_at` (a coluna fica restrita a `service_role` via política `WITH CHECK` que bloqueia mudanças nessa coluna por não-service-role; alternativa: revogar UPDATE direto e usar somente Edge Functions admin).

**Nova tabela `whatsapp_webhook_activity`** (auditoria técnica, sem PII):
- Campos: `id, channel_id, institution, phone_number_id, event_type, source ('meta'), received_at, processed, error_code, created_at`.
- GRANT: `SELECT` para `authenticated` (filtrado por RLS para admins da mesma instituição), `ALL` para `service_role`.
- RLS: admins veem só a própria instituição; ninguém escreve via frontend.

**Backfill seguro**: nenhuma inserção automática de canal com instituição fictícia. Migration apenas garante schema/índices/RLS.

**Filtro institucional em `message_templates`**: confirmar via RLS existente; se a consulta do frontend não filtra, ajustar no `src/pages/app/WhatsAppSettings.tsx` (filtro explícito por `institution = profile.institution`).

## Backend

### `supabase/functions/whatsapp-webhook/index.ts`

- Nova função tipada `resolveWhatsAppChannel(admin, phoneNumberId)` retornando `{ id, institution, phone_number_id } | { conflict: true } | null`. Usa `.eq("phone_number_id", phoneNumberId).eq("status","active")`, sem fuzzy match.
- Fallback `WHATSAPP_DEFAULT_INSTITUTION` mantido **apenas** quando: `phoneNumberId === ENV_PHONE_NUMBER_ID` E não existe linha conflitante E `DEFAULT_INSTITUTION` está setada. Nesse caso faz `upsert` síncrono (await) do canal e segue.
- Nova função `stampWebhookActivity(admin, channelId, eventType)` que faz `await admin.from("whatsapp_channels").update({ last_webhook_at, updated_at }).eq("id", channelId)` e insere uma linha em `whatsapp_webhook_activity` (sem corpo da mensagem, sem telefone completo — apenas `phone_number_id`).
- Chamada `await stampWebhookActivity(...)` após validar assinatura, parsear JSON e resolver canal — **uma vez por change**, válida para `messages` (qualquer tipo) e `statuses` (sent/delivered/read/failed/button/list/media).
- Eventos com remetente desconhecido continuam criando identidade `unknown` mas também estampam atividade.
- Eventos sem canal resolvido vão para `whatsapp_unmatched_events` E ainda assim registram `whatsapp_webhook_activity` com `channel_id = null` e `processed=false`.

### Nova Edge Function `supabase/functions/repair-whatsapp-channel/index.ts`

- `verify_jwt` padrão (autenticada).
- Valida JWT via `getClaims`, exige `has_role(uid,'admin')`, lê `profiles.institution`.
- Lê do ambiente: `WHATSAPP_WABA_ID`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TOKEN`, `WHATSAPP_GRAPH_VERSION`.
- Consulta Graph API para validar WABA e número (sem expor IDs).
- `upsert` em `whatsapp_channels` na instituição do admin com os IDs do ambiente; recusa se outra instituição já possuir aquele `phone_number_id` (retorna `conflict`).
- Atualiza apenas: `waba_id, phone_number_id, display_phone_number, display_name, quality_rating, status, last_synced_at, updated_at`. **Nunca** `last_webhook_at`.
- Retorno: `{ ok, channel: { configured, institution, display_phone_number (mascarado), status } }`. Nenhum token ou ID completo.

### `supabase/functions/whatsapp-diagnostics/index.ts`

- Continua exigindo admin.
- Lê `profiles.institution` do usuário e busca apenas o canal `active` daquela instituição.
- Novo estado `webhook_recent` retorna:
  - `nao_configurado` — sem canal ou canal sem `phone_number_id`.
  - `conflito` — `phone_number_id` do canal ≠ `WHATSAPP_PHONE_NUMBER_ID` do ambiente.
  - `aguardando_evento` — canal correto, `last_webhook_at` nulo.
  - `configurado` — `last_webhook_at` < 7 dias.
  - `sem_eventos_recentes` — `last_webhook_at` ≥ 7 dias.
- Novo check `subscribed_apps`: chama `/{WABA_ID}/subscribed_apps` e compara contra `META_APP_ID` quando possível; retorna apenas estado.

### `supabase/config.toml`

- Mantém `[functions.whatsapp-webhook] verify_jwt = false`. Nenhuma outra função recebe esse override.

## Frontend (`src/pages/app/WhatsAppSettings.tsx`)

- Tipo `State` ampliado: `configurado | aguardando_evento | sem_eventos_recentes | nao_configurado | conflito | desconhecido`.
- Ícones/cores distintos por estado (verde, amarelo-relógio, amarelo-alerta, vermelho, vermelho, cinza). "Aguardando evento" deixa de ser tratado como erro.
- Botão **"Corrigir vínculo do canal"** aparece para admin quando o estado for `nao_configurado` ou `conflito`. Abre `AlertDialog` com o texto pedido; ao confirmar, chama `supabase.functions.invoke('repair-whatsapp-channel')`, mostra loading, faz refetch do diagnóstico e da aba Canal.
- Aba **Canal**: mostra display name, número mascarado (`+55 81 ****-7343`), modo, status, qualidade, `last_synced_at`, `last_webhook_at`, instituição e situação do vínculo. Nenhum token/secret/Authorization.
- Lista de Templates Meta passa a filtrar `institution = profile.institution` explicitamente.

## Testes

Validar via `supabase--curl_edge_functions` e `supabase--read_query`:

- Handshake GET (token certo → 200+challenge; errado → 403).
- POST sem assinatura / assinatura inválida → 403.
- POST válido com `phone_number_id` real → 200, `last_webhook_at` populado **antes** da resposta (consultar imediatamente), linha em `whatsapp_webhook_activity`.
- POST com `phone_number_id` desconhecido → não toca canal real, registra atividade não-processada.
- Diagnóstico em cada estado (sem canal, canal sem evento, evento recente, evento antigo, conflito).
- `repair-whatsapp-channel`: usuário comum → 403; admin → 200; admin de outra instituição → não sobrescreve canal alheio.

## Deploy

Após migration aprovada e tipos regenerados, publicar:
- `whatsapp-webhook` (mantém `verify_jwt=false` via config.toml)
- `whatsapp-diagnostics`
- `repair-whatsapp-channel`

## Pós-deploy (ação do admin)

1. Enviar mensagem real de WhatsApp pessoal para **+55 81 8942-7343**.
2. Reabrir `/app/configuracoes/whatsapp` → aba Diagnóstico → "Webhook recebendo eventos" deve ficar **configurado**.
3. Se ainda estiver `nao_configurado`/`conflito`, clicar **Corrigir vínculo do canal** e repetir o teste.

## Arquivos tocados

```text
supabase/migrations/<timestamp>_whatsapp_channels_activity.sql   (novo)
supabase/functions/whatsapp-webhook/index.ts                     (refatorado)
supabase/functions/whatsapp-diagnostics/index.ts                 (refatorado)
supabase/functions/repair-whatsapp-channel/index.ts              (novo)
src/pages/app/WhatsAppSettings.tsx                               (estados + botão reparo + filtro)
```

Confirma para eu implementar?
