---
id: 0008
titulo: Adotar CI/CD com testes por funcionalidade
status: aceito
data: 2026-07-08
decisores: [equipe-do-projeto]
substitui: null
issue: 0003
---

## Contexto

O repositório não possui checks automatizados em pull requests nem em pushes na
`main`. Há Vitest configurado, mas apenas um teste trivial. Não existem testes
E2E, cobertura, validação de governança ou artefatos de diagnóstico.

Como o projeto lida com comunicação em saúde, autorização, RLS, automações e
integração WhatsApp, uma regressão pode causar indisponibilidade, vazamento entre
instituições, mensagens incorretas ou interrupção de jornadas. A pipeline
precisa bloquear merge quando qualidade mínima não for atendida e produzir
sinais claros por funcionalidade.

### Evidências

- scripts atuais: `lint`, `test`, `build`;
- ausência de `.github/workflows` ativo no head inicial do PR;
- `src/test/example.test.ts` testa apenas uma condição verdadeira;
- rotas e regras centrais estão distribuídas por domínios diferentes;
- deploy de produção é gerenciado pelo Lovable, fora deste workflow.

### Critérios de decisão

- rodar em qualquer PR, independentemente de base/head;
- rodar em push na `main`;
- não depender de dados ou segredos reais para testes de PR;
- separar falhas por categoria e funcionalidade;
- fornecer relatórios reproduzíveis;
- permitir evolução incremental de cobertura sem falsa promessa de completude;
- integrar com o deploy Lovable sem inventar mecanismo não suportado.

## Decisão

Adotamos GitHub Actions como orquestrador de CI/CD, com:

1. **governança:** issue, ADR e mapa de testes para mudanças funcionais;
2. **qualidade estática:** lint e TypeScript sem emissão;
3. **build:** build Vite de produção;
4. **unitários:** Vitest em matriz por funcionalidade;
5. **cobertura:** V8 com relatório e thresholds progressivos;
6. **E2E:** Playwright Chromium em projetos público, institucional,
   superadmin e legado;
7. **artefatos:** coverage, relatório/trace Playwright e bundle de produção;
8. **entrega contínua:** em push na `main`, produzir bundle validado; o Lovable
   continua responsável pela publicação efetiva.

Toda nova funcionalidade deve ser precedida por issue e ADR e, antes de ser
considerada concluída, incluir testes unitários e E2E mapeados na matriz da CI.

## Alternativas consideradas

### Um único job executando todos os comandos

- **Prós:** configuração curta.
- **Contras:** diagnóstico ruim, pouca paralelização e falha tardia.
- **Por que não foi escolhida:** o projeto precisa identificar rapidamente qual
  domínio quebrou.

### Apenas testes unitários

- **Prós:** rápidos e baratos.
- **Contras:** não validam rotas, providers, redirects, bundle e integração entre
  componentes.
- **Por que não foi escolhida:** não cobre regressões de navegação e composição.

### E2E conectado ao ambiente real

- **Prós:** maior fidelidade.
- **Contras:** flakiness, dados sensíveis, segredos indisponíveis em forks e
  efeitos reais.
- **Por que não foi escolhida como padrão de PR:** inseguro e não determinístico.
  Testes de contrato reais poderão existir em workflow separado e protegido.

### Deploy direto pelo GitHub Actions

- **Prós:** um único pipeline.
- **Contras:** não há contrato oficial/credencial de deploy Lovable disponível;
  criar webhook ou CLI presumida seria frágil.
- **Por que não foi escolhida:** a publicação existente permanece na plataforma;
  a CI produz o gate e o artefato verificável.

## Consequências

### Positivas

- merge pode ser protegido por checks obrigatórios;
- regressões são detectadas antes da `main`;
- falhas ficam segmentadas por funcionalidade;
- traces e relatórios facilitam diagnóstico;
- mocks evitam uso de dados reais;
- documentação e testes se tornam parte da Definition of Done.

### Negativas / trade-offs assumidos

- tempo e custo de execução aumentam;
- testes E2E mockados não comprovam contrato real com Supabase/Meta;
- manutenção da matriz é obrigatória;
- enquanto não houver lockfile textual atualizado, a instalação via `npm
  install` é menos determinística que `npm ci`;
- branch protection precisa ser configurada no GitHub após merge.

### Riscos residuais

- falso verde se mocks divergirem do backend real;
- cobertura numérica pode incentivar testes sem valor;
- rotas que apenas “abrem” ainda podem ter regras profundas não cobertas;
- testes podem ficar flaky se usarem seletores frágeis ou tempo fixo.

## Guard-rails e invariantes

- nenhum segredo ou dado clínico real em fixture, log, trace ou screenshot;
- E2E usa dados sintéticos e interceptação de rede;
- seletores priorizam papel, nome e `data-testid`, não classes CSS;
- teste novo é associado a uma funcionalidade no mapa;
- mudança funcional sem issue e ADR falha no check de governança;
- mudança funcional sem atualização de testes/matriz falha no check estrutural;
- testes de integração real ficam em workflow separado, com secrets e ambiente
  protegido;
- artifacts têm retenção limitada;
- workflows usam permissões mínimas e cancelamento de execuções obsoletas.

## Plano de adoção

1. adicionar scripts, dependências e configurações de Vitest/Playwright;
2. criar ambiente E2E mockado explicitamente por `VITE_E2E_MOCK`;
3. criar matriz de funcionalidades e validadores;
4. criar baseline de testes unitários e E2E;
5. adicionar workflow de CI/CD;
6. executar no PR e corrigir falhas;
7. após merge, configurar branch protection com checks obrigatórios;
8. evoluir cobertura e adicionar testes de contrato em ambiente protegido.

## Critério de revisão

Reavaliar quando:

- o deploy Lovable oferecer integração oficial de GitHub Actions;
- houver ambiente de staging estável para contratos reais;
- o projeto migrar de package manager ou lockfile;
- o tempo total de pipeline ultrapassar o limite operacional acordado;
- novos navegadores se tornarem requisito de suporte.

## Impacto

- Documentos: `AGENTS.md`, `CONTEXT.md`, README e `docs/testing-and-ci.md`.
- ADR relacionado: `0001` (backend/deploy Lovable).
- Issue: `0003`.
- Código: providers com modo E2E explícito, sem efeito fora do modo de teste.
- Operação: novos checks e artefatos no GitHub Actions.