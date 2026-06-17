## Visão geral

Transformar o conceito de "Modelo de mensagem" em **Objetivo** (ex.: Lembrete de medicação, Lembrete de consulta). Cada objetivo passa a ter **três variantes de corpo** — uma para Paciente, uma para Familiar/Cuidador e uma para Segmento. Quando o usuário escolhe o destinatário no envio, o texto da mensagem troca automaticamente, e a interface mostra claramente qual variante está sendo usada.

## Mudanças no banco

Migração única que:

1. Adiciona 3 colunas em `message_templates`:
   - `body_patient` text — corpo enviado quando destinatário = paciente
   - `body_contact` text — corpo enviado para familiar/cuidador/médico
   - `body_segment` text — corpo enviado em disparo segmentado
   - A coluna `body` existente fica como fallback (caso uma variante esteja em branco).
2. Renomeia a coluna interna: mantém `category` (compatível com pastas), mas **na UI** será chamada "Objetivo".
3. Apaga todos os modelos existentes (`DELETE FROM message_templates`).
4. Insere 9 objetivos padrão (`is_default = true`), cada um com as 3 variantes preenchidas:
   - Lembrete de medicação · Lembrete de consulta · Confirmação de recebimento · Acompanhamento de adesão · Cuidados de rotina · Boas-vindas · Aviso do ambulatório · Alimentação saudável · Orientação de saúde
   - O antigo "Mensagem para familiar/cuidador" deixa de existir — vira a variante `body_contact` dos demais.

Exemplo (Lembrete de medicação):
- Paciente: `Olá, {nome_paciente}. Lembrete da sua medicação: {medicacao}. Não esqueça do horário.`
- Familiar: `Olá, {nome_contato}. Você é responsável pelo cuidado de {nome_paciente}. Lembrete da medicação dele(a): {medicacao}.`
- Segmento: `Olá, {nome_destinatario}. Este é um lembrete coletivo sobre o uso correto da medicação: {medicacao}.`

## Mudanças no editor (TemplateEditorDialog)

- Título: "Novo objetivo de mensagem" / "Editar objetivo".
- Campo "Nome do modelo" → "Nome do objetivo".
- "Categoria" → "Pasta" (já vem das pastas de conteúdo).
- Etapa 2 ("Mensagem") ganha **3 abas** (Paciente, Familiar/Cuidador, Segmento). Cada aba tem seu próprio textarea + preview do WhatsApp. As variáveis sugeridas continuam funcionando para a aba ativa.
- Validação: pelo menos a variante "Paciente" precisa estar preenchida; as outras herdam dela se ficarem vazias.

## Mudanças no envio (UseTemplateDialog)

- Título: "Usar objetivo: {nome}".
- Ao escolher o destinatário no passo 1, a variante correspondente é selecionada automaticamente:
  - `patient` → `body_patient`
  - `contact` → `body_contact`
  - `segment` → `body_segment`
- Acima do preview (passos 2 e 3) aparece um **badge visível** indicando a variante ativa, ex.: `Variante: Familiar/Cuidador`. O usuário pode trocar a variante manualmente via um seletor compacto ao lado do badge se quiser sobrescrever.
- Variáveis detectadas e auto-preenchidas passam a vir da variante ativa.

## Mudanças no disparo segmentado / batches

- `CampaignTab` e `createBatch` (em `src/lib/whatsapp.ts`) escolhem `body_segment` por padrão quando há template; cai para `body_patient` ou `body` se faltar.
- `process-message-batch` (edge function) **não muda** — o `body` final já é renderizado no cliente antes de inserir as mensagens.

## Mudanças textuais na UI (renomeação)

| Onde aparece "Modelo" hoje | Vira |
|---|---|
| Aba "Modelos" da página Mensagens | "Objetivos" |
| Botão "Novo modelo" | "Novo objetivo" |
| "Usar modelo" | "Usar objetivo" |
| Resumo do envio: "Modelo:" | "Objetivo:" |
| Toasts "Modelo criado/atualizado" | "Objetivo criado/atualizado" |
| Cards de template | Mantêm visual, troca o rótulo |

Arquivos tocados na renomeação: `TemplatesTab.tsx`, `TemplateCard.tsx`, `TemplateEditorDialog.tsx`, `UseTemplateDialog.tsx`, `CampaignTab.tsx`, `Messages.tsx`.

## Detalhes técnicos

- Tipo `MessageTemplate` em `src/lib/templates.ts` ganha `body_patient`, `body_contact`, `body_segment` (todos opcionais para compatibilidade).
- Novo helper `pickVariant(template, mode): string` que devolve a variante certa com fallback em cadeia: variante pedida → `body_patient` → `body`.
- `queueAndSendFromTemplate` recebe um parâmetro `mode` e usa `pickVariant` para escolher o corpo. `extractVariables` roda sobre a variante escolhida.
- Sem mudança na edge function, sem mudança nas políticas RLS, sem mudança no schema das outras tabelas.

## Fora de escopo

- Não mexe na biblioteca de conteúdos (`content_library`).
- Não muda o fluxo da Meta (template aprovado continua sendo um único nome/idioma — variantes só valem para `template_kind = "internal"`; para `meta` as 3 abas ficam desabilitadas e só `body_patient` é usado).
