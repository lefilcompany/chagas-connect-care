## Reformular experiência de Modelos em /app/mensagens

Transformar a aba "Modelos" de um formulário técnico em uma biblioteca visual de cards estilo WhatsApp, com modelos prontos pré-cadastrados, fluxos guiados de uso/criação em etapas, e simplificação do envio segmentado.

---

### 1. Banco de dados (migração)

- Adicionar coluna `is_default boolean default false` em `message_templates`.
- Criar migração de seed que insere os 10 modelos default (Boas-vindas, Orientação de saúde, Lembrete de medicação, Aviso do ambulatório, Lembrete de consulta, Confirmação de recebimento, Alimentação saudável, Cuidados de rotina, Mensagem para familiar/cuidador, Acompanhamento de adesão) com:
  - `template_kind='internal'`, `meta_status='not_submitted'`, `is_default=true`, `is_active=true`, `institution=''` (compartilhados globalmente), `created_by=NULL`.
  - `variables` calculado a partir dos placeholders `{var}`.
- Atualizar política RLS de SELECT para também permitir leitura de modelos com `is_default=true` (globais) por qualquer usuário autenticado.
- Bloquear UPDATE/DELETE de modelos default (somente admin) — usuários comuns só podem duplicar.

### 2. Frontend — nova arquitetura de Modelos

Criar componentes em `src/components/app/messages/`:

- **`WhatsAppPreview.tsx`** — bolha verde estilo WhatsApp (header, balão, timestamp). Reutilizado em todos os fluxos.
- **`TemplateCard.tsx`** — card visual com preview WhatsApp em miniatura, nome, descrição, categoria, badges (tipo + status), botões `Usar modelo` / `Editar` / `Duplicar`. Card especial "Começar em branco" estilizado.
- **`TemplateLibrary.tsx`** — grid responsivo de cards (substitui o TemplatesTab atual). Filtros por categoria e busca por nome.
- **`TemplateEditorDialog.tsx`** — fluxo guiado em 4 etapas (Stepper):
  1. Básico: nome, categoria, descrição, tipo de modelo (radio "Modelo interno" / "Template Meta" com explicações em linguagem simples).
  2. Mensagem: textarea grande, preview WhatsApp ao lado, lista de variáveis detectadas, chips de exemplos `{nome_paciente}` etc. (clicáveis para inserir).
  3. Segmentação padrão (opcional): reusa `SegmentFiltersForm`.
  4. Salvar: botões "Salvar modelo" e "Salvar e usar agora".
  - Seção colapsável "Configurações da Meta" só aparece se tipo = Template Meta.
- **`UseTemplateDialog.tsx`** — fluxo guiado em 3 etapas para envio:
  1. Destinatário: radio Paciente / Familiar-Cuidador-Médico vinculado / Segmento. Selects dependentes (paciente → contatos).
  2. Variáveis: campos amigáveis para cada variável detectada, com auto-preenchimento de `{nome_paciente}`, `{nome_contato}`, próxima `{data_consulta}` e `{medicacao}` quando disponíveis.
  3. Revisar: preview WhatsApp final + destinatário + canal + aviso + botão "Enviar mensagem".
  - Em modo Segmento, redireciona para a aba "Envio segmentado" pré-preenchida.

### 3. Aba "Envio segmentado" — simplificação

Refatorar `CampaignTab.tsx` para usar Stepper com 5 etapas:
1. Escolher modelo (mesma biblioteca de cards, modo seleção).
2. Escolher público (reusa `SegmentFiltersForm` existente com todos os filtros: etapa, cidade, estado, status, canal, instituição, idade min/max).
3. Prévia de destinatários (reusa `RecipientPreview`) com checkbox para remover.
4. Revisar mensagem (preview WhatsApp + variáveis preenchidas).
5. Confirmar envio → chama `createBatch` (já existente em `whatsapp.ts`).

### 4. Helpers

- `src/lib/templateSeeds.ts` — definição TS dos 10 modelos default (referência apenas; insertados via migração).
- `src/lib/templates.ts` — adicionar helper `autofillVariables(template, { patient, contact, medications })` que detecta `nome_paciente`, `nome_contato`, `medicacao`, `data_consulta` etc.

### 5. Edge functions

Nenhuma mudança. `send-whatsapp` e `process-message-batch` já cobrem o fluxo.

### 6. Compatibilidade

- `Messages.tsx` mantém as abas Histórico / Modelos / Envio segmentado, apenas troca o conteúdo de Modelos e Envio segmentado pelos novos componentes.
- Tipo `is_default` adicionado ao tipo `MessageTemplate` em `src/lib/templates.ts`.

### Arquivos a criar/editar

**Criar:**
- Migração SQL (coluna `is_default` + seed dos 10 modelos + ajuste de RLS).
- `src/components/app/messages/WhatsAppPreview.tsx`
- `src/components/app/messages/TemplateCard.tsx`
- `src/components/app/messages/TemplateLibrary.tsx`
- `src/components/app/messages/TemplateEditorDialog.tsx`
- `src/components/app/messages/UseTemplateDialog.tsx`
- `src/lib/templateSeeds.ts` (referência TS, opcional)

**Editar:**
- `src/components/app/messages/TemplatesTab.tsx` → vira wrapper de `TemplateLibrary`.
- `src/components/app/messages/CampaignTab.tsx` → fluxo em 5 etapas.
- `src/lib/templates.ts` → adicionar `is_default` ao tipo + helper `autofillVariables`.
- `src/pages/app/Messages.tsx` (ajustes mínimos se necessário).

### Fora de escopo

- Submissão real de templates à Meta (apenas armazenamos `meta_status`).
- Janela de 24h, agendamento, mídia.
- Histórico de versões de modelos.
