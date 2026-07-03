## Problema

Na tela `/app/modelos` (catálogo), os cards de rascunho mostram apenas "Usar modelo" (desabilitado) e "Ainda não sincronizado". Não há botão para editar nem para enviar à Meta — o botão "Enviar para aprovação" só existe no editor `/app/modelos/:id`, mas o card do catálogo não expõe atalho para chegar lá. Além disso, drafts antigos (criados antes do auto-preenchimento de variáveis) foram salvos com `meta_variable_examples` vazio e o edge function `create-whatsapp-template` retorna `TEMPLATE_INVALID` exigindo um exemplo por variável.

## O que vou entregar

### 1. Ações no card do catálogo (admins)
Em `src/components/app/messages/TemplateCard.tsx` + `src/pages/app/MessageTemplates.tsx`, para templates Meta em rascunho (`meta_status = 'not_submitted'`) e usuário admin:
- Botão **"Editar"** (abre `/app/modelos/:id`).
- Botão **"Enviar para Meta"** que dispara `service.submitToMeta(id)` direto, com toast de sucesso/erro (reaproveita as mensagens de erro já melhoradas).
- Para status `error`, botão vira **"Reenviar"**.
- Continua escondendo essas ações para não-admins.

### 2. Backfill automático de exemplos ao submeter
Em `src/services/institutionTemplates.ts`, antes de chamar `create-whatsapp-template`:
- Extrair variáveis do `body` (`extractSemanticKeys`).
- Se `meta_variable_examples[k]` estiver vazio, preencher com o `example` semântico (`getSemanticVariable(k).example`) e persistir via `updateDraft`.
- Assim tanto envio pelo catálogo quanto reenvio de drafts antigos funcionam sem exigir reabrir o editor.

### 3. Limpeza do lookup de WABA
Em `supabase/functions/create-whatsapp-template/index.ts`, remover o `select("waba_id")` de `institution_whatsapp_settings` (coluna não existe — sempre erra silenciosamente) e usar diretamente `WHATSAPP_WABA_ID` do ambiente. Mantém compatibilidade com o secret já configurado.

### 4. Feedback visual
- Toast já melhorado no turno anterior mostra erros específicos ("Informe um exemplo para {nome_paciente}"), mas com o backfill esses casos deixam de acontecer.
- Card mostra `meta_status` em tempo real (realtime já assinado no editor; adicionarei `invalidateQueries` no catálogo após submit).

## Fora do escopo
- Configurar novo WABA por instituição (segue usando env fallback).
- Alterar o wizard de criação de modelos.
- Mudanças no fluxo de aprovação/rejeição via webhook (já funciona).

## Verificação
- Clicar "Enviar para Meta" no card do "Teste de Mensagem" → toast de sucesso, badge muda para "Em análise".
- Testar reenvio de draft com `meta_status = 'error'`.
- Confirmar via `curl` no edge function que retorna 200 com `meta_template_id`.
