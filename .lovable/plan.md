
# Fase 3 — Enviar rascunho textual para aprovação da Meta

Vertical slice: admin abre um rascunho local (Fase 2) → clica **Enviar para aprovação** → Edge Function monta o payload no servidor, chama a Graph API, persiste o resultado e o status muda de “Rascunho” para “Em análise”. Sem mídia, sem webhook.

## Contratos (seams)

### HTTP público (frontend → Edge Function)
- `POST /functions/v1/create-whatsapp-template`
- Header: `Authorization: Bearer <JWT>`
- Body aceito **apenas**: `{ "local_template_id": "<uuid>" }`.
- Campos ignorados/rejeitados se enviados: `institution`, `meta_status`, `components`, `name`, `waba_id`, `token`.

Respostas:
- `200 { ok: true, meta_template_id, meta_status: "submitted", submitted_at }`
- `200 { ok: true, meta_template_id, meta_status, submitted_at, deduplicated: true }` (idempotência)
- `400 { ok:false, error_code:"LOCAL_TEMPLATE_ID_REQUIRED" }`
- `400 { ok:false, error_code:"TEMPLATE_INVALID", errors:{…} }` (BODY vazio, exemplo faltando, footer > 60, etc.)
- `401 { ok:false, error_code:"UNAUTHORIZED" }`
- `403 { ok:false, error_code:"FORBIDDEN" }` (não-admin ou template de outra instituição)
- `404 { ok:false, error_code:"TEMPLATE_NOT_FOUND" }`
- `409 { ok:false, error_code:"ALREADY_SUBMITTED", meta_status }` (status ≠ `not_submitted` e sem match de idempotência)
- `502 { ok:false, error_code:"META_ERROR", error, meta_error }` (detalhes sanitizados)

### Meta Graph (Edge Function → Meta)
`POST https://graph.facebook.com/{GRAPH_VERSION}/{WABA_ID}/message_templates` com `Bearer WHATSAPP_TOKEN`.

WABA resolvido a partir de `institution_whatsapp_settings.waba_id` da instituição do template; fallback para `WHATSAPP_WABA_ID` só se o registro não existir. Nunca aceitar WABA do cliente.

## Builder puro (sem I/O)

Novo módulo compartilhado `supabase/functions/_shared/metaTemplatePayload.ts` (e re-export em `src/lib/metaTemplatePayload.ts` para reuso no preview do editor).

Assinatura:
```ts
buildMetaTemplateCreationPayload(input: {
  name: string;
  language: string;
  category: "UTILITY" | "MARKETING" | "AUTHENTICATION";
  body: string;                         // com {var_semantica}
  header?: { type: "none" | "text"; text?: string };
  footer?: string | null;
  buttons?: MetaButton[];
  variableExamples: Record<string, string>;
}): { ok: true; payload: MetaCreationPayload; order: string[] }
 | { ok: false; errors: Record<string,string> };
```

Regras:
- Converte `{nome_paciente}` → `{{1}}` via `semanticToPositional`.
- `parameter_format: "POSITIONAL"`.
- Monta `components` na ordem HEADER → BODY → FOOTER → BUTTONS, omitindo os ausentes.
- `example.body_text = [[ex1, ex2, …]]` na ordem posicional; header ganha `example.header_text`.
- Valida: BODY não vazio, FOOTER ≤ 60, HEADER TEXT ≤ 60, cada variável do BODY tem exemplo não-vazio, nome bate `^[a-z0-9_]+$`.
- Determinístico: mesmas entradas → mesmo JSON serializado.
- Sem `fetch`, sem `Deno.env`, sem acesso a banco.

Testes: `supabase/functions/_shared/metaTemplatePayload.test.ts` (Deno), cobrindo happy path, footer/header longos, exemplos ausentes, ordem de variáveis, idempotência serial.

## Handler testável

Split da função atual:

```
supabase/functions/create-whatsapp-template/
├── index.ts            # só borda: env, clients, Deno.serve → handler
├── handler.ts          # createHandler(deps) → (req) => Response
└── ...
```

`handler.ts` recebe injeções:
```ts
createHandler({
  loadUser(jwt): Promise<{ userId, isSuperadmin, isAdmin, institution }>;
  loadTemplate(id): Promise<TemplateRow | null>;
  loadWabaFor(institution): Promise<{ wabaId: string } | null>;
  findExistingSubmission(idempotencyKey): Promise<SubmissionRecord | null>;
  persistSubmission(id, patch): Promise<void>;
  callMeta(wabaId, payload): Promise<{ ok; status; body }>;
  now(): Date;
})
```

