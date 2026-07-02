# Fase 0 — Arquitetura e seams de TDD para Modelos institucionais

Nenhuma linha de código, migration ou teste foi alterada nesta fase. Abaixo está a inspeção do estado atual do repositório, a arquitetura proposta e as seams definitivas para as próximas fases.

## 1. Mapa do fluxo atual

Estado hoje (inspecionado em `src/App.tsx`, `TemplatesTab.tsx`, `TemplateEditorDialog.tsx`, `TemplateCard.tsx`, `UseTemplateDialog.tsx`, `templates.ts`, `queries.ts`, `whatsapp.ts`, funções edge):

- Não existe rota `/app/modelos`. Modelos vivem embutidos em `src/pages/app/Messages.tsx` via `TemplatesTab.tsx` (aba "Modelos") + `CampaignTab.tsx`.
- Não existe `src/pages/superadmin/WhatsAppAdmin.tsx`. Ações de superadmin (canais, credenciais, sync global, diagnóstico) estão hoje misturadas em `src/pages/app/WhatsAppSettings.tsx` (744 linhas) e nas edge functions `whatsapp-diagnostics`, `repair-whatsapp-channel`, `sync-whatsapp-templates`.
- Não existe `upload-whatsapp-template-media`. O único uploader é `upload-whatsapp-media` (usado por conversas). Precisará ser criado ou reaproveitado com escopo "template header".
- Não existe `CONTEXT.md` nem ADRs no repositório.
- `TemplateEditorDialog.tsx` é um `Dialog` de 1057 linhas que já cobre wizard de 8 passos, mapeamento de variáveis, preview e submissão. É o principal candidato à extração.
- Leitura/escrita de `message_templates` é feita hoje direto pelo componente via `supabase` client + `fetchers.templates` em `src/lib/queries.ts`. Não há camada de serviço.
- Realtime já escuta `message_templates` por instituição (via RLS) em `TemplatesTab.tsx`.
- Envio para Meta: `create-whatsapp-template` (166 l) e `sync-whatsapp-templates` (150 l). Ambos usam `SUPABASE_SERVICE_ROLE_KEY` e chamam `graph.facebook.com`.
- Envio de mensagem final: `send-whatsapp/index.ts` (1287 l), com builder compartilhado em `supabase/functions/_shared/whatsapp-payload-builder.ts`.
- `vitest.config.ts` + `src/test/setup.ts` já configuram jsdom + Testing Library. `supabase--test_edge_functions` disponível para Deno tests.

```text
Hoje                                    Proposto
--------                                --------
/app/mensagens (abas)                   /app/mensagens (só campanha/envio)
  ├─ TemplatesTab  ─────────────►       /app/modelos (lista institucional)
  │    ├─ TemplateEditorDialog ─►       /app/modelos/novo + /:id (página cheia)
  │    └─ UseTemplateDialog             UseTemplateDialog (mantido no envio)
  └─ CampaignTab                        CampaignTab (inalterado)

/app/configuracoes/whatsapp             /app/configuracoes/whatsapp (institucional: prefs, assinatura)
  (hoje mistura credenciais + prefs)    /superadmin/whatsapp (credenciais, WABA, phone id, sync global,
                                        diagnóstico, auditoria, repair)
```

## 2. Arquitetura proposta

**Camadas** (ordem de dependência, de dentro para fora):

1. **Domínio puro** (`src/lib/templates/*`, sem React nem Supabase). Funções deterministas testáveis por unit test.
2. **Serviço institucional** (`src/lib/templates/service.ts`). Fachada sobre `supabase` client + edge functions. Injetável via contexto ou prop nos testes de página.
3. **Páginas + componentes** (`src/pages/app/modelos/*`, `src/components/app/modelos/*`). Consome o serviço. Testado por RTL com serviço fake.
4. **Edge functions** (`create-whatsapp-template`, `sync-whatsapp-templates`, `send-whatsapp`, `whatsapp-webhook`, novo `upload-whatsapp-template-media`). Testado por Deno test com `fetch` mockado apenas para `graph.facebook.com`.

