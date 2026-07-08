# Testes e CI/CD

Este documento descreve a estratégia executável de qualidade do repositório. A
decisão arquitetural está no ADR [`0008`](adr/0008-adotar-ci-cd-com-testes-por-funcionalidade.md) e o trabalho inicial no issue [`0003`](issue-tracker/0003-configurar-ci-cd-e-testes.md).

---

## 1. Regra obrigatória para novas funcionalidades

Toda nova funcionalidade segue esta ordem:

1. criar ou atualizar o issue em `docs/issue-tracker/`;
2. criar o ADR da funcionalidade/decisão antes do primeiro commit funcional;
3. registrar os arquivos do domínio em `tests/test-matrix.json`;
4. definir cenários unitários, integração mockada e E2E;
5. implementar;
6. criar/atualizar testes unitários;
7. criar/atualizar testes E2E;
8. executar lint, typecheck, cobertura, build e E2E;
9. concluir o issue somente depois do **Quality gate** verde.

Para bugs e refatorações locais, issue é sempre obrigatório; ADR é obrigatório
quando a mudança altera decisão, contrato, domínio ou satisfaz a regra dos três.
A CI exige ADR em qualquer diff funcional para impedir que uma feature seja
introduzida sem decisão documentada.

---

## 2. Eventos que executam a pipeline

Workflow: `.github/workflows/ci-cd.yml`.

```yaml
pull_request: {}
push:
  branches: [main]
workflow_dispatch: {}
```

Consequências:

- qualquer PR roda, independentemente da branch de origem ou destino;
- todo push direto ou merge na `main` roda novamente;
- execução manual permite diagnóstico;
- execuções antigas do mesmo PR/ref são canceladas por `concurrency`.

O workflow usa permissões mínimas (`contents: read`) e não acessa secrets de
produção.

---

## 3. Jobs da CI

### 3.1 Governança documental e mapa de testes

Executa antes dos demais jobs:

- valida IDs, status e responsável dos issues;
- valida IDs e status dos ADRs;
- exige issue e ADR no diff funcional;
- em PR, verifica se issue e ADR apareceram no histórico antes da primeira
  alteração funcional;
- valida se todo feature root e edge function está cadastrado;
- exige mapeamento de fonte → unitário → E2E;
- exige atualização de teste unitário e E2E quando uma funcionalidade mapeada é
  alterada.

Scripts:

```bash
npm run ci:governance
npm run ci:test-map
```

Variáveis usadas no Actions:

- `BASE_SHA`;
- `HEAD_SHA`;
- `GITHUB_EVENT_NAME`.

### 3.2 Lint e TypeScript

```bash
npm run lint
npm run typecheck
```

O typecheck cobre:

- aplicação (`tsconfig.app.json`);
- configs Node (`tsconfig.node.json`);
- testes unitários/E2E (`tsconfig.tests.json`).

### 3.3 Unitários por funcionalidade

GitHub Actions executa uma matriz separada:

- templates e medicações;
- audiências e destinatários;
- WhatsApp e lotes;
- identidade E2E;
- guards e papéis;
- jornadas;
- contratos de rotas;
- contratos de edge functions.

Cada item aparece como check separado e publica JUnit.

### 3.4 Cobertura

Executa a suíte completa com V8:

```bash
npm run test:coverage
```

Baseline inicial:

| Métrica | Threshold |
| --- | ---: |
| Statements | 45% |
| Branches | 35% |
| Functions | 45% |
| Lines | 45% |

Esses limites são piso, não objetivo. Devem subir gradualmente (“ratchet”) e
nunca ser reduzidos apenas para deixar um PR verde. Uma redução exige issue, ADR
e justificativa de dívida.

Artefatos:

- HTML;
- LCOV;
- JSON summary;
- JUnit.

### 3.5 Build de produção

```bash
npm run build
```

Valida bundling, imports, assets e transformação Vite. Publica `dist/` como
`production-dist`.

### 3.6 E2E Playwright

Quatro projetos Chromium independentes:

