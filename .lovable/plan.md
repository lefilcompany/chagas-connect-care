
# Fase 4 — Aprovação, rejeição, webhook e sincronização

Vertical slice: quando a Meta atualiza um template (APPROVED/REJECTED/PAUSED/...) o webhook público recebe o evento, valida assinatura, faz dispatch por `change.field`, casa o template correto (respeitando WABA/idioma) e atualiza o registro local. O admin ainda pode disparar uma sincronização manual (`sync-whatsapp-templates`) para recuperar eventos perdidos, e a página de detalhe reflete o novo status em tempo real via Realtime, com fallback de polling só enquanto pendente.

Sem mídia. Sem novos secrets.

## Contratos (seams)

### Webhook (Meta → nossa Edge Function)
- `GET  /functions/v1/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...` — permanece como hoje, retorna challenge quando `verify_token` bate.
- `POST /functions/v1/whatsapp-webhook`
  - `verify_jwt = false`.
  - Requer `x-hub-signature-256`. HMAC-SHA-256 do corpo bruto com `WHATSAPP_APP_SECRET`, comparação timing-safe. Sem assinatura ou inválida → 403.
  - `WHATSAPP_APP_SECRET` ausente → 503 (mantém comportamento atual).
  - Sempre responde 200 depois de validado (para não gerar retry storm), exceto quando corpo não é JSON — segue devolvendo 200 (dropa silenciosamente) como hoje.

Novo dispatch por `change.field`, executado **antes** de qualquer acesso a `value.metadata`:
```ts
switch (change.field) {
  case "message_template_status_update":
    await handleTemplateStatusUpdate(deps, entry, change);
    break;
  case "messages":
    await handleMessageEvents(deps, entry, change); // fluxo atual
    break;
  default:
    await handleUnknownEvent(deps, entry, change);  // registra em whatsapp_unmatched_events
}
```

### Sincronização manual (frontend → Edge Function)
- `POST /functions/v1/sync-whatsapp-templates`
- Header `Authorization: Bearer <JWT>`
- Body **direcionado** (novo):
  ```json
  { "local_template_id": "<uuid>" }
  ```
  Alternativas aceitas:
  - `{ "institution": "Inst A" }` — superadmin escolhe a instituição.
  - `{ }` — admin sincroniza a própria instituição.
- Resposta: `{ ok, matched, updated, pages, missing_meta_ids: [] }`.
- Erros:
  - `401 UNAUTHORIZED`, `403 FORBIDDEN` (admin tentando instituição alheia), `400 WABA_NOT_CONFIGURED`, `404 TEMPLATE_NOT_FOUND` quando `local_template_id` não existe.

### Meta Graph (Edge Function → Meta)
- `GET https://graph.facebook.com/{GRAPH}/{WABA_ID}/message_templates?fields=id,name,language,status,category,components,rejected_reason,quality_score,parameter_format&limit=100`
- Paginado: percorrer `paging.next` até o final (limite defensivo de 20 páginas).
- Token: `WHATSAPP_TOKEN`. WABA resolvida a partir de `institution_whatsapp_settings.waba_id`, fallback para `WHATSAPP_WABA_ID` se não houver registro.

## Módulos novos (puros / testáveis)

### `supabase/functions/_shared/metaTemplateStatus.ts`
- Constante `META_TEMPLATE_STATUS_MAP` já mapeada (PENDING/APPROVED/REJECTED/PAUSED/DISABLED/IN_APPEAL). Nunca traduz status desconhecido para “approved”; devolve `null` e o handler mantém o estado atual.
- `payloadFingerprint(change)` — hash SHA-256 estável (`stableStringify` + entry timestamp) para idempotência.

### `supabase/functions/whatsapp-webhook/templateStatus.ts`
Handler puro (sem `Deno.serve`, sem `createClient` direto):
```ts
createTemplateStatusHandler({
  findEvent(hash): Promise<boolean>;
  recordEvent({ meta_template_id, event, entry_timestamp, payload_hash, payload }): Promise<void>;
  findTemplateByMetaId(id): Promise<TemplateMatch | null>;
  findTemplateByWabaNameLang(waba, name, lang): Promise<TemplateMatch | null>;
  findTemplateByInstitutionNameLang(institution, name, lang): Promise<TemplateMatch | null>;
  resolveInstitutionByWaba(waba): Promise<string | null>;
  updateTemplate(id, patch): Promise<void>;
  now(): Date;
})(entry, change): Promise<{ processed: boolean; reason?: string }>
```
Fluxo:
1. Extrai `waba_id = entry.id`, `event`, `message_template_id`, `message_template_name`, `message_template_language`, `reason`.
2. Calcula `payload_hash`. Se `findEvent(hash)` → `{ processed:false, reason:"duplicate" }`.
3. Casamento **nesta ordem**, curto-circuitando ao primeiro hit:
   - por `meta_template_id`;
   - por `waba_id + name + language`;
   - por `institution resolvida pela WABA + name + language`.
   Nunca casa só pelo nome.
