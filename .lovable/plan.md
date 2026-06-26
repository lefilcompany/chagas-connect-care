# Identidade Institucional, Assinatura e Rodapé WhatsApp — Plano de Execução

Evolução incremental do Chagas Connect Care para permitir que cada instituição configure como sua marca aparece nas mensagens (texto livre, interativa e Template Meta), respeitando as regras reais da Meta Cloud API e preservando toda a arquitetura atual (RLS, multi-instituição, webhooks, templates, campanhas).

A execução é dividida em fases pequenas e seguras. Cada fase termina em estado verde (build ok, fluxos antigos intactos) antes da próxima.

---

## Fase 0 — Auditoria e fundação não-sensível

- Ler integralmente os arquivos listados no item 1 do brief + migrations existentes para mapear o que já existe (`message_templates.meta_footer_text`, `meta_definition`, `whatsapp_identities`, `whatsapp_conversations`, `institution`, papéis via `has_role`, etc.) e evitar duplicações.
- Criar `src/config/application.ts` exportando `APP_DISPLAY_NAME` e `DEFAULT_POWERED_BY_TEXT`.
- Substituir literais de marca incoerentes no frontend (sem tocar em nome jurídico nem nome aprovado do número WhatsApp).
- Definir no backend o uso de `Deno.env.get("APPLICATION_DISPLAY_NAME") ?? "Chagas Digital Care"` (sem `VITE_`, sem secret).

## Fase 1 — Banco: configurações por instituição + auditoria de envio

Migration única, incremental:

1. `institution_whatsapp_settings` com os campos do item 3, `unique(institution)`, check constraint para `signature_mode in ('none','institution_name','powered_by','custom')`, trigger `updated_at`, GRANTs (`authenticated`, `service_role`), RLS:
   - SELECT: usuário cuja `profiles.institution = institution` **ou** `has_role(auth.uid(),'admin')`.
   - INSERT/UPDATE: somente `has_role(auth.uid(),'admin')` E mesma instituição; preencher `updated_by = auth.uid()` via trigger.
2. `ALTER TABLE messages ADD COLUMN IF NOT EXISTS resolved_footer_text text, footer_delivery_mode text, rendered_body text, branding_settings_snapshot jsonb` + check para `footer_delivery_mode in ('none','body_signature','interactive_footer','meta_template_footer')`.
3. `ALTER TABLE message_templates` adicionando o que ainda faltar: `meta_footer_source`, `meta_has_local_differences`, `meta_version`, `meta_parent_template_id` (FK self), `last_synced_at` (manter os existentes).
4. Backfill: inserir uma linha em `institution_whatsapp_settings` para cada `institution` distinta encontrada em `profiles`/`patients`, com `signature_mode='powered_by'`, `signature_enabled=true`, flags de aplicação `true`.

## Fase 2 — Helper compartilhado de branding (Edge)

- Criar `supabase/functions/_shared/institution-branding.ts` com:
  - `resolveInstitutionBranding(supabase, institution)` → carrega settings com cache por execução.
  - `resolveSignatureText(settings)` → aplica regra `none|institution_name|powered_by|custom` + fallback de `brand_name`/`application_display_name`.
  - `appendSignatureToFreeText(body, signature)` → idempotente (normaliza espaços, evita duplicar quando o corpo já termina com a assinatura, formata `\n\n_{assinatura}_`).
  - `resolveInteractiveFooter(settings, explicit?)` → respeita limite de 60 chars, retorna `null` quando desativado.
  - `resolveDefaultTemplateFooter(settings)` → texto padrão para criação de novos templates.
- Snapshot helper para gravar `branding_settings_snapshot` apenas com campos não sensíveis.

## Fase 3 — `send-whatsapp`: aplicar branding

