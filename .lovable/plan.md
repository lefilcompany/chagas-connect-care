
# Fase 7 — Revisão, consolidação e remoção de duplicidade

Sem novas features. Só consolidação, com todos os testes existentes permanecendo verdes.

## 1. Auditoria de duplicidade (o que já é único e o que não é)

Já existe **uma** implementação canônica de:

- Validação de rascunho — `src/lib/templateDraft.ts`
- Extração/rótulos de variáveis — `src/lib/metaVariables.ts`
- Badge/labels de status Meta — `META_STATUS_LABEL` em `src/lib/templates.ts`
- Preview WhatsApp — `src/components/app/messages/WhatsAppPreview.tsx`
- Payload de criação de template — `supabase/functions/_shared/metaTemplatePayload.ts`
- Payload de envio de template aprovado — `supabase/functions/_shared/approvedTemplatePayload.ts`
- Tradução de erros WhatsApp — `supabase/functions/_shared/whatsapp-errors.ts` + `src/lib/whatsapp.ts`
- Serviço institucional de modelos — `src/services/institutionTemplates.ts`

Ainda existem **duas superfícies de edição** de modelo:

- ✅ Canônica: `MessageTemplateNew` / `MessageTemplateEdit` + `TemplateEditorForm` (rota `/app/modelos/...`)
- ❌ Legada: `TemplateEditorDialog` usada em `src/pages/app/Content.tsx` (detalhe da pasta) e `TemplatesTab.tsx` (não mais montado em nenhuma rota).

Fase 7 elimina a superfície legada.

## 2. Alterações de código

### 2.1 `src/pages/app/Content.tsx` (detalhe da pasta)

- Remover a seção "Objetivos de mensagem" inteira: `sortedTemplates`, `StartBlankCard`, grid de `TemplateCard` de edição, `TemplateEditorDialog`, `UseTemplateDialog`, `duplicateTpl`, estados `editorOpen/editingTpl/useOpen/usingTpl`.
- Substituir por um **card único "Modelos deste tema"** com CTA `Link` para `/app/modelos?categoria=<folder.value>` (contagem = `templates.length`).
- Manter tudo relativo a **conteúdos educativos** (`ContentFormDialog`, `SendContentDialog`, busca, pastas).
- Na visão de pastas, o contador `f.templates` continua exibido, mas o clique da pasta continua abrindo o detalhe (agora só com o card-link).
- Remover imports mortos: `TemplateEditorDialog`, `StartBlankCard`.

### 2.2 `src/pages/app/Content.tsx` (busca global)

- Em `SearchResults`, trocar cliques em templates (`onUse/onEdit/onDuplicate`) por navegação para `/app/modelos?categoria=<folder>` em vez de reabrir a pasta com editor.
- Alternativa mais simples: manter a seção "Objetivos" só como link para `/app/modelos` filtrado; nenhum botão de editar/duplicar.

### 2.3 Remover arquivos legados

- Apagar `src/components/app/messages/TemplatesTab.tsx` (nenhuma rota importa).
- Não apagar `TemplateEditorDialog.tsx` neste PR se ainda houver algum caminho oculto — confirmar com `rg` antes; se realmente órfão, apagar junto.

### 2.4 `/app/modelos` — filtro por categoria via URL

Em `src/pages/app/MessageTemplates.tsx`:

- Ler `categoria` de `useSearchParams`.
- Inicializar `catFilter` a partir da query string; ao mudar o `<select>` de categoria, atualizar a URL (`setSearchParams({ categoria })`) sem recarregar.
- Aceitar valores conhecidos (fallback para `todos`).

### 2.5 Superadmin

`/superadmin/whatsapp` **não existe hoje** no roteador. Duas opções:

- (a) Não criar nada nesta fase; documentar como pendência futura.
- (b) Criar apenas o esqueleto de rota que agrega páginas já existentes (diagnóstico, `repair-whatsapp-channel`, auditoria) sem novo editor.

Recomendo **(a)** — Fase 7 é consolidação, não nova feature. A criação institucional permanece em `/app/modelos/novo`, como já está.

### 2.6 Configurações

`/app/configuracoes/whatsapp` (`WhatsAppSettings.tsx`) já cobre identidade/assinatura/rodapé. Nada muda. Confirmar que **não** contém formulário de modelo.

## 3. Regressão

Rodar sem alterar comportamento observável em `/app/modelos*`:

- `bunx vitest run` (52 testes atuais devem continuar verdes; incluir `MessageTemplates.test.tsx` com nova asserção de filtro por URL — 1 teste novo).
- `deno test` das Edge Functions (55 atuais).
- `bun run lint` e `bun run build`.

## 4. Checklist de segurança (verificação, sem alterações se OK)

- Status de modelo não é editável no `TemplateEditorForm` (campo readOnly / ausente).
- `WHATSAPP_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` só existem em secrets — `rg` no `src/` para confirmar zero referências.
- Instituição vem sempre de `profiles.institution` via `InstitutionIdentityProvider`, nunca de input livre.
- RLS de `message_templates` restringe INSERT/UPDATE a admin (migration Fase 2 já aplicada).
- `send-whatsapp` e `create-whatsapp-template` resolvem WABA e Phone Number ID no servidor a partir da instituição.
- Mensagens de erro traduzidas via `friendlyWhatsAppError` não vazam token.

## 5. Entrega

Ao final, reportar:

- Arquivos alterados: `src/pages/app/Content.tsx`, `src/pages/app/MessageTemplates.tsx`, `src/pages/app/MessageTemplates.test.tsx`, remoção de `src/components/app/messages/TemplatesTab.tsx`.
- Migrations: nenhuma nova.
- Testes criados: 1 (filtro `?categoria=` em `/app/modelos`).
- Edge Functions envolvidas: nenhuma alterada.
- Secrets: nenhuma nova.
- URLs verificadas manualmente: `/app/modelos`, `/app/modelos/novo`, `/app/modelos/:id`, `/app/conteudos`, `/app/conteudos?pasta=...`, `/app/configuracoes/whatsapp`.
- Etapas manuais Meta: nenhuma nesta fase.
- Riscos residuais: `/superadmin/whatsapp` continua inexistente (fora do escopo desta fase); `TemplateEditorDialog.tsx` pode ser apagado só se `rg` confirmar zero usos após a limpeza do Content.

Só declarar concluído se `vitest`, `deno test`, `lint` e `build` passarem.
