# Evolução 2 — WhatsApp Cloud API (Chagas Connect Care)

Plano modular e incremental. Cada fase é independente, testável e pode ser publicada isoladamente sem quebrar o que já funciona (envio, janela 24h, identidade, opt-in, idempotência, sync básico).

## Princípios

- Nada do fluxo atual é removido. Tudo novo entra atrás de feature flags por instituição (colunas booleanas em `profiles`/`institutions` ou tabela `feature_flags`).
- Definição oficial da Meta é a fonte da verdade. A UI deriva campos de `meta_definition`, nunca inventa componentes.
- Toda chamada à Graph API acontece em Edge Function. Frontend nunca vê `WHATSAPP_TOKEN`, `WHATSAPP_APP_SECRET` ou `SERVICE_ROLE_KEY`.
- Builders puros e tipados em `_shared/` para evitar `if/else` espalhados em `send-whatsapp`.

---

## Fase 1 — Fundação compartilhada (sem mudança de comportamento)

**Objetivo:** extrair builders + tipos sem alterar o que sai pela Meta hoje.

Novos arquivos:
- `supabase/functions/_shared/whatsapp-types.ts` — `WhatsAppHeaderType`, `WhatsAppButtonType`, `WhatsAppMessageKind`, `MetaComponent`, `MetaButton`, `MetaTemplateDefinition`, `BuiltPayload`.
- `supabase/functions/_shared/whatsapp-payload-builder.ts` — `buildTextPayload`, `buildTemplatePayload`, `buildInteractivePayload`, `buildMediaPayload`, `validateTemplateDefinition`, `validateRuntimeParameters`.
- `supabase/functions/_shared/whatsapp-errors.ts` — códigos estruturados reutilizáveis.

Refatorar `send-whatsapp/index.ts` para chamar os builders. Sem mudança funcional. Build + deno check + smoke test com um template de texto existente.

## Fase 2 — Modelo de dados Meta-first

Migration incremental em `message_templates` (todas as colunas nullable, defaults seguros):

```
meta_template_id text
meta_template_name text
meta_language text
meta_category text                 -- UTILITY | MARKETING | AUTHENTICATION
meta_status text
meta_definition jsonb
meta_header_type text              -- none | text | image | video | document
meta_header_text text
meta_header_parameter_order jsonb
meta_body_parameter_order jsonb
meta_footer_text text
meta_buttons jsonb
meta_carousel_cards jsonb
meta_authentication_config jsonb
meta_rejection_reason text
meta_last_synced_at timestamptz
```

Nova tabela `whatsapp_media_assets` (institution-scoped, RLS via `get_user_institution`, GRANTs corretos, service_role inclusive):

```
id, institution, created_by,
storage_path, meta_media_id,
media_type, mime_type, filename, size_bytes, sha256,
status (pending|uploaded|expired|failed),
expires_at, created_at, updated_at
```

Bucket privado `whatsapp-media` (não público — dados clínicos). Política de expiração via coluna + função `cleanup_expired_media()`.

Ampliar `messages` (ou tabela `message_inbound_payloads` separada para PHI mínimo):

```
message_content_type text
media_asset_id uuid
media_mime_type text
media_filename text
interaction_type text             -- button_reply | list_reply | reaction | etc.
interaction_id text
reaction_emoji text
location_data jsonb
```

Atualizar `sync-whatsapp-templates` para popular `meta_definition`, parâmetros, botões, carrossel, header.

## Fase 3 — Headers e mídia segura

1. Nova Edge Function `upload-whatsapp-media`:
   - Valida JWT, instituição, role.
   - Aceita multipart, valida MIME allowlist (image/jpeg, image/png, video/mp4, application/pdf, …), tamanho por tipo, rejeita executáveis e extensões duplas.
   - Calcula sha256, grava no bucket privado, faz upload para `/{phone_id}/media`, salva `meta_media_id`, retorna `media_asset_id` (nunca o token).
2. Builders: `buildHeaderTextParam`, `buildHeaderMediaParam(asset)` respeitando `meta_header_parameter_order`.
3. `send-whatsapp`: resolve `media_asset_id` → `meta_media_id` no backend, monta `components[].type=header`.

## Fase 4 — Botões

