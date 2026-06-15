## Objetivo

Permitir:
1. Segmentar campanhas para **familiares (ou cuidadores/médicos) de pacientes específicos**, não só "todos os familiares".
2. Enviar uma mensagem (com ou sem modelo) para **um ou mais contatos** de um paciente, direto da ficha dele.

A camada de dados já suporta `patient_ids` no `SegmentFilters` e `resolveRecipients` já aplica esse filtro. As mudanças são quase todas de UI e de fluxo no diálogo de envio.

## Mudanças

### 1. `SegmentFiltersForm` — novo campo "Pacientes específicos"
- Adiciona um `MultiSelect` (ou Command com busca) carregando todos os pacientes acessíveis (`patients` ordenados por nome).
- Vincula em `filters.patient_ids`. Quando vazio, comportamento atual (todos).
- Aparece no topo do form, com texto auxiliar: "Restringe o universo aos pacientes selecionados e seus contatos".
- Usado automaticamente em: CampaignTab, TemplateEditorDialog (aba Segmentação) e SegmentEditor — não precisam de código novo.

### 2. CampaignTab — atalho de "pacientes específicos"
- Acima dos filtros, um botão "Restringir a pacientes específicos" que pré-foca o novo seletor (mesmo campo do form), apenas como atalho visual.
- Nada novo na lógica: usa o mesmo `filters.patient_ids` que o form preenche.

### 3. `UseTemplateDialog` — modo "contato" passa a ser multi-seleção
- Renomeia internamente `contactId: string` para `contactIds: string[]`.
- No passo 0, quando `mode === "contact"`:
  - Mantém o select de paciente (1).
  - Substitui o select único de contato por uma lista de contatos do paciente, cada um com checkbox + nome + relação + telefone.
  - Mostra contagem ("3 contatos selecionados").
- Variáveis (passo 1): se houver placeholders dependentes do contato (`{contato_nome}` etc.), o auto-fill usa o **primeiro** contato como referência. Adiciona aviso "Variáveis dependentes do contato serão preenchidas individualmente no envio".
- Revisão (passo 2): lista os destinatários (até 5 + "e mais X") e o total.
- Envio: faz um loop por contato chamando `queueAndSendFromTemplate` com `contact_id` e re-rodando `autofillVariables` por contato (para preservar `{contato_nome}` correto).
- Telemetria: toast final "X mensagens enviadas, Y falhas" quando houver mais de um.

### 4. Botão "Enviar mensagem" na ficha do paciente (`PatientDetail`)
- Adiciona um `DropdownMenu` no header da ficha com duas ações:
  - **Enviar ao paciente** → abre `UseTemplateDialog` com `mode="patient"`, paciente travado, modelo opcional.
  - **Enviar a familiares** → abre `UseTemplateDialog` com `mode="contact"`, paciente travado, multi-seleção de contatos.
- Para suportar isso, `UseTemplateDialog` ganha props opcionais:
  - `lockedPatientId?: string` — quando setado, esconde o select de paciente e força esse id.
  - `initialMode?: Mode` — define o modo inicial e oculta os outros cartões (opcional). Quando vier `lockedPatientId`, o cartão "Segmento" é ocultado.
- `template` passa a aceitar `null` com fluxo de "mensagem livre" simples: novo campo de textarea no passo 1 quando não há modelo. (Se preferir manter obrigatório modelo, removo esse pedaço — pergunto se aparecer dúvida.)

### 5. Pequenos ajustes
- `qk` ganha (se não existir) chave para invalidar `dialog-contacts` ao mudar paciente.
- `Recipient` e `resolveRecipients`: nenhuma mudança necessária.
- Testes manuais nos cenários: (a) campanha para familiares de 2 pacientes, (b) ficha → enviar a 3 familiares, (c) modelo salvo com `patient_ids` selecionado.

## Detalhes técnicos

- Componente novo `PatientMultiSelect` (em `src/components/app/PatientMultiSelect.tsx`) reutilizado pelo `SegmentFiltersForm` e pelo `CampaignTab`. Carrega via `qk.patients`.
- `UseTemplateDialog`: refactor pequeno, isolado. Loop de envio sequencial (não paralelo) para não estourar rate-limit do WhatsApp; cada chamada usa `await`.
- `PatientDetail`: importa `UseTemplateDialog`, gerencia `open` e `initialMode` localmente.

## Arquivos

- `src/components/app/PatientMultiSelect.tsx` (novo)
- `src/components/app/SegmentFilters.tsx`
- `src/components/app/messages/CampaignTab.tsx`
- `src/components/app/messages/UseTemplateDialog.tsx`
- `src/pages/app/PatientDetail.tsx`

Sem migrações, sem mudanças em edge functions.
