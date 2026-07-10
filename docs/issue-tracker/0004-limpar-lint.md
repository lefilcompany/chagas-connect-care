---
id: 0004
titulo: Limpar erros de ESLint acumulados
status: aberto
tipo: chore
prioridade: alta
criado_em: 2026-07-10
atualizado_em: 2026-07-10
responsavel: null
relacionados: [0003]
adr: null
---

## Contexto

Ao habilitar o CI (issue 0003), `bun run lint` reportou **424 erros e
28 warnings**. A grande maioria é `@typescript-eslint/no-explicit-any`
em código de aplicação, testes e helpers de edge functions; há também
1 `@typescript-eslint/no-require-imports` em `tailwind.config.ts` e
alguns `react-hooks/exhaustive-deps` legítimos.

Enquanto isso não for zerado, **o job `lint` do CI bloqueia todo PR**,
conforme regra imposta em `AGENTS.md §14`.

## O que fazer

- Tipar corretamente cada `any` (tipos do domínio, schemas Zod ou
  types auto-gerados de Supabase). Onde tipo real não fizer sentido,
  usar `unknown` + narrowing.
- Corrigir `require()` em `tailwind.config.ts` para `import`.
- Rodar `bun run lint -- --fix` primeiro (resolve ~8) e iterar.
- Revisar cada `react-hooks/exhaustive-deps` — corrigir a dependência
  ou justificar com `// eslint-disable-next-line` + comentário curto
  (não silenciar em massa).
- Priorizar por diretório: `supabase/functions/_shared/*`,
  `src/features/*`, `src/pages/app/*`, `src/lib/*`, testes por último.

## Critérios de aceitação

- [ ] `bun run lint` termina com **0 erros**
- [ ] Nenhum `// eslint-disable*` novo sem comentário justificando
- [ ] Job `lint` do CI verde em PR de teste
- [ ] Sem regressão nos testes unitários (`bun run test:unit`)

## Fora de escopo

- Corrigir testes quebrados (ver issue 0005).
- Trocar regras do ESLint ou desativar checks — o objetivo é
  **conformar o código à regra**, não afrouxar a regra.
- Refatorar componentes além do necessário para tipar.

## Notas

- Pode ser fatiado em sub-PRs por diretório para revisão gradual, mas
  o issue só fecha quando o total chegar a zero.