Builders e validações para os 4 tipos:
- `quick_reply` → mapear texto visível → `stable_id` (`CONFIRM_APPOINTMENT`, etc.) persistido em `meta_buttons[].stable_id`. Webhook usa `stable_id` como chave lógica.
- `url` estática + dinâmica `{{1}}` com allowlist de domínios em `whatsapp_url_allowlist` (config por instituição). Bloquear `javascript:`, schemes não-http(s).
- `phone_number` — apenas exibir, parâmetros não dinâmicos.
- `copy_code` — preparar para autenticação.

Builder ordena parâmetros por índice de botão conforme definição Meta.

## Fase 5 — Templates de autenticação (isolado por flag)

- `buildAuthenticationTemplatePayload(otp, config)` separado.
- Geração de OTP no backend (`crypto.randomInt`), TTL curto (default 5 min), persistir só `otp_hash` + `expires_at` + `attempt_count` em tabela `whatsapp_otp_challenges`.
- Limite de tentativas, rate limit por destinatário.
- Logs nunca incluem o código. Redaction explícito no logger.
- UI: categoria AUTH mostra apenas campos OTP / expiração / copy_code / autofill / package_name / signature_hash.
- Proibir uso de template AUTH para conteúdo clínico (validação no backend por categoria).

## Fase 6 — Carrosséis

- Builder `buildCarouselPayload(cards, definition)` que valida nº de cards ≤ definição Meta e que cada card tem os mesmos componentes aprovados.
- UI: editor com add/remove/reorder limitado, preview horizontal.
- Persistência em `meta_carousel_cards` com `index`, `media_asset_id`, `body_parameter_order`, `buttons[]`.

## Fase 7 — Mensagens interativas e mídia dentro da janela

- `buildInteractivePayload({ kind: 'button' | 'list', ... })`.
- Gate obrigatório em `send-whatsapp`: se `kind !== 'template'` → checar `whatsapp_window_open(identity_id)`. Erro estruturado `INTERACTIVE_MESSAGE_REQUIRES_OPEN_WINDOW`.
- Mídia (image/video/document) dentro da janela usa o mesmo pipeline da Fase 3.
- UI exibe aviso de privacidade quando anexar arquivo clínico.

## Fase 8 — Webhook ampliado

Reconhecer e persistir: `text`, `image`, `video`, `audio`, `document`, `sticker`, `location`, `contacts`, `reaction`, `interactive` (button_reply, list_reply), `button`.

Para mídia:
1. Webhook só registra `media_id` + metadados, marca `status=pending_download`.
2. Job assíncrono (segunda invocação ou cron) baixa com o token, valida MIME, grava em bucket privado, atualiza `whatsapp_media_assets`.

Idempotência: usar `external_message_id` (já existente) + `interaction_id` para respostas. Manter prioridade monotônica de status já implementada.

## Fase 9 — UI: Editor estruturado

Reescrever `TemplateEditorDialog` em wizard de 10 etapas (Básico → Categoria → Header → Body+vars → Footer → Botões → Carrossel/Auth → Segmentação → Preview → Validação). Componentes desabilitados/escondidos conforme `meta_definition` sincronizada e feature flags. Edição local nunca muta o template aprovado na Meta — apenas mapeamentos internos (variáveis ↔ campos do paciente, stable_ids dos botões, segmentação).

## Fase 10 — Preview fiel + cards + tela de teste + Campaign

- `WhatsAppPreview`: renderizar header (text/image/video/document), body com variáveis resolvidas, footer, botões, lista, carrossel horizontal, OTP, loading/erro de mídia. Sempre exibir disclaimer "Pré-visualização local — o conteúdo final é determinado pelo template aprovado".
- `TemplateCard`: mostrar objetivo, categoria interna + Meta, idioma, status oficial, header type, contagem de variáveis/botões, possui mídia, possui carrossel, última sync. Ações: editar local / sincronizar / testar / duplicar / desativar local / ver definição oficial.
- Nova página `Testar Template Meta` (admin-only): destinatário marcado como `is_test`, formulário dinâmico por componente, confirmação, mostra resposta crua da Meta, wamid e timeline de status.
- `CampaignTab`: validação pré-envio (mídia presente, vars completas, URLs válidas, categoria, aprovação, opt-in, janela quando aplicável). Estimativa por categoria sem prometer valor financeiro.

## Fase 11 — Feature flags, segurança, testes, deploy

