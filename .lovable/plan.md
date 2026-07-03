## Objetivo

Deixar todas as prévias de modelos de mensagem com o visual da referência enviada (bolha branca com título em negrito, corpo, rodapé itálico em cinza, horário à direita e cada botão como um "card" branco separado abaixo da bolha, com ícone de seta para respostas rápidas e ícone de link externo para URLs). Aplicar em todos os locais onde a prévia aparece.

## Onde a prévia é usada

1. `src/components/app/messages/TemplateCard.tsx` — card do catálogo/editor (variant `compact`)
2. `src/components/app/messages/TemplateEditorForm.tsx` — editor (variant `full`)
3. `src/components/app/messages/UseTemplateDialog.tsx` — modal ao usar modelo
4. `src/components/app/messages/CampaignTab.tsx` — aba de campanha
5. `src/pages/app/WhatsAppSettings.tsx` — configurações WhatsApp

## Mudanças

### 1. `src/components/app/messages/WhatsAppPreview.tsx`
Reformular a bolha para bater com a referência, em ambas as variantes (`compact` e `full`):
- Fundo da bolha em branco (`bg-white dark:bg-zinc-900`) em vez de verde, com sombra sutil e cantos arredondados.
- Fundo do container mantendo o bege com padrão discreto do WhatsApp.
- Título (header) em negrito, cor forte, acima do corpo — usar `meta_header_text` do template quando existir; se não houver, cair para o `template.name` (ou nada na variante `full` quando não informado).
- Corpo em cinza escuro, `whitespace-pre-wrap`, com destaque de variáveis mantido.
- Rodapé em cinza claro, itálico, tamanho menor.
- Horário alinhado à direita, sem o "check" azul (ficar só o horário para casar com a referência).
- Botões renderizados como blocos brancos separados abaixo da bolha, cada um em sua própria linha, largura total da bolha, com divisórias sutis:
  - `quick_reply` → ícone `CornerUpLeft` (seta de resposta) + texto centralizado em verde.
  - `url` → ícone `ExternalLink` + texto verde.
  - `phone_number` → ícone `Phone` + texto verde.
  - `copy_code` → ícone `Copy` + texto verde.
- Buscar visual coeso entre `compact` (menor, dentro do card) e `full` (maior, no editor), mesma linguagem visual.

### 2. `src/lib/templates.ts`
Expor os campos que faltam no tipo `MessageTemplate` para permitir passar header e botões para a prévia em todos os lugares:
- `meta_header_text?: string | null`
- `meta_header_type?: string | null`
- `meta_buttons?: unknown` (array de botões conforme `TemplateDraftButton`)

### 3. `src/services/institutionTemplates.ts`
No mapeamento de linhas do banco para `MessageTemplate`, incluir `meta_header_text`, `meta_header_type` e `meta_buttons` (parse defensivo do JSON) para que a prévia tenha acesso.

### 4. `TemplateCard.tsx`
Passar `header={template.meta_header_text ?? template.name}` e `buttons={template.meta_buttons}` para `WhatsAppPreview`, além do `footer` que já é passado.

### 5. Editor, UseTemplateDialog, CampaignTab, WhatsAppSettings
Nos locais onde `WhatsAppPreview` é usado com dados do template/rascunho, passar também `header` e `buttons` (quando disponíveis) para que a prévia fique consistente em toda a plataforma.

## Detalhes técnicos

- Manter as props existentes de `WhatsAppPreview` (`header`, `footer`, `buttons`, `messageType`, `templateStatus`) — só ajustar a apresentação visual e adicionar novos ícones (`CornerUpLeft`, `Copy`) via `lucide-react`.
- Sem mudanças de dados/backend: só apresentação + surface dos campos já persistidos.
- Sem novas dependências.

## Fora de escopo

- Alterações no fluxo de submissão à Meta.
- Mudança de estrutura do card (badges, botões de ação continuam iguais).
- Ajustes no editor de botões.