4. Sem match → registra evento (idempotência) e `{ processed:false, reason:"unmatched" }`.
5. Guarda de integridade: se o registro casado tem `meta_language` diferente do evento, aborta com `reason:"language_mismatch"` (nunca sobrescreve). Idem para `meta_waba_id` presente e diferente do `entry.id`.
6. `updateTemplate` com:
   - `meta_status = MAP[event] ?? existing.meta_status` (nunca aprova por engano);
   - `meta_status_raw = event`;
   - `meta_rejection_reason = reason` (só quando REJECTED);
   - `meta_rejection_info = { reason, at }` idem;
   - `meta_last_webhook_at = entry.time * 1000`;
   - `meta_template_id = value.message_template_id` se estava nulo;
   - `meta_waba_id = entry.id` se estava nulo.
7. `recordEvent(payload_hash)`. Retorna `{ processed:true }`.

### `supabase/functions/sync-whatsapp-templates/handler.ts`
Extrai a lógica do Deno.serve atual e adiciona:
- `resolveScope(user, body)` — retorna `{ institution, localTemplateId? }` respeitando papel.
- `fetchAllPages(url, token)` — segue `paging.next` (máx 20).
- `matchLocalRow(page, scope)` — usa a mesma ordem do handler do webhook.
- Escreve `meta_status`, `meta_rejection_reason`, `meta_status_raw`, `meta_last_synced_at`, `meta_definition`, etc. Nunca sobrescreve `meta_language` divergente (mesmo warning).
- Quando `local_template_id` é fornecido, filtra a resposta por `t.id === template.meta_template_id` (ou name+language quando ainda não temos ID).

## Persistência