**Autorização** (aplicada em UI e RLS/edge):
- `equipe` (comum): leitura de modelos aprovados da instituição + `UseTemplateDialog`.
- `admin` institucional: tudo do anterior + criar/editar rascunho, submeter, versionar, ver rejeição.
- `superadmin`: só canal/WABA/diagnóstico/sync global. **Não** cria modelos cotidianos.

## 3. Seams finais

Ajustes sobre a proposta original em **negrito**.

### Seam 1 — Página institucional de modelos
- Interface pública: rota `/app/modelos` renderizando `<TemplatesPage />`.
- Comportamentos testados por RTL (com `InstitutionTemplateService` fake):
  - lista apenas modelos da instituição do usuário logado;
  - status exibido em linguagem humana ("Rascunho", "Em análise Meta", "Aprovado", "Rejeitado");
  - filtros de busca e categoria funcionam;
  - modelo aprovado abre `UseTemplateDialog`;
  - modelo não aprovado não expõe ação "Utilizar" nem "Enviar";
  - `admin` vê botão "Novo modelo"; `equipe` não vê.

### Seam 2 — Editor institucional
- Interfaces públicas: `/app/modelos/novo` e `/app/modelos/:templateId` renderizando `<TemplateEditorPage />`.
- **Decisão sobre `TemplateEditorDialog`**: extrair o miolo do wizard para `<TemplateEditorForm />` (puro, controlado por props). O `Dialog` existente é aposentado e o novo formulário é reutilizado tanto pela página cheia (default) quanto por eventual reabertura em modal no futuro.
- Comportamentos:
  - `admin` salva rascunho com dados válidos;
  - campos obrigatórios/inválidos impedem `Salvar` e `Enviar para análise`;
  - status é somente leitura;
  - modelo com status `approved` não é sobrescrito — ação disponível é "Criar nova versão";
  - `institution` vem sempre do usuário autenticado (nunca de input);
  - `equipe` recebe bloqueio (redirect ou tela "sem permissão").

### Seam 3 — Serviço institucional
- Interface pública (arquivo `src/lib/templates/service.ts`):

```ts
export interface InstitutionTemplateService {
  list(): Promise<MessageTemplate[]>;
  getById(id: string): Promise<MessageTemplate>;
  createDraft(input: TemplateDraftInput): Promise<MessageTemplate>;
  updateDraft(id: string, input: TemplateDraftInput): Promise<MessageTemplate>;
  submit(id: string): Promise<TemplateSubmissionResult>;
  syncStatus(id: string): Promise<MessageTemplate>;
}
```

- Implementação real usa `supabase` client + `supabase.functions.invoke`.
- Testes de página substituem por objeto in-memory. Testes verificam **comportamento visível**, nunca `expect(service.createDraft).toHaveBeenCalled…`.

### Seam 4 — Edge Function de criação
- `POST {SUPABASE_URL}/functions/v1/create-whatsapp-template`
- Body: `{ "local_template_id": "uuid" }`
- Comportamentos testados por Deno test (fetch a `graph.facebook.com` mockado):
  - só admin da instituição do template pode invocar (401/403 caso contrário);
  - transição de status `draft` → `pending`;
  - erro Meta grava `last_error` e mantém `draft`.

### Seam 5 — Edge Function de sincronização
- `POST {SUPABASE_URL}/functions/v1/sync-whatsapp-templates`
- Aceita `{ "template_id"?: uuid }` (único) ou vazio (global — só superadmin).
- Testes: normalização de status Meta, detecção de divergência.

### Seam 6 — Webhook
- `GET /whatsapp-webhook` (verificação) e `POST /whatsapp-webhook` (eventos `message_template_status_update`).
- Testes: assinatura HMAC válida/ inválida; atualização monotônica de status; auditoria em `whatsapp_webhook_activity`.

### Seam 7 — Upload de mídia de header
- `POST {SUPABASE_URL}/functions/v1/upload-whatsapp-template-media` **(a criar)** — separado de `upload-whatsapp-media` porque o fluxo Meta usa `resumable upload API` diferente.
- Testes: valida MIME/size por tipo de header (IMAGE/VIDEO/DOCUMENT), devolve `handle` para uso em `create-whatsapp-template`.

### Seam 8 — Envio
- `POST {SUPABASE_URL}/functions/v1/send-whatsapp` (inalterado do ponto de vista contratual).
- Testes cobrem apenas o caminho "envio por template" para garantir não-regressão.