| Projeto | Escopo |
| --- | --- |
| `public` | landing, auth, documentos legais, proteção anônima e 404 |
| `institutional` | rotas e shell da instituição |
| `superadmin` | rotas e proteção da operação transversal |
| `legacy` | redirects e compatibilidade de bookmarks |

Cada projeto:

- gera JUnit e relatório HTML;
- guarda screenshot somente em falha;
- guarda vídeo em falha;
- cria trace no primeiro retry;
- possui duas tentativas adicionais na CI;
- falha se a página lançar exceção JavaScript.

### 3.7 Quality gate

Consolida:

- governança;
- lint/typecheck;
- unitários;
- cobertura;
- build;
- E2E.

Se qualquer dependência não terminar com `success`, o gate falha. Este é o check
principal recomendado para branch protection.

### 3.8 Artefato validado da `main`

Em push na `main`, depois do Quality gate:

- baixa `production-dist`;
- cria `manifest.json` com repositório, SHA, run e timestamp;
- publica `validated-main-<sha>` por 30 dias.

Isso é **continuous delivery do artefato**, não publicação direta. O deploy de
produção continua sob o fluxo Lovable já adotado no ADR 0001. Uma integração
direta futura exige contrato oficial, ambiente e novo ADR.

---

## 4. Comandos locais

### Instalação

```bash
npm install --no-audit --no-fund --legacy-peer-deps
npx playwright install chromium
```

O repositório possui `bun.lockb`, mas a alteração inicial de CI não consegue
regenerar binário pelo conector. Por isso o Actions usa `npm install`. A equipe
deve, em ambiente local, decidir e versionar um lockfile atualizado; após isso,
a CI deve migrar para instalação congelada (`npm ci` ou equivalente Bun).

