## Objetivo

Renomear a variável `{nome_paciente}` para `{nome_destinatario}` (mais clara, pois pode representar paciente, familiar, cuidador ou médico) e garantir que, no envio, ela seja substituída automaticamente pelo nome do destinatário real de cada mensagem — em vez de um valor único definido manualmente para todos.

## Mudanças

### 1. Modelos existentes no banco (migration nova)
Atualizar todos os modelos pré-carregados na tabela `message_templates`:
- Trocar `{nome_paciente}` por `{nome_destinatario}` no campo `body`.
- Atualizar o array `variables` (jsonb) substituindo `"nome_paciente"` por `"nome_destinatario"`.
- Aplica-se às 10 linhas inseridas em `20260602141755_*.sql` (boas-vindas, orientação, medicação, aviso, lembrete consulta, recebimento, alimentação, rotina, orientação família, check-in semanal).

### 2. Catálogo de variáveis (`src/lib/templates.ts`)
- Substituir o item `nome_paciente` em `VARIABLE_SUGGESTIONS` por:
  - `{ key: "nome_destinatario", hint: "Nome do destinatário (paciente, familiar, cuidador, etc.)" }`
- Em `autofillVariables`, tratar `nome_destinatario` priorizando `ctx.contact?.full_name` e caindo para `ctx.patient?.full_name`.

### 3. Substituição por destinatário no envio (`src/lib/whatsapp.ts`)
- Em `createBatch`, hoje o body é renderizado uma única vez com `vars` globais. Mudar para renderizar **uma vez por destinatário**, mesclando `vars` com valores derivados do `Recipient`:
  - `nome_destinatario` ← `r.name` (já é o nome do paciente OU do contato selecionado, conforme o tipo).
- Em `queueAndSendFromTemplate`, aplicar o mesmo merge antes de chamar `renderTemplate`, usando o nome carregado do paciente/contato (ou recebendo-o como parâmetro opcional).
- O valor por-destinatário sempre vence o valor manual digitado na UI.

### 4. UI da campanha (`src/components/app/messages/CampaignTab.tsx`)
- Na etapa "Revisar", esconder `nome_destinatario` da lista de inputs manuais (será preenchido automaticamente).
- Exibir uma nota: "`{nome_destinatario}` será substituído automaticamente pelo nome de cada destinatário selecionado."
- Atualizar a `WhatsAppPreview` para passar `vars` incluindo `nome_destinatario: "Destinatário"` apenas para a pré-visualização.

### 5. UI de uso de modelo (`src/components/app/messages/UseTemplateDialog.tsx`)
- O `autofillVariables` atualizado já cobre `nome_destinatario`. Ajustar o input correspondente para usar o nome do destinatário escolhido (paciente ou contato) como valor padrão.

### 6. Placeholder do editor (`src/components/app/messages/TemplateEditorDialog.tsx`)
- Atualizar o `placeholder` do textarea de `{nome_paciente}` para `{nome_destinatario}`.

## Compatibilidade

- `{nome_paciente}` continuará funcionando como alias (qualquer body que ainda tenha `{nome_paciente}` será preenchido com o nome do destinatário) para não quebrar modelos criados pelo usuário antes da renomeação. Mesma regra para `{nome_contato}`.

## Detalhes técnicos

- A renderização por-destinatário em `createBatch` muda o `messages.body` armazenado para refletir o nome real de cada pessoa, o que já é o comportamento esperado no histórico.
- `message_batches.body` continua armazenando o template bruto (com placeholders) para auditoria.
- Nenhuma alteração em edge functions é necessária — a substituição acontece no cliente antes do `insert`.