### Seam 9 — Domínio puro
- Módulos alvo (`src/lib/templates/*.ts`, sem side-effects):
  - `variables.ts` — converter variáveis semânticas ↔ placeholders Meta `{{1}}`;
  - `components.ts` — construir array `components` do payload Meta a partir de rascunho;
  - `status.ts` — normalizar status Meta (`APPROVED|PENDING|REJECTED|PAUSED|DISABLED`) para status interno humano;
  - `sendPayload.ts` — construir payload de envio a partir de `MessageTemplate` + variáveis preenchidas;
  - `diff.ts` — detectar divergência local ↔ Meta (retorna lista de campos discrepantes).
- Todos testáveis com input/output puros, sem mocks.

### Seam 10 — Limite externo da Meta
- Mockar exclusivamente `globalThis.fetch` para URLs `https://graph.facebook.com/${GRAPH_VERSION}/...`.
- Proibido mockar módulos internos (`_shared/whatsapp-payload-builder.ts`, `templates.ts`) para testar outros módulos internos.

## 4. Arquivos de teste sugeridos

```text
src/lib/templates/__tests__/variables.test.ts
src/lib/templates/__tests__/components.test.ts
src/lib/templates/__tests__/status.test.ts
src/lib/templates/__tests__/sendPayload.test.ts
src/lib/templates/__tests__/diff.test.ts
src/pages/app/modelos/__tests__/TemplatesPage.test.tsx
src/pages/app/modelos/__tests__/TemplateEditorPage.test.tsx
supabase/functions/create-whatsapp-template/index_test.ts
supabase/functions/sync-whatsapp-templates/index_test.ts
supabase/functions/whatsapp-webhook/template_status_test.ts
supabase/functions/upload-whatsapp-template-media/index_test.ts
supabase/functions/send-whatsapp/template_send_test.ts
```

## 5. Dependências entre fases

```text
Fase 0 (esta) ──► Fase 1 domínio puro (Seam 9)
                        │
                        ▼
                  Fase 2 serviço + páginas RTL (Seams 1, 2, 3)
                        │
                        ▼
                  Fase 3 edge functions (Seams 4, 5, 7, 8)
                        │
                        ▼
                  Fase 4 webhook + auditoria (Seam 6)
                        │
                        ▼
                  Fase 5 separação Superadmin ↔ Institucional (rota /superadmin/whatsapp)
```

## 6. Riscos identificados

1. **Ausência de `src/pages/superadmin/WhatsAppAdmin.tsx`**: a divisão institucional × superadmin exige criar o painel superadmin (não previsto no enunciado). Recomendo fazer isso na Fase 5 e por enquanto manter `WhatsAppSettings.tsx` como está.
2. **`upload-whatsapp-template-media` não existe** — o enunciado o cita como já existente. Precisa ser criado na Fase 3.
3. **`TemplateEditorDialog.tsx` tem 1057 linhas** — extração para `TemplateEditorForm` é necessária, mas exige cuidado para não regredir o wizard de 8 passos. Alternativa mais barata: manter o componente e apenas embrulhá-lo num route wrapper — descartada por dificultar RTL.
4. **RLS de `message_templates`**: precisa garantir que `equipe` não faça `insert/update`. Já há políticas — validar antes da Fase 2.
5. **Realtime channel `message_templates_realtime`** hoje está em `TemplatesTab.tsx`; migrar para `TemplatesPage` mantendo o mesmo `channel name` para evitar duplicação.
6. **Rotas legadas**: aba "Modelos" dentro de `/app/mensagens` deve virar redirect para `/app/modelos` para não quebrar deep links.

## 7. Decisão sobre `TemplateEditorDialog`

**Extrair** o corpo do wizard para `<TemplateEditorForm />` puro (props: `initialValue`, `mode: "create"|"edit"|"version"`, `onSubmit`, `onSaveDraft`, `readOnly`). O `Dialog` atual é removido depois que a página cheia estiver estável. Isso maximiza testabilidade RTL sem duplicar lógica.

## 8. Confirmação

Nenhum arquivo de código, migration ou teste foi criado ou modificado nesta fase. Aguardando confirmação explícita das seams antes de prosseguir para a Fase 1.