### Qualidade rápida

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run build
```

### Cobertura

```bash
npm run test:coverage
```

### E2E

```bash
npm run test:e2e
npm run test:e2e:headed
npm run test:e2e:ui
```

### Pipeline completa local

```bash
npm run test:ci
```

### Um teste unitário

```bash
npm run test:unit -- src/test/unit/templates.test.ts
```

### Um projeto E2E

```bash
npm run test:e2e -- --project=institutional
```

---

## 5. Ambiente E2E sintético

Arquivo: `.env.e2e`.

O modo é ativado exclusivamente por:

```env
VITE_E2E_MOCK=true
```

O build normal não ativa esse comportamento.

### Autenticação e papéis

Parâmetros usados pelos testes:

- `__e2e_role=admin|equipe|superadmin`;
- `__e2e_auth=authenticated|anonymous`;
- `__e2e_institution=<slug-sintetico>`.

`src/lib/e2e.ts` cria usuário e sessão sintéticos. `AuthProvider` e
`AccessProvider` só usam esses dados quando o modo E2E está explicitamente
ligado.

### Backend

`tests/e2e/fixtures.ts` intercepta o host Supabase sintético e responde:

- REST com arrays/objetos vazios;
- functions com `{ ok: true }`;
- Auth sem sessão real;
- Storage vazio;
- CORS/OPTIONS adequados.

Nenhum teste de PR lê ou escreve banco real.

### Segurança dos artefatos

É proibido usar em fixtures:

- nomes ou identificadores reais;
- telefone/CPF real;
- conteúdo clínico real;
- access token, service role ou segredo Meta;
- URL de produção.

Traces, screenshots, vídeos e JUnit devem conter somente dados sintéticos.

---

## 6. Matriz de funcionalidades

Fonte: `tests/test-matrix.json`.

Cada entrada contém:

```json
{
  "id": "nome-estavel",
  "description": "...",
  "sources": ["src/features/exemplo/**"],
  "unitTests": ["src/test/unit/exemplo.test.ts"],
  "e2eTests": ["tests/e2e/institutional.spec.ts"]
}
```

### Ao criar uma funcionalidade

- adicione o novo feature root a `knownFeatureRoots`, quando aplicável;
- adicione edge function a `knownEdgeFunctions`;
- crie uma entrada funcional ou amplie uma existente;
- liste todos os arquivos de fonte relevantes;
- liste pelo menos um unitário e um E2E;
- altere esses testes no mesmo PR.

### Cobertura por tipo

- **regra pura:** teste unitário comportamental;
- **hook/componente:** teste com Testing Library e dependências mockadas;
- **rota/shell:** contrato unitário + Playwright;
- **edge function:** teste unitário de helpers quando extraíveis, contrato
  estrutural e teste de integração protegido quando existir ambiente;
- **RLS/migration:** testes com Supabase local/staging são o alvo; contratos
  estáticos não substituem execução real;
- **integração externa:** mock no PR e contract test separado com secrets.

---

## 7. Política de testes por funcionalidade

### Teste unitário obrigatório

Deve verificar regra, estado, erro ou contrato específico. Não é aceito:

- `expect(true).toBe(true)`;
- snapshot sem asserção de comportamento;
- teste que apenas importa o arquivo;
- mock que replica literalmente a própria implementação.

### E2E obrigatório

Deve verificar ao menos um caminho do usuário ou contrato de navegação da
funcionalidade. Para features críticas, cobrir:

- caminho principal;
- autorização/papel;
- vazio/erro;
- compatibilidade/redirect, quando houver;
- ausência de exceção JavaScript.

### Integração e contrato

Mock não comprova integração real. WhatsApp, Supabase, Storage e cron precisam
de suíte separada em ambiente protegido antes de mudanças de contrato ou
produção de alto risco.

---

## 8. Branch protection recomendada

Após o merge do workflow, configurar em **Settings → Branches ou Rulesets** para
`main`:

- exigir pull request;
- exigir branch atualizada antes do merge;
- exigir aprovação de review;
- exigir resolução de conversations;
- bloquear force push e delete;
- exigir o check **Quality gate**;
- opcionalmente exigir checks individuais para diagnóstico mais rígido;
- impedir bypass, exceto break-glass auditado;
- exigir linear history se for política do time.

O conector usado nesta tarefa não possui ação administrativa de branch
protection; portanto a regra precisa ser ativada na interface do GitHub.

---

## 9. Secrets e ambientes futuros

A CI de PR não precisa de secrets.

Um workflow separado de contrato/staging poderá usar:

- environment protegido (`staging`);
- approvals;
- secrets de staging;
- banco descartável ou tenant exclusivo;
- número WhatsApp de teste;
- dados totalmente sintéticos;
- limpeza após execução.

Nunca disponibilizar secrets de produção a PR de fork ou workflow não confiável.
Não usar `pull_request_target` para executar código do PR.

---

## 10. Flakiness e manutenção

Quando um teste falhar:

1. consultar JUnit, trace, screenshot e vídeo;
2. reproduzir localmente com o mesmo projeto;
3. corrigir causa, seletor ou sincronização;
4. não adicionar `waitForTimeout` como solução permanente;
5. não aumentar retries para esconder instabilidade;
6. não usar `.skip`/`.fixme` sem issue, owner e prazo;
7. teste flaky crítico bloqueia merge.

Seletores preferidos:

1. role + accessible name;
2. label;
3. texto estável;
4. `data-testid` quando não há semântica adequada;
5. nunca classe Tailwind como contrato E2E.

---

## 11. Limitações conhecidas do baseline

- E2E valida composição e navegação com backend mockado;
- testes de RLS ainda precisam de Supabase local/staging;
- contratos das edge functions incluem baseline estrutural, não cobertura de
  todos os handlers Deno;
- thresholds iniciais são moderados;
- `npm install` ainda não é instalação congelada;
- Chromium é o browser obrigatório inicial; Firefox/WebKit podem ser adicionados
  após definir suporte e custo.

Essas limitações são explícitas para evitar a falsa afirmação de que “todas as
funcionalidades estão completamente testadas”. A matriz cria a obrigação e o
baseline; a profundidade deve crescer a cada alteração.