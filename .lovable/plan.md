
# Fase 2 — Rascunho local de modelos

Fatia vertical: administrador institucional cria/edita rascunho local em página dedicada, sem tocar na Meta. Usuário comum permanece somente leitura.

## Rotas e navegação

- Adicionar em `src/App.tsx` dentro do `InstitutionIdentityProvider`:
  - `/app/modelos/novo` → `MessageTemplateNew`
  - `/app/modelos/:templateId` → `MessageTemplateEdit`
- `MessageTemplates.tsx` ganha botão **Novo modelo** (link para `/app/modelos/novo`) visível somente quando `identity.isAdmin === true`.
- Cada `TemplateCard` no catálogo, quando `isAdmin`, exibe ação **Editar** que navega para `/app/modelos/:id` (reuso do slot `onEdit` já existente na variante `catalog`, hoje oculto).
- Guardas de rota: as duas páginas novas redirecionam para `/app/modelos` se `identity.loading === false && !identity.isAdmin`.

## Extração / reuso (sem dois editores)

Novos arquivos, extraídos do `TemplateEditorDialog.tsx` atual sem duplicar lógica:

- `src/lib/templateDraft.ts`
  - `templateDraftSchema` (Zod): valida `name`, `template_kind`, `body`, `meta_template_name` (regex `^[a-z0-9_]+$`, min 1), `meta_language`, `meta_category`, `meta_header_type` ∈ {`none`,`text`}, `meta_header_text`, `meta_footer_text`, `meta_buttons` (quick_reply | url | phone_number), `variable_examples`, `variable_order`, `targeting_mode`, `audience_types`, `filters`, `category`, `description`.
  - `normalizeMetaName(input)`: lowercases + strip inválidos.
  - `assertMetaDraft(draft)`: garante corpo não vazio; garante que toda variável extraída tem exemplo preenchido; retorna erros nomeados por campo.
- `src/hooks/useTemplateEditor.ts`
  - `useTemplateEditor({ initial, mode })` retorna `{ form, setField, errors, submit, dirty, semanticVariables }`. Encapsula estado, validação com o schema e derivação de `variable_order` a partir do corpo.
- `src/components/app/messages/TemplateEditorForm.tsx`
  - Componente **puro de apresentação** (props: `state`, `onChange`, `errors`, `disabledStatus`) contendo os campos: nome, descrição, categoria/pasta, tipo (interno/meta), nome técnico Meta (com preview do slug), idioma, categoria Meta, cabeçalho (NONE/TEXT), corpo, rodapé, botões (quick_reply/url/phone_number), segmentação sugerida e exemplos de variáveis.
  - **Sem** Select de status. Renderiza status como badge somente leitura (`Rascunho` para `not_submitted`).
  - Reaproveita `WhatsAppPreview` e `SEMANTIC_VARIABLES`/`renderWithExamples` já existentes.
- `TemplateEditorDialog.tsx` é reescrito para virar um wrapper fino: `<Dialog>` que usa `useTemplateEditor` + renderiza `<TemplateEditorForm/>`. Zero divergência entre diálogo e páginas.

## Serviço `InstitutionTemplateService`

Extender `src/services/institutionTemplates.ts` com três funções públicas testáveis:

- `createDraft(input: TemplateDraftInput): Promise<MessageTemplate>`
  - Server-side derivação: `institution = identity.institution` (obtido do provider, não confia no cliente), `created_by = auth.uid()`, `meta_status = 'not_submitted'`, `is_active = true`, `is_default = false`.
  - Recusa se `institution` vazia.
  - **Strip** de `meta_status` e `institution` do input antes do insert.
- `updateDraft(id: string, input: TemplateDraftInput)`
  - Rejeita se `meta_status !== 'not_submitted'` (leitura prévia via `getById`) — aprovados/submetidos não podem ser sobrescritos nesta fase.
  - **Strip** de `meta_status` e `institution` do payload.
- `getById(id: string): Promise<MessageTemplate | null>` scoped por RLS.

Nenhuma chamada a `graph.facebook.com`.

## Persistência / RLS