Flags (tabela `institution_feature_flags` ou colunas em `profiles.institution_settings`):
`WHATSAPP_MEDIA_ENABLED`, `WHATSAPP_INTERACTIVE_ENABLED`, `WHATSAPP_AUTH_TEMPLATES_ENABLED`, `WHATSAPP_CAROUSEL_ENABLED`. Backend rejeita com erro claro quando desligado; UI esconde.

Testes (Deno test nas funções + Vitest nos builders puros):
- Texto: 0/1/N variáveis, ordem, var ausente.
- Header: cada tipo.
- Botões: 4 tipos + URL dinâmica + domínio bloqueado.
- Auth: OTP válido, expirado, código não vaza em log (assert sobre logger spy).
- Carrossel: limites, mídia/params/botões por card.
- Interativo: ok com janela, bloqueado fora.
- Webhook: button_reply, list_reply, imagem, documento, evento duplicado, assinatura inválida.
- Segurança: upload sem JWT, MIME inválido, tamanho excessivo, cross-institution.

`npm run build` e `deno check` em cada função tocada antes de cada deploy. Deploy ordenado: shared → migrations → `upload-whatsapp-media` → `send-whatsapp` → `whatsapp-webhook` → `process-message-batch` → `sync-whatsapp-templates`.

---

## Detalhes técnicos

### Builders — assinaturas
```ts
buildTemplatePayload(args: {
  to: string;
  definition: MetaTemplateDefinition;
  headerParams?: HeaderParamInput;
  bodyParams?: Record<string, string>;
  buttonParams?: ButtonParamInput[];
  carouselCards?: CarouselCardInput[];
}): BuiltPayload
```
`validateRuntimeParameters` retorna `{ ok, errors[] }` com códigos: `MISSING_BODY_PARAM`, `INVALID_URL_DOMAIN`, `MEDIA_NOT_UPLOADED`, `CAROUSEL_CARD_COUNT_MISMATCH`, `BUTTON_INDEX_OUT_OF_RANGE`, etc.

### Erros estruturados (PT-BR em `src/lib/whatsapp.ts`)
Acrescentar a `friendlyWhatsAppError`: `INTERACTIVE_MESSAGE_REQUIRES_OPEN_WINDOW`, `MEDIA_UPLOAD_FAILED`, `MEDIA_MIME_NOT_ALLOWED`, `MEDIA_TOO_LARGE`, `URL_DOMAIN_NOT_ALLOWED`, `OTP_EXPIRED`, `OTP_TOO_MANY_ATTEMPTS`, `TEMPLATE_DEFINITION_MISMATCH`, `CAROUSEL_CARD_COUNT_MISMATCH`, `FEATURE_DISABLED`.

### RLS / GRANTs (toda nova tabela)
`GRANT SELECT, INSERT, UPDATE, DELETE … TO authenticated; GRANT ALL … TO service_role;` Policies por instituição via `get_user_institution(auth.uid())`. Sem `anon`.

### Limites Meta atuais que respeitarei
Image ≤ 5MB, Video ≤ 16MB, Document ≤ 100MB, Audio ≤ 16MB; janela 24h; carrossel 2–10 cards; OTP ≤ 15 min.

---

## Critérios de aceitação (mesma lista do pedido, marcada ao final de cada fase)

Itens 1–18 do pedido viram checklist de Definition of Done por fase. Nenhum recurso será marcado como "Implementado" sem teste real ou payload validado contra a Meta — caso contrário, marcado como "Parcial" com justificativa.

## Riscos e limitações conhecidos

- Carrossel e Authentication template dependem da Graph API version e da aprovação da Meta — se a WABA atual não tiver aprovação, ficarão "Parcial".
- Estimativa de cobrança não é determinística sem chamada a `/pricing_analytics`; apresentarei faixa, nunca valor exato.
- Bucket privado depende de a workspace permitir buckets do tipo private (sem bloqueio público é OK).
- Webhook media download é assíncrono; latência de até alguns segundos é esperada.

---

## Pergunta antes de implementar

Quer que eu comece pela **Fase 1 + 2** (fundação shared + migrations Meta-first + media_assets), que destrava tudo o resto sem mudar comportamento visível, e siga as próximas fases nas mensagens seguintes? Ou prefere priorizar uma fase específica (ex.: pular direto para mídia + botões)?