- Após resolver instituição e antes do envio:
  - **type:text**: se `append_signature_to_text` e assinatura ativa → `rendered_body = appendSignature(body, sig)`; payload usa `rendered_body`; gravar `resolved_footer_text=sig`, `footer_delivery_mode='body_signature'`.
  - **interactive**: aplicar `resolveInteractiveFooter`; só usa `footer.text` nativo; gravar `footer_delivery_mode='interactive_footer'`.
  - **template**: nunca tocar no body; ler `meta_footer_text` do template; se settings exigem footer e `meta_footer_text` divergir → retornar erro estruturado `META_TEMPLATE_FOOTER_MISMATCH` (configurável: bloquear por padrão para categorias clínicas, permitir com confirmação em outras via flag do request); gravar `resolved_footer_text=meta_footer_text`, `footer_delivery_mode='meta_template_footer'`.
  - **authentication**: nunca adicionar assinatura; `footer_delivery_mode='none'` (ou `meta_template_footer` quando aprovado).
- Preservar `body` original; `rendered_body` é o texto realmente enviado.
- Atualizar `friendlyWhatsAppError` em `src/lib/whatsapp.ts` para o novo código.

## Fase 4 — Sincronização Meta completa

- Em `sync-whatsapp-templates`:
  - Buscar `?fields=name,language,status,category,quality_score,rejected_reason,components` na Graph v25.
  - Extrair componentes: HEADER → `meta_header_type`/`meta_header_text`; BODY (mantém parsing atual); FOOTER → `meta_footer_text`; BUTTONS → `meta_buttons`; CAROUSEL → `meta_carousel_cards`; AUTH → `meta_authentication_config`.
  - Persistir `meta_definition` completo, `last_synced_at`, `rejection_reason`.
  - Calcular `meta_has_local_differences` comparando footer/body local x Meta sem sobrescrever silenciosamente.
  - Templates retornados sem vínculo local ficam disponíveis para "Mapear" (não auto-associar por nome).

## Fase 5 — Tabela `whatsapp_channels` + roteamento de webhook

- Migration: criar tabela conforme item 11 (sem colunas de token), `unique(institution, phone_number_id)`, índice em `phone_number_id`, RLS (leitura por instituição/admin; escrita por admin), GRANTs.
- Backfill: inserir um canal `shared` por instituição usando `WHATSAPP_PHONE_NUMBER_ID`/`WHATSAPP_WABA_ID` (lidos no backfill via script de migration que apenas referencia env vars).
- `whatsapp-webhook`: ler `value.metadata.phone_number_id` → resolver `whatsapp_channels` → `institution` → buscar identidade por `(institution, wa_id)` em vez de global; atualizar `last_webhook_at`.
- Identidades existentes ganham backfill de `institution` quando ambíguo é resolvível.
- Modo `dedicated` documentado como "preparação"; sem armazenar token (Vault fora de escopo aqui — exibir "Canal dedicado ainda não configurado").

## Fase 6 — Edge Function `create-whatsapp-template`

- Nova função autenticada (JWT + `has_role admin`):
  - Valida nome, categoria, idioma, componentes, footer (≤60).
  - Chama `POST /{waba_id}/message_templates`.
  - Persiste resultado em `message_templates` da instituição com `meta_version`, `meta_parent_template_id` (quando "nova versão"), `meta_footer_source='meta_synced'`, status real retornado.
  - Para "nova versão" gera nome `{base}_v{n+1}`; nunca marca aprovado sem retorno da Meta.
- Edge `whatsapp-diagnostics`: leitura apenas; retorna estados `configurado|nao_configurado|desconhecido` para token/app secret/verify token/webhook/WABA subscription/forma de pagamento/últimos eventos. Nunca devolve valores.

## Fase 7 — Frontend: rota e navegação

- Rota `/app/configuracoes/whatsapp` em `src/App.tsx`.
- Item "Configurações" (ícone engrenagem) em `AppLayout.tsx`, leitura para todos, edição condicionada a `has_role admin`.
- Página com header descritivo + card resumo de conexão (status, número, modo, qualidade, último webhook, última sync) + tabs: Visão geral · Identidade e assinatura · Templates Meta · Canal · Diagnóstico. Mobile: tabs roláveis.

## Fase 8 — Tab "Identidade e assinatura" + preview

