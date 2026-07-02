# FASE 5 — Cabeçalho com mídia (IMAGE / VIDEO / DOCUMENT)

Fatia vertical: admin institucional escolhe um arquivo local, sistema faz upload resumível para a Meta, guarda o `header_handle` da amostra, e a submissão do template passa esse handle no bloco HEADER. Nada de URL manual, nada de mídia real de envio.

## 1. Banco (uma migração)

Nova tabela `whatsapp_template_header_media` (amostras institucionais para criação de template):

```
id uuid pk
local_template_id uuid not null references message_templates(id) on delete cascade
institution text not null
format text not null check (format in ('IMAGE','VIDEO','DOCUMENT'))
mime_type text not null
file_size bigint not null
file_name text
header_handle text not null
uploaded_by uuid not null references auth.users(id)
created_at timestamptz default now()
```

Grants:
- `GRANT SELECT, INSERT, DELETE ON ... TO authenticated`
- `GRANT ALL ... TO service_role`

RLS: leitura/insert/delete restritos a admin institucional cuja `get_user_institution(auth.uid()) = institution`.

Colunas novas em `message_templates`:
- `meta_header_format text` (`IMAGE`|`VIDEO`|`DOCUMENT`|null)
- `meta_header_handle text` — handle da amostra atual
- `meta_header_media_id uuid references whatsapp_template_header_media(id)`

Ampliar o CHECK/enum de `meta_header_type` para aceitar `image | video | document` além de `none | text`.

Remover uso (não a coluna) de `meta_header_media_url` — deixa de ser exposta no formulário e ignorada pelo backend de criação.

## 2. Nova Edge Function: `upload-whatsapp-template-media`

`supabase/functions/upload-whatsapp-template-media/{index.ts,handler.ts,handler.test.ts}`, `verify_jwt=false` (validação em código, como as outras).

Fluxo:
1. Valida JWT → resolve `user_id`, `institution`, checa role admin institucional.
2. Lê `multipart/form-data`: `file` (Blob) + `local_template_id`.
3. Carrega o template; recusa se instituição diferente ou se status ≠ `draft`.
4. Deriva `format` a partir do MIME:
   - `image/jpeg`,`image/png` → IMAGE, limite 5 MB
   - `video/mp4`,`video/3gpp` → VIDEO, limite 16 MB
   - `application/pdf` → DOCUMENT, limite 100 MB
   - qualquer outro MIME → 400 `INVALID_MIME`
5. Se `file.size > limite` → 400 `FILE_TOO_LARGE`.
6. Chamada 1 (sessão):
   `POST graph.facebook.com/{GRAPH_VERSION}/{META_APP_ID}/uploads?file_name=...&file_length=...&file_type=...`
   Header `Authorization: Bearer {WHATSAPP_TOKEN}`.
   Erro → 502 `UPLOAD_SESSION_FAILED` com mensagem real da Meta.
7. Chamada 2 (bytes):
   `POST graph.facebook.com/{GRAPH_VERSION}/{session_id}`
   Headers: `Authorization: OAuth {WHATSAPP_TOKEN}`, `file_offset: 0`, `Content-Type: <mime>`.
   Body: bytes brutos.
   Erro → 502 `UPLOAD_BYTES_FAILED`.
8. Persistir linha em `whatsapp_template_header_media` (service role), e atualizar `message_templates`: `meta_header_type='image|video|document'`, `meta_header_format`, `meta_header_handle`, `meta_header_media_id`.
9. Retorno: `{ ok: true, header_handle, format, media_id }`.

Nunca aceitar handle vindo do cliente. Nenhum acesso ao endpoint `/messages`.

## 3. Ajuste em `create-whatsapp-template/handler.ts` + `_shared/metaTemplatePayload.ts`

- Se `meta_header_type` ∈ {image, video, document}: exige `meta_header_handle` no registro. Ausente → 400 `MISSING_HEADER_HANDLE`.
- Bloco HEADER passa a emitir:
  ```json
  { "type":"HEADER","format":"IMAGE|VIDEO|DOCUMENT","example":{"header_handle":["<handle>"]} }
  ```
- HEADER de texto e ausência de header permanecem inalterados.
- Idempotência: incluir `header_handle` no `stableStringify` do payload (já será, pois vai na saída).

## 4. Schema / formulário