Fluxo do handler:
1. `OPTIONS` → CORS. Método ≠ POST → 405.
2. Valida JWT (`getClaims`). Sem token → 401.
3. Lê body JSON. Se `local_template_id` ausente → 400 `LOCAL_TEMPLATE_ID_REQUIRED`.
4. `loadUser` → resolve papel/instituição. Não-admin nem superadmin → 403.
5. `loadTemplate`. Faltando → 404. Se admin e `template.institution ≠ user.institution` → 403.
6. Se `meta_status` já ≠ `not_submitted` e não bate idempotência → 409.
7. `buildMetaTemplateCreationPayload(...)`. Falha → 400 `TEMPLATE_INVALID`.
8. Calcula `idempotencyKey = sha256(institution + waba_id + local_template_id + JSON.stringify(payload))`.
9. `findExistingSubmission(key)` → se existir e `ok`, retorna 200 `deduplicated: true` sem chamar Meta.
10. `loadWabaFor(institution)` → 400 `WABA_NOT_CONFIGURED` se ausente.
11. `callMeta` → em erro Meta persiste `meta_status: "error"` + `meta_rejection_info` e retorna 502 com `error.message` sanitizado.
12. Sucesso → `persistSubmission` com `meta_template_id`, `meta_template_name`, `meta_language`, `meta_category`, `meta_status = STATUS_MAP[status] ?? "submitted"`, `meta_submitted_at = now`, `meta_submitted_by = userId`, `meta_waba_id`, `meta_idempotency_key`, `meta_creation_payload`, `meta_variable_examples`, `meta_definition = metaBody`, `meta_footer_text`, `meta_footer_source`, `meta_version`.
13. Retorna 200 `{ ok:true, meta_template_id, meta_status, submitted_at }`.

## Persistência

Nenhuma migration nova — a tabela já expõe `meta_idempotency_key`, `meta_submitted_at`, `meta_submitted_by`, `meta_waba_id`, `meta_variable_examples`, `meta_creation_payload`, `meta_status`. Se algum campo `NULL` em produção quebrar o insert, ajusta via migration curta com `ALTER COLUMN … DROP NOT NULL`.

Uma segunda RLS policy (`Templates update meta submission`) autoriza a Edge Function via service role (já bypassa RLS) — nenhuma alteração de policy nova para clientes.

## Frontend

### Serviço
Estender `InstitutionTemplateService`:
```ts
submitToMeta(id: string): Promise<{ meta_template_id: string; meta_status: string; submitted_at: string; deduplicated?: boolean }>
```
Implementação real chama `supabase.functions.invoke("create-whatsapp-template", { body: { local_template_id: id } })` e faz mapping de `error_code` → `Error` legível.

### Página `MessageTemplateEdit`
- Novo botão **Enviar para aprovação** (visível só quando `template_kind === "meta"` e `meta_status === "not_submitted"`).
- Ao sucesso: `qc.invalidateQueries` do template + catálogo; `toast.success("Enviado para análise da Meta")`.
- Depois de enviado (`meta_status ≠ not_submitted`): formulário em modo somente leitura, badge “Em análise” + `meta_template_id` + `submitted_at` formatado, botão desabilitado.
- Erros exibem `error.message` (já sanitizado).

### Página `MessageTemplates`
- Já mostra badge de status via `TemplateCard`; nada muda além de refletir o novo status ao invalidar cache.

## TDD

Ordem estrita, um ciclo por vez, RED antes de GREEN.

**Deno (handler + builder), arquivos em `supabase/functions/create-whatsapp-template/`:**