`message_templates` já existe; nesta fase apenas endurecemos as políticas para refletir "criação/edição só admin institucional":

- Migration `phase2_template_writes_admin_only`:
  ```sql
  DROP POLICY "Templates insert" ON public.message_templates;
  CREATE POLICY "Templates insert admin only" ON public.message_templates
    FOR INSERT TO authenticated
    WITH CHECK (
      public.has_role(auth.uid(), 'admin')
      AND is_default = false
      AND institution = public.get_user_institution(auth.uid())
      AND public.get_user_institution(auth.uid()) <> ''
      AND (created_by = auth.uid() OR created_by IS NULL)
    );

  DROP POLICY "Templates update in institution" ON public.message_templates;
  CREATE POLICY "Templates update admin only" ON public.message_templates
    FOR UPDATE TO authenticated
    USING (
      public.has_role(auth.uid(), 'admin')
      AND is_default = false
      AND institution = public.get_user_institution(auth.uid())
    )
    WITH CHECK (
      public.has_role(auth.uid(), 'admin')
      AND is_default = false
      AND institution = public.get_user_institution(auth.uid())
    );
  ```
  Superadmin continua coberto pela cláusula `has_role`.
- Nenhum GRANT novo — a tabela já tem os grants padrão.

## Status

- Removido todo Select de status do formulário.
- Renderizado como badge somente leitura no cabeçalho da página.
- Payloads de `createDraft`/`updateDraft` filtram `meta_status` no cliente **e** o servidor não confia (aprovado permanece via `updateDraft` bloqueando).

## TDD — ordem dos ciclos

Arquivos:
- `src/pages/app/MessageTemplateNew.test.tsx`
- `src/pages/app/MessageTemplateEdit.test.tsx`
- `src/lib/templateDraft.test.ts`
- `src/pages/app/MessageTemplates.test.tsx` (novos casos)

Um teste por ciclo, sempre `RED → GREEN`:

1. **Tracer**: admin cria rascunho Meta em `/app/modelos/novo`, submete, é redirecionado para `/app/modelos` e o novo modelo aparece com badge "Rascunho" (`not_submitted`). Serviço mockado captura o payload — verificamos que `meta_status` **não** foi enviado e que `institution` veio do provider.
2. Usuário comum navegando para `/app/modelos/novo` é redirecionado para `/app/modelos` e o botão "Novo modelo" não aparece.
3. Nome técnico Meta inválido (`Foo Bar!`) mostra erro de validação e bloqueia submit; nome válido é normalizado para minúsculas (`foo_bar`).
4. Corpo vazio bloqueia submit com erro em `body`.
5. Variável `{nome_paciente}` presente sem exemplo bloqueia submit em modelo Meta.
6. Página não expõe campo editável de status (assertiva: nenhum `combobox`/`select` com `name*=status`).
7. `/app/modelos/:id` carrega rascunho existente via `getById` mock, permite edição e chama `updateDraft` com o id.
8. Tentar editar modelo `approved` mostra aviso e desabilita submit; `updateDraft` não é chamado.
9. Formulário não expõe campo de instituição; ao tentar injetar `institution` no payload (via teste), `createDraft` remove antes do insert.

## API externa

Nenhuma chamada Meta nesta fase. Nenhum código novo em edge functions. `TemplateEditorDialog` atual removerá qualquer botão "Enviar para Meta" (fica para Fase 3) — passa a mostrar apenas **Salvar rascunho**.

## Critérios de aceite

- Rota nova cria rascunho local com id, `meta_status='not_submitted'`, `institution` derivada do usuário logado.
- Edição de rascunho funciona; edição de aprovado é impedida (UI + `updateDraft`).
- RLS bloqueia writes de não-admins (verificação manual via query no banco após migration).
- Nenhuma requisição para `graph.facebook.com`.
- `bunx vitest run` e `bunx tsgo --noEmit` verdes.

## Fora de escopo (Fase 3+)

- HEADER `IMAGE/VIDEO/DOCUMENT`, botões `COPY_CODE`, submissão à Meta, sincronização, versionamento.
