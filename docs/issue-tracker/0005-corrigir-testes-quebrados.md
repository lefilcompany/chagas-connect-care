---
id: 0005
titulo: Corrigir testes unitários quebrados
status: aberto
tipo: bug
prioridade: alta
criado_em: 2026-07-10
atualizado_em: 2026-07-10
responsavel: null
relacionados: [0003, 0004]
adr: null
---

## Contexto

Ao habilitar o CI (issue 0003), `bun run test:unit` reportou **13
testes falhando de 53**, todos concentrados no slice de modelos de
mensagem (MessageTemplates / MessageTemplateEdit / MessageTemplateNew).

Enquanto isso não for zerado, **o job `unit` do CI bloqueia todo PR**,
conforme regra imposta em `AGENTS.md §14`.

## Arquivos afetados

- `src/pages/app/MessageTemplateEdit.test.tsx` — 1/3
- `src/pages/app/MessageTemplateEdit.status.test.tsx` — 3/3
- `src/pages/app/MessageTemplateNew.test.tsx` — 3/7
- `src/pages/app/MessageTemplates.test.tsx` — 6/11

## O que fazer

- Rodar cada arquivo isoladamente (`bun run test:unit -- <arquivo>`)
  e diagnosticar: mudou o contrato do slice? Mudou label de UI? Mudou
  guarda de rota / papel? Mudou mock necessário?
- Para cada falha, **decidir** entre:
  1. Corrigir o teste (se o teste está desatualizado em relação a um
     comportamento correto novo — documentar a razão no commit).
  2. Corrigir o código (se o teste ainda descreve o comportamento
     esperado e o código regrediu).
- Não desativar (`.skip` / `.todo`) sem abrir issue de dívida
  específica citando o motivo.
- Confirmar que os testes que hoje passam continuam passando.

## Critérios de aceitação

- [ ] `bun run test:unit` termina com **0 falhas** (todos os 53+ passando)
- [ ] Nenhum `it.skip` / `it.todo` novo sem issue vinculado
- [ ] Job `unit` do CI verde em PR de teste
- [ ] Testes Deno (`deno test supabase/functions/`) continuam verdes

## Fora de escopo

- Adicionar cobertura nova além dos testes já existentes.
- Refatorar o slice de modelos de mensagem além do necessário para
  destravar os testes.
- Corrigir erros de ESLint (ver issue 0004) — a menos que estejam no
  próprio arquivo de teste sendo editado.

## Notas

- Pode ser feito em paralelo com o issue 0004, desde que quem mexer
  em `MessageTemplate*.tsx` sincronize a intenção com o autor do
  outro PR.