1. `handler.happy.test.ts` — rascunho válido → 200 `submitted`, Meta chamada 1×, `persistSubmission` com `meta_status:"submitted"`, `meta_template_id`, `meta_submitted_at`. (RED primeiro.)
2. `handler.validation.test.ts` — sem `local_template_id` → 400 `LOCAL_TEMPLATE_ID_REQUIRED`, Meta não chamada.
3. `handler.auth.test.ts` — sem JWT → 401; não-admin → 403; admin de outra instituição → 403.
4. `handler.notfound.test.ts` — template inexistente → 404.
5. `handler.already.test.ts` — `meta_status` ≠ `not_submitted` e chave idempotência distinta → 409; Meta não chamada.
6. `handler.invalid_body.test.ts` — BODY vazio ou exemplo faltando → 400 `TEMPLATE_INVALID`, Meta não chamada.
7. `handler.meta_error.test.ts` — Meta responde 400/500 → 502 `META_ERROR` com mensagem sanitizada, persistência marca `meta_status:"error"`.
8. `handler.status_map.test.ts` — Meta responde `PENDING` → persistência grava `submitted`.
9. `handler.idempotency.test.ts` — duas chamadas seguidas com mesmo payload → Meta chamada 1×, segunda retorna `deduplicated:true`.
10. `_shared/metaTemplatePayload.test.ts` — builder puro: happy path, ordem de variáveis, exemplos, footer/header longos, nome inválido, determinismo.

Mocks só na fronteira (banco/HTTP). Nada de espionar funções internas.

**Vitest (frontend):**
11. `src/pages/app/MessageTemplateEdit.submit.test.tsx` — botão “Enviar para aprovação” chama `service.submitToMeta(id)` com o UUID, mostra toast de sucesso, invalida cache.
12. Botão só aparece quando `template_kind === "meta"` e `meta_status === "not_submitted"`.
13. Após envio bem-sucedido a UI mostra badge “Em análise”, `meta_template_id`, `submitted_at` e o botão fica desabilitado.
14. Erro Meta (`error_code: META_ERROR`) mostra `toast.error` com a mensagem retornada.

## Detalhes técnicos

- `GRAPH_VERSION` continua vindo de env, com fallback `v25.0`, validado por regex.
- Sanitização de mensagens Meta: pegar apenas `error.message` e `error.error_user_msg`; nunca vazar `error.fbtrace_id` do WABA nem `error_data.details` cruas.
- `sha256` via `crypto.subtle.digest` (`hex`), payload normalizado com `JSON.stringify` estável (chaves ordenadas em `components`/`example`).
- `loadWabaFor(institution)` lê `institution_whatsapp_settings` (canal ativo). Ausente → 400 explícito, não tenta env fallback quando `institution` está definido.
- Preservar comportamento de versionamento (`parent_template_id`) fora do escopo desta fase — bloquear com 400 caso enviado.
- `verify_jwt` fica no default (`false`); autenticação segue in-code via `getClaims`.
- Nada de webhook, nada de sync-back. Fim explícito da fatia.

## Arquivos afetados

Novos:
- `supabase/functions/_shared/metaTemplatePayload.ts`
- `supabase/functions/_shared/metaTemplatePayload.test.ts`
- `supabase/functions/create-whatsapp-template/handler.ts`
- `supabase/functions/create-whatsapp-template/handler.happy.test.ts`
- `supabase/functions/create-whatsapp-template/handler.validation.test.ts`
- `supabase/functions/create-whatsapp-template/handler.auth.test.ts`
- `supabase/functions/create-whatsapp-template/handler.notfound.test.ts`
- `supabase/functions/create-whatsapp-template/handler.already.test.ts`
- `supabase/functions/create-whatsapp-template/handler.invalid_body.test.ts`
- `supabase/functions/create-whatsapp-template/handler.meta_error.test.ts`
- `supabase/functions/create-whatsapp-template/handler.status_map.test.ts`
- `supabase/functions/create-whatsapp-template/handler.idempotency.test.ts`
- `src/pages/app/MessageTemplateEdit.submit.test.tsx`

Editados:
- `supabase/functions/create-whatsapp-template/index.ts` (vira wrapper fino sobre `handler.ts`).
- `src/services/institutionTemplates.ts` (`submitToMeta`).
- `src/pages/app/MessageTemplateEdit.tsx` (botão + estados de envio).

## Critérios de aceite

- Rascunho local existe antes do envio (400 se não).
- Payload sempre montado no servidor a partir do registro local.
- WABA usado é o da instituição do template; nunca aceita do cliente.
- `meta_status`, `meta_template_id`, `meta_submitted_at`, `meta_submitted_by`, `meta_waba_id`, `meta_idempotency_key`, `meta_creation_payload` são persistidos.
- Duplo clique não gera duas chamadas à Meta.
- Erros da Meta chegam ao usuário como mensagem legível, sem dados sensíveis.
- Todos os testes (Deno + Vitest) verdes.
- Sem código de webhook nesta fase.
