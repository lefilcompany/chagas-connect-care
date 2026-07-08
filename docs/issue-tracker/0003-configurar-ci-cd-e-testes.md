---
id: 0003
titulo: Configurar CI/CD e testes por funcionalidade
status: concluido
tipo: feature
prioridade: alta
criado_em: 2026-07-08
atualizado_em: 2026-07-08
responsavel: openai-codex
relacionados: [0002]
adr: 0008
---

## Contexto

O repositório possuía Vitest e Testing Library, mas não tinha workflow ativo,
cobertura, Playwright ou testes comportamentais suficientes. Pull requests
podiam introduzir regressões de lint, tipos, build, rotas, autorização e fluxos
sem bloqueio automatizado.

A entrega precisava rodar para:

- qualquer evento `pull_request`, independentemente das branches;
- todo `push` na `main`;
- execução manual para diagnóstico.

## O que foi feito

- Criado ADR `0008` para estratégia de CI/CD e testes.
- Criado workflow `.github/workflows/ci-cd.yml`.
- Adicionados jobs de governança, lint, typecheck, unitários, cobertura, build,
  E2E, Quality gate e artefato validado da `main`.
- Adicionado Playwright com ambiente sintético sem dados ou segredos reais.
- Criadas oito suítes unitárias para templates, audiências, WhatsApp, acesso,
  jornadas, rotas e contratos de edge functions.
- Criados quatro projetos E2E: público, institucional, superadmin e legado.
- Criada matriz de 16 funcionalidades em `tests/test-matrix.json`.
- Criados validadores de issue/ADR e atualização de testes.
- Atualizados `AGENTS.md`, `CONTEXT.md`, README e `docs/testing-and-ci.md`.
- Corrigidos dois erros reais de lint em componentes-base sem alterar contrato.
- Documentada a dívida controlada de `no-explicit-any` no código legado.

## Evidências iniciais

- `package.json` possuía apenas `lint`, `test` e `build`.
- `src/test/example.test.ts` testava somente uma condição verdadeira.
- Não havia workflow associado ao head inicial do PR #9.
- `src/App.tsx` expõe rotas públicas, institucionais, superadmin e legadas.
- `src/lib/templates.ts`, `src/lib/segments.ts` e `src/lib/whatsapp.ts`
  concentram regras reutilizadas.

## Critérios de aceitação

- [x] Workflow roda em qualquer PR e em push na `main`.
- [x] Jobs separados para governança, lint/typecheck, build, unitários,
      cobertura e E2E.
- [x] Playwright gera relatório, trace, screenshot e vídeo em falha.
- [x] Testes unitários são executados em matriz por funcionalidade.
- [x] E2E cobre rotas públicas, app institucional, superadmin e redirects
      legados em ambiente mockado.
- [x] Artefatos de cobertura, Playwright, análise estática e build são
      publicados no Actions.
- [x] Mudança funcional sem issue, ADR ou mapeamento de testes falha na CI.
- [x] `AGENTS.md` exige issue e ADR antes de nova funcionalidade e unit/E2E ao
      final.
- [x] Documentação explica comandos locais, dados sintéticos, secrets, branch
      protection, manutenção e limitações.
- [x] PR #9 incorpora o escopo de documentação, CI/CD e testes.

## Fora de escopo

- Alterar o provedor de deploy do Lovable.
- Usar dados clínicos ou credenciais reais em testes.
- Declarar cobertura comportamental completa de integrações externas sem
  ambiente sandbox.
- Configurar branch protection por API; a configuração manual está documentada.

## Riscos e impactos

- **Domínio:** testes consolidam apenas regras comprovadas; questões abertas não
  viraram comportamento canônico.
- **Segurança/privacidade:** E2E usa dados sintéticos e interceptação de rede.
- **Dados/migration:** nenhuma alteração de schema.
- **Integrações/operação:** mocks de PR não substituem contract tests reais.
- **Compatibilidade:** execução validada em Node 22 no GitHub Actions.
- **Tipagem:** `no-explicit-any` permanece desativado como dívida pré-existente,
  enquanto typecheck e demais regras continuam bloqueantes.

## Validação

- [x] Sintaxe e execução dos workflows validadas no próprio PR.
- [x] Governança documental e test matrix aprovadas.
- [x] ESLint e TypeScript aprovados.
- [x] Oito suítes unitárias aprovadas.
- [x] Cobertura V8 e thresholds aprovados.
- [x] Build Vite de produção aprovado e publicado como artefato.
- [x] E2E público, institucional, superadmin e legado aprovados.
- [x] Quality gate aprovado no GitHub Actions run `28945649170` (#20).
- [x] Relatórios JUnit, cobertura, análise estática e Playwright publicados.

## Notas

- O trace do Playwright detectou que variáveis globais da CI tinham precedência
  sobre `.env.e2e`; o interceptor foi tornado independente do hostname
  sintético.
- `bun.lockb` não foi regenerado pelo conector. A CI usa `npm install` até a
  equipe versionar um lockfile atualizado e migrar para instalação congelada.
- A entrega contínua produz bundle e manifesto validados em `main`; a publicação
  continua sendo feita pelo Lovable.
- A arquitetura de CI e a separação entre GitHub Actions e deploy Lovable estão
  detalhadas em `docs/testing-and-ci.md` e ADR `0008`.
- Ruleset recomendado: exigir PR, reviews, conversations resolvidas e o check
  **Quality gate** para a `main`.