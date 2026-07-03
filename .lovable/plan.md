# Acompanhar status de aprovação de modelos na Meta

Hoje um modelo em análise mostra apenas o badge "Em análise" no card e o botão "Usar modelo" fica desabilitado. Não há forma óbvia de abrir o modelo para ver detalhes de aprovação. Vamos habilitar isso e enriquecer o painel de status com os campos que a Graph API do WhatsApp Business já retorna (a função `sync-whatsapp-templates` já busca `status`, `category`, `quality_score`, `rejected_reason`, `components`, etc. — só falta expor).

## O que muda para o usuário

1. **Card do modelo (`TemplateCard`, aba Catálogo)**
   - Quando o modelo é Meta e o status é `submitted`, `rejected`, `paused` ou `disabled`, aparece um novo botão **"Acompanhar status"** (ícone `Activity`/`Info`) ao lado de "Usar modelo".
   - Clicar navega para `/app/modelos/:id` (mesma rota da edição, agora em modo somente leitura para não-admins).
   - Admins continuam vendo o lápis de edição como hoje.

2. **Página de detalhes (`MessageTemplateEdit`)**
   - Deixa de redirecionar não-admins: passa a renderizar em **modo somente leitura** (`disabled` no formulário, sem botões de salvar/enviar). Admins continuam com edição completa quando o modelo está destravado.
   - `MetaStatusPanel` é exibido sempre que `template_kind === "meta"` e o status é diferente de `not_submitted` (hoje só aparece quando `isLocked`, o que já cobre `submitted` — mas garantimos a exibição para não-admins também).

3. **Painel "Status na Meta" enriquecido**
   Novos campos, extraídos de colunas já existentes em `message_templates` e de `meta_definition` (JSON bruto retornado pela Graph API):
   - Status interno + status bruto da Meta (`meta_status_raw`, ex. `PENDING`, `IN_APPEAL`).
   - Categoria (`meta_category`) e idioma (`meta_language`).
   - Quality score (`meta_definition.quality_score.score` — `GREEN` / `YELLOW` / `RED` / `UNKNOWN`), com badge colorida.
   - ID Meta, data de envio, última sincronização, último webhook.
   - Motivo de rejeição (quando `rejected`).
   - Botão **"Atualizar status"** (já existe) — chama `sync-whatsapp-templates` que faz `GET /{waba}/message_templates?fields=id,name,language,status,category,components,rejected_reason,quality_score,parameter_format`.
   - Auto-refetch a cada 20s enquanto `submitted` (já implementado).

## Escopo técnico

Só front-end e um pequeno ajuste de guard — nenhuma mudança de schema, RLS, edge function ou payload de sincronização. A Graph API relevante já é consumida por `supabase/functions/sync-whatsapp-templates/handler.ts` e os campos são persistidos.

### Arquivos alterados

- **`src/components/app/messages/TemplateCard.tsx`**
  - Nova prop `onOpenDetails?: () => void`.
  - Renderiza botão "Acompanhar status" (variant `outline`, ícone `Activity`) quando `variant === "catalog"`, `template.template_kind === "meta"` e `meta_status` ∈ {`submitted`, `rejected`, `paused`, `disabled`}.

- **`src/pages/app/MessageTemplates.tsx`**
  - Passa `onOpenDetails={() => navigate(\`/app/modelos/${t.id}\`)}` para o `TemplateCard` (independente de `isAdmin`).

- **`src/pages/app/MessageTemplateEdit.tsx`**
  - Remover o `Navigate` que expulsa não-admins. Em vez disso, computar `const readOnly = !identity.isAdmin || isLocked;` e:
    - Passar `disabled={readOnly}` para `TemplateEditorForm`.
    - Esconder botões "Salvar rascunho" e "Enviar para aprovação" quando `!identity.isAdmin`.
    - Ajustar o título/subtítulo do header quando não-admin ("Detalhes do modelo" / "Visualização somente leitura").
  - Renderizar `MetaStatusPanel` quando `template_kind === "meta"` e `meta_status !== "not_submitted"` (não só quando `isLocked`).
  - Manter `syncMutation` disponível para todos (ele chama a função edge, que já valida permissão por instituição no `handler.ts`).

- **`MetaStatusPanel` (mesmo arquivo)**
  - Ler campos adicionais: `meta_status_raw`, `meta_category`, `meta_language`, `meta_definition?.quality_score`.
  - Renderizar linhas: Status (interno + bruto), Categoria, Idioma, Quality score (badge colorida), ID Meta, Enviado em, Última sincronização, Último webhook, Motivo (se rejeitado).
  - Manter botão "Atualizar status" e o auto-refetch de 20s.

### Referência Graph API (já usada em `sync-whatsapp-templates/handler.ts`)

`GET https://graph.facebook.com/{version}/{waba_id}/message_templates?fields=id,name,language,status,category,components,rejected_reason,quality_score,parameter_format`

Valores relevantes de `status`: `PENDING`, `IN_APPEAL`, `APPROVED`, `REJECTED`, `PAUSED`, `DISABLED`, `PENDING_DELETION`, `DELETED` — já mapeados em `META_TEMPLATE_STATUS_MAP`.

## Fora do escopo

- Endpoint dedicado por template na Meta (`GET /{template_id}`) — o sync por WABA já traz o item específico via filtro.
- Histórico de eventos/webhooks em UI — os dados existem em `whatsapp_template_events` mas não serão exibidos agora.
- Alterar RLS ou permissões da edge function.
