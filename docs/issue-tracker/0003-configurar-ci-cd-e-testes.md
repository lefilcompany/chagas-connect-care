---
id: 0003
titulo: Configurar CI/CD e testes por funcionalidade
status: em-andamento
tipo: feature
prioridade: alta
criado_em: 2026-07-08
atualizado_em: 2026-07-08
responsavel: openai-codex
relacionados: [0002]
adr: 0008
---

## Contexto

O repositório possui Vitest e Testing Library, mas não possui workflow ativo de
GitHub Actions, cobertura configurada nem Playwright. O único teste existente é
um exemplo trivial. Assim, pull requests podem introduzir erro de lint, build,
regressão unitária, quebra de rota ou falha de integração sem bloqueio
automatizado.

A entrega precisa rodar para:

- todo evento `pull_request`, independentemente das branches de origem e destino;
- todo `push` na branch `main`;
- execução manual para diagnóstico.

O pipeline deve separar falhas por funcionalidade, guardar relatórios e garantir
que novas funcionalidades venham acompanhadas de issue, ADR e testes.

## O que fazer

- Criar ADR da estratégia de CI/CD e testes.
- Configurar GitHub Actions para governança, lint, typecheck, build, testes
  unitários, cobertura e E2E.
- Adicionar Playwright com ambiente E2E determinístico e sem dependência de
  dados reais ou segredos.
- Criar testes unitários para regras centrais de templates, audiências,
  WhatsApp, autenticação/autorização e navegação.
- Criar testes E2E de rotas públicas, aplicação institucional, superadmin e
  compatibilidade de rotas legadas.
- Criar mapa de funcionalidades para testes e validação automática de cobertura
  estrutural.
- Produzir artefato de build em pushes na `main`, mantendo o deploy de produção
  sob a integração Lovable já existente.
- Atualizar `AGENTS.md`, `CONTEXT.md`, README e documentação de testes.

## Evidências

- `package.json` possui `lint`, `test` e `build`, mas não `typecheck`, cobertura
  ou E2E.
- `vitest.config.ts` cobre apenas `src/**/*.{test,spec}.{ts,tsx}`.
- `src/test/example.test.ts` testa apenas `expect(true).toBe(true)`.
- Não há workflow associado ao head inicial do PR #9.
- `src/App.tsx` expõe rotas públicas, institucionais, superadmin e legadas.
- `src/lib/templates.ts`, `src/lib/segments.ts` e `src/lib/whatsapp.ts` concentram
  regras testáveis de domínio e integração.

## Critérios de aceitação

- [ ] Workflow roda em qualquer PR e em push na `main`.
- [ ] Jobs separados para governança, lint/typecheck, build, unitários,
      cobertura e E2E.
- [ ] Playwright gera relatório, trace, screenshot e vídeo em falha.
- [ ] Testes unitários são executados em matriz por funcionalidade.
- [ ] E2E cobre rotas públicas, app institucional, superadmin e redirects
      legados em ambiente mockado.
- [ ] Artefatos de cobertura, Playwright e build são publicados no Actions.
- [ ] Mudança funcional sem issue, ADR ou mapeamento de testes falha na CI.
- [ ] `AGENTS.md` exige issue e ADR antes de nova funcionalidade e unit/E2E ao
      final.
- [ ] Documentação explica comandos locais, segredos, branch protection,
      manutenção e limitações.
- [ ] PR #9 atualizado com o novo escopo.

## Fora de escopo

- Alterar o provedor de deploy do Lovable.
- Usar dados clínicos ou credenciais reais em testes.
- Declarar cobertura comportamental completa de integrações externas sem
  ambiente sandbox.
- Configurar branch protection por API, pois não há ferramenta de administração
  de regras do repositório disponível nesta sessão; a configuração necessária
  será documentada.

## Riscos e impactos

- **Domínio:** testes podem consolidar comportamento ainda não decidido; somente
  regras comprovadas serão tratadas como canônicas.
- **Segurança/privacidade:** artefatos E2E não devem conter dados ou tokens reais.
- **Dados/migration:** nenhuma alteração de schema nesta entrega.
- **Integrações/operação:** Playwright usará mocks de Supabase/Meta; testes de
  contrato real permanecem separados.
- **Compatibilidade:** dependências de teste e scripts precisam funcionar em
  Node LTS no GitHub Actions.

## Validação

- [ ] Revisar sintaxe dos workflows e scripts.
- [ ] Rodar pipeline no próprio PR.
- [ ] Verificar jobs e artefatos do GitHub Actions.
- [ ] Corrigir falhas até todos os checks ficarem verdes.

## Notas

- A pipeline seguirá as recomendações oficiais do Playwright para instalação do
  navegador e upload do relatório.
- Como o repositório possui `bun.lockb` não atualizado nesta sessão e não há
  ferramenta para gerar binário, a CI utilizará `npm install` até a equipe
  regenerar e versionar um lockfile textual ou atualizar o lock Bun localmente.
- A etapa de entrega contínua produzirá artefato validado em `main`; a publicação
  continua sendo feita pela integração Lovable do projeto.