`src/lib/templateDraft.ts`:
- `meta_header_type` passa a aceitar `"none" | "text" | "image" | "video" | "document"`.
- Novos campos opcionais no rascunho: `meta_header_format`, `meta_header_handle`, `meta_header_media_id`, `meta_header_media_file_name`, `meta_header_media_mime`, `meta_header_media_size`.
- Remover `meta_header_media_url` da forma pública (schema + defaults). Backend deixa de ler.

`src/components/app/messages/TemplateEditorForm.tsx`:
- Adicionar opções radio `Imagem | Vídeo | Documento` além de `Nenhum | Texto`.
- Quando selecionado um tipo de mídia: renderizar `<input type="file" accept="...">` real com accept correto por tipo, botão “Enviar amostra”, exibir nome/tamanho/handle atual.
- Mensagens de erro de MIME/tamanho vindas do backend exibidas no formulário.
- Sem campo de URL manual.
- Enquanto `header_handle` ausente e tipo=mídia, botão “Enviar para aprovação” fica desabilitado.

`TemplateEditorDialog.tsx` (legacy) recebe as mesmas mudanças por reuso do form.

## 5. Serviço

`src/services/institutionTemplates.ts`:
- `uploadHeaderMedia(templateId, file)` → `POST` via `supabase.functions.invoke('upload-whatsapp-template-media', { body: FormData })` (sem setar Content-Type manualmente). Retorna `{ header_handle, format, media_id }` e invalida a query do template.
- Ajustar `submitToMeta` apenas para propagar erros de header ausente.

## 6. Testes (TDD, vertical)

Ordem dos ciclos RED→GREEN, um por vez.

Deno (`upload-whatsapp-template-media/handler.test.ts`), com fetch stub para Graph:

1. Admin da instituição envia PNG 1 MB para template próprio em draft → chama endpoint `/uploads`, envia bytes, persiste linha e devolve `header_handle`. Template fica com `meta_header_type=image` e handle salvo.
2. MIME não permitido (`image/gif`) → 400 `INVALID_MIME`, nenhum fetch para Graph.
3. `image/png` > 5 MB → 400 `FILE_TOO_LARGE`.
4. `video/mp4` > 16 MB → 400 `FILE_TOO_LARGE`.
5. `application/pdf` > 100 MB → 400 `FILE_TOO_LARGE`.
6. Template de outra instituição → 403 `FORBIDDEN`.
7. Sessão da Meta falha (chamada 1 retorna 500) → 502 `UPLOAD_SESSION_FAILED` com detalhe.
8. Envio dos bytes falha (chamada 2 retorna 500) → 502 `UPLOAD_BYTES_FAILED`.
9. Corpo sem `file` → 400 `MISSING_FILE`.

Deno (`create-whatsapp-template/handler.test.ts`) — novo caso:

10. Template com `meta_header_type=image` sem `meta_header_handle` → 400 `MISSING_HEADER_HANDLE`, sem fetch para Meta.
11. Template com handle válido → payload enviado contém `components[0]={type:HEADER,format:IMAGE,example:{header_handle:[handle]}}`.

Vitest (novo `MessageTemplateEdit.mediaHeader.test.tsx`):

12. Selecionar tipo Imagem + escolher arquivo → chama service.uploadHeaderMedia, exibe handle, e libera botão Enviar para aprovação.
13. Antes do upload, botão Enviar para aprovação fica desabilitado quando tipo=mídia.
14. Campo de URL manual não existe no DOM.

Cada teste implementa apenas o mínimo antes do próximo (nada de escrever todos os testes de uma vez).

## 7. Critérios de aceite (auto-checklist)

- input `type=file` real, com `accept` correto por tipo.
- upload resumível real usa `META_APP_ID` + `WHATSAPP_TOKEN`.
- handle persistido em `whatsapp_template_header_media` e no template.
- criação de template usa o handle no bloco HEADER.
- endpoint de envio (`send-whatsapp`) não é tocado nesta fase.
- lint, build e todos os testes (Deno + Vitest) passam.
- Parar antes do envio do modelo aprovado.

## Detalhes técnicos

- Secrets já presentes: `META_APP_ID`, `WHATSAPP_TOKEN`, `WHATSAPP_GRAPH_VERSION`.
- Validar `META_APP_ID` no boot da função; ausente → 500 `MISSING_APP_ID`.
- `handler.ts` puro (recebe `fetch` e `supabase` por DI) para permitir testes sem rede.
- Sanitizar mensagem de erro da Meta antes de devolver ao cliente (reaproveitar util existente).
- `handler.test.ts` usa `import "https://deno.land/std@0.224.0/dotenv/load.ts"` e consome todos os response bodies.