Sem novas tabelas. `whatsapp_template_events` já tem `payload_hash`, `event`, `entry_timestamp` — usados como chave única. Migration curta apenas para:
```sql
ALTER TABLE public.whatsapp_template_events
  ADD CONSTRAINT whatsapp_template_events_hash_unique UNIQUE (payload_hash);
```
para tornar o insert idempotente no nível do banco. E:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_templates;
ALTER TABLE public.message_templates REPLICA IDENTITY FULL;
```
para o Realtime da página de detalhe (RLS já filtra por institution).

## Interface

### `src/pages/app/MessageTemplateEdit.tsx`
- Painel de status abaixo do form quando `meta_status !== "not_submitted"`:
  - Badge com rótulo humano: “Em análise” / “Aprovado” / “Rejeitado” / “Pausado” / “Desativado” / “Erro”.
  - `meta_template_id`, `meta_submitted_at`, `meta_last_synced_at`, `meta_last_webhook_at` (o mais recente rotulado como “última atualização”).
  - Motivo da rejeição quando presente (`meta_rejection_reason || meta_rejection_info.reason`).
  - Botão **Atualizar status** → `service.syncFromMeta(templateId)`.
- Formulário fica readonly quando `meta_status !== "not_submitted"` (já é hoje via `isLocked`).
- Realtime: `supabase.channel("template-detail-${id}").on("postgres_changes", { schema:"public", table:"message_templates", filter:`id=eq.${id}` }, () => qc.invalidateQueries(...))` dentro de `useEffect`; cleanup no unmount.
- Polling só como fallback: quando `meta_status === "submitted"` e Realtime não abriu (`channel.state !== "joined"`), refetch a cada 20s até virar estado final; para automaticamente em approved/rejected/paused/disabled/error.

### `InstitutionTemplateService`
```ts
syncFromMeta(id: string): Promise<{ meta_status: string; meta_template_id: string|null; updated: boolean }>
```
Chama a Edge Function `sync-whatsapp-templates` com `{ local_template_id: id }` e retorna o registro atualizado.

## TDD

Ordem estrita, RED antes de GREEN. Mocks só nas fronteiras (banco/HTTP).

**Deno — status handler puro (`whatsapp-webhook/templateStatus.test.ts`):**
1. APPROVED por `meta_template_id` atualiza template → `meta_status:"approved"`, `meta_last_webhook_at` gravado.
2. REJECTED grava `meta_rejection_reason` e `meta_status:"rejected"`.
3. Evento duplicado (mesmo `payload_hash`) não chama `updateTemplate`.
4. Idioma diferente entre payload e template → não atualiza, retorna `language_mismatch`.
5. WABA diferente do `meta_waba_id` armazenado → não atualiza, retorna `waba_mismatch`.
6. Sem `meta_template_id` mas com WABA + name + language → casa e atualiza.
7. Só nome (sem WABA e sem match) → não atualiza, retorna `unmatched`.
8. Status desconhecido não vira “approved”; retorna `no_status_change`.

**Deno — dispatcher (`whatsapp-webhook/dispatch.test.ts`, novo):**
9. `field:"message_template_status_update"` chama `handleTemplateStatusUpdate` e não toca em `handleMessageEvents`.
10. `field:"messages"` sem `metadata.phone_number_id` ainda passa pelo dispatcher sem quebrar o status handler.

**Deno — signature (`whatsapp-webhook/signature.test.ts`, novo pequeno):**
11. Assinatura inválida → 403 e nenhum handler é chamado.

**Deno — sync handler (`sync-whatsapp-templates/handler.test.ts`):**
12. `local_template_id` presente atualiza somente aquele template.
13. Percorre `paging.next` até o fim (duas páginas).
14. Admin de outra instituição → 403.
15. Superadmin com `institution` alvo → 200 sincronizando aquela instituição.
16. Sem `WHATSAPP_TOKEN` ou WABA → 500/400 apropriado.

**Vitest — página de detalhe (`MessageTemplateEdit.status.test.tsx`, novo):**
17. Renderiza badge “Em análise” + botão “Atualizar status” quando `meta_status:"submitted"`.
18. Clique em “Atualizar status” chama `service.syncFromMeta(id)` e invalida a query.
19. Quando `meta_status:"rejected"` mostra o `meta_rejection_reason` retornado pelo serviço.
20. Não mostra botão “Atualizar status” em estados finais? — Sim, mostrar sempre para permitir recovery manual; teste garante que o botão continua visível também em approved/rejected.

## Detalhes técnicos

- `payload_hash = sha256(stableStringify({ waba: entry.id, event: value.event, id: value.message_template_id, name, language, time: entry.time }))`.
- `meta_rejection_reason` guarda a string enviada pela Meta. `meta_rejection_info` (jsonb) mantém `{ reason, at, event }` para auditoria.
- Nunca escrever `meta_language` do webhook sobre um valor divergente — protege contra colisão de mesmo nome em idiomas diferentes.
- `handleUnknownEvent` grava em `whatsapp_unmatched_events` com `event_type = "template:${change.field}"` para diagnóstico.
- Realtime: policy de leitura já permite a linha (RLS por institution). Nenhuma nova policy.
- Polling fallback é *client-side*, `useQuery({ refetchInterval })` só quando `meta_status === "submitted"` e Realtime não conectou; para em estado final.
- Nenhum secret novo. `WHATSAPP_APP_SECRET`, `WHATSAPP_TOKEN`, `WHATSAPP_WABA_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_GRAPH_VERSION` já configurados.

## Arquivos afetados

Novos:
- `supabase/functions/_shared/metaTemplateStatus.ts`
- `supabase/functions/whatsapp-webhook/templateStatus.ts`
- `supabase/functions/whatsapp-webhook/templateStatus.test.ts`
- `supabase/functions/whatsapp-webhook/dispatch.ts`
- `supabase/functions/whatsapp-webhook/dispatch.test.ts`
- `supabase/functions/whatsapp-webhook/signature.test.ts`
- `supabase/functions/sync-whatsapp-templates/handler.ts`
- `supabase/functions/sync-whatsapp-templates/handler.test.ts`
- `src/pages/app/MessageTemplateEdit.status.test.tsx`
- Migration `phase4_template_events_unique_and_realtime.sql` (constraint + publication + REPLICA IDENTITY).

Editados:
- `supabase/functions/whatsapp-webhook/index.ts` — passa a delegar via `dispatch(change.field)`; sem outras mudanças no fluxo de `messages`.
- `supabase/functions/sync-whatsapp-templates/index.ts` — vira wrapper fino sobre `handler.ts`.
- `src/services/institutionTemplates.ts` — adiciona `syncFromMeta`.
- `src/pages/app/MessageTemplateEdit.tsx` — painel de status + Realtime + polling fallback + botão “Atualizar status”.
- Testes existentes que mockam `InstitutionTemplateService` recebem `syncFromMeta: vi.fn(...)`.

## Critérios de aceite

- Webhook APPROVED atualiza `meta_status="approved"` no template correto (por `meta_template_id`).
- Webhook REJECTED grava `meta_rejection_reason`.
- Assinatura inválida bloqueia com 403 e nenhum handler roda.
- Evento repetido (mesmo `payload_hash`) não reaplica update.
- Payload com idioma ou WABA diferentes não sobrescreve o template.
- Sync manual respeita instituição do usuário (admin) e permite superadmin escolher outra.
- Sync percorre múltiplas páginas.
- UI mostra Em análise / Aprovado / Rejeitado + motivo + última atualização; Realtime atualiza sem reload; polling para em estado final.
- Nenhum código de mídia adicionado.