- Form (coluna esquerda) com `brand_name`, switch `signature_enabled`, radio `signature_mode` (4 opções), textarea `custom_signature_text` (condicional, validado), switches `append_signature_to_text`, `use_native_interactive_footer`, `use_as_template_footer_default`, campo `default_template_footer_text` com contador 60.
- Avisos contextuais por tipo de mensagem.
- Coluna direita: `WhatsAppPreview` evoluído aceitando `header|body|footer|buttons|media|recipientName|messageType|footerDeliveryMode|templateStatus|category` + seletor "Texto livre / Interativa / Template Meta" mostrando o comportamento real (assinatura no balão vs footer cinza separado vs footer estático com selo de aprovado).
- Barra inferior "Alterações não salvas" com Cancelar/Salvar; `aria-live` ao salvar; estados loading/erro/sem permissão/não configurado conforme item 24.

## Fase 9 — Tab "Templates Meta" + cards

- `TemplateCard.tsx`: simplificar badges (Meta aprovado, em análise, objetivo interno, rodapé institucional, rodapé divergente) e mover detalhes para tooltip/menu.
- `TemplateEditorDialog.tsx`: refator em wizard (Informações → Tipo/categoria → Cabeçalho → Corpo/variáveis → Rodapé → Botões → Segmentação → Revisão). Etapa Rodapé com opções `Sem rodapé | Padrão da instituição | Personalizado | Sincronizado da Meta` + status de compatibilidade. Editar localmente nunca dá impressão de alterar template aprovado; CTA "Criar nova versão na Meta" quando aplicável, com diff visual e confirmação.
- Lista (tab) com busca, filtros (status, categoria, compatibilidade footer, instituição quando aplicável), tabela responsiva → cards no mobile.

## Fase 10 — Tab "Canal" e "Diagnóstico"

- Canal: leitura do `whatsapp_channels` da instituição; modo compartilhado em destaque; bloco "Canal dedicado" desativado com tooltip explicativo.
- Diagnóstico: chama `whatsapp-diagnostics`; lista de itens com estado, botão "Executar diagnóstico"; nenhum valor sensível exibido.

## Fase 11 — Campanhas + custos

- Em `CampaignTab.tsx`: exibir assinatura resolvida, footer oficial do template, alerta de divergência, contagem de destinatários "texto livre" vs "Template Meta", estimativa de mensagens potencialmente tarifáveis (`Gratuito na janela | Pode gerar cobrança | Cobrança esperada | Não foi possível determinar`); bloquear template de outra instituição; preview de exemplo final.
- Mesma resolução de assinatura aplicada via `whatsapp.ts` ao construir `body` de mensagens livres na campanha (front renderiza preview; backend é fonte da verdade).

## Fase 12 — Tipos, queries, segurança, testes

- `src/lib/templates.ts` e `src/integrations/supabase/types.ts` (regenerados pós-migration) com novos tipos: `InstitutionWhatsAppSettings`, `WhatsAppChannel`, `SignatureMode`, `FooterDeliveryMode`, `TemplateFooterCompatibility`.
- `src/lib/queries.ts`: query keys `institutionWhatsAppSettings`, `whatsappChannels`, `whatsappTemplates`, `whatsappDiagnostics` com invalidação cirúrgica.
- Testes Vitest cobrindo `appendSignatureToFreeText` (idempotência, cada modo, custom vazio, desativado), resolução por instituição, regras de template Meta (mismatch, OTP sem assinatura), webhook por `phone_number_id`, RLS cross-tenant (via supabase-js com dois usuários simulados quando possível).
- `bun run build` + `deno check` nas funções alteradas.

## Critérios de aceitação

Todos os checkboxes do item 33 do brief. Nenhuma secret no frontend. RLS por instituição. Build verde. Sem regressão em cadastro, campanhas, envio, webhook, OTP, mídia, botões, carrosséis, produtos.

## Limitações conhecidas (a comunicar ao final)

- Footer de Template Meta é estático: mudanças exigem nova aprovação na Meta (a função `create-whatsapp-template` só envia o pedido).
- Canal dedicado por instituição fica apenas como arquitetura preparada; sem Vault configurado não armazenaremos token — UI mostra "Canal dedicado ainda não configurado".
- Forma de pagamento e custos exibidos são qualitativos; valores exatos dependem da conta Meta.
- Diagnóstico só reporta estados (`configurado|nao_configurado|desconhecido`), nunca valores.
