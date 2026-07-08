# Testes e CI/CD

Este documento descreve a estratégia executável de qualidade do repositório. A
decisão está no ADR [`0008`](adr/0008-adotar-ci-cd-com-testes-por-funcionalidade.md) e o trabalho inicial no issue [`0003`](issue-tracker/0003-configurar-ci-cd-e-testes.md).

---

## 1. Regra obrigatória para novas funcionalidades

Toda nova funcionalidade segue esta ordem:

1. criar ou atualizar o issue em `docs/issue-tracker/`;
2. criar o ADR antes do primeiro commit funcional;
3. registrar os arquivos em `tests/test-matrix.json`;
4. definir cenários unitários, integração mockada e E2E;
5. implementar;
6. criar/atualizar testes unitários;
7. criar/atualizar testes E2E;
8. executar lint, typecheck, cobertura, build e E2E;
9. concluir o issue somente depois do **Quality gate** verde.

Para bugs/refatorações locais, issue é obrigatório; ADR é obrigatório quando a
mudança altera decisão, contrato, domínio, segurança ou satisfaz a regra dos
três. A CI exige ADR em qualquer diff funcional para impedir introdução de
feature sem decisão documentada.

---

## 2. Eventos da pipeline

Workflow: `.github/workflows/ci-cd.yml`.

```yaml
pull_request: {}
push:
  branches: [main]
workflow_dispatch: {}
```

- qualquer PR roda, independentemente da branch de origem/destino;
- push direto ou merge na `main` roda novamente;
- execução manual permite diagnóstico;
- execuções obsoletas do mesmo PR/ref são canceladas.

O workflow usa `contents: read` e não acessa secrets de produção.

---

## 3. Jobs da CI

### 3.1 Governança e mapa de testes

- valida IDs, status e responsável dos issues;
- valida IDs/status dos ADRs;
- exige issue e ADR no diff funcional;
- verifica que issue/ADR precederam o código no histórico do PR;
- valida feature roots e edge functions conhecidas;
- exige mapeamento fonte → unitário → E2E;
- exige atualização de unitário e E2E quando uma funcionalidade muda.

```bash
npm run ci:governance
npm run ci:test-map
```

### 3.2 Lint e TypeScript

```bash
npm run lint
npm run typecheck
```

O typecheck cobre aplicação, configurações Node e testes.

#### Baseline de `no-explicit-any`

O código existente possui uso amplo de `any`. Ativar
`@typescript-eslint/no-explicit-any` como erro quebraria a CI por dívida anterior
e transformaria este PR em uma refatoração transversal de alto risco. Por isso:

- a regra permanece desativada no baseline;
- TypeScript, `no-undef`, hooks, sintaxe e demais regras continuam ativos;
- código novo deve evitar `any` e preferir `unknown`, tipos gerados, guards e
  contratos explícitos;
- a eliminação do legado deve ocorrer por issues incrementais;
- a regra só poderá ser reativada quando o inventário estiver corrigido ou por
  escopos/diretórios progressivos.

Isso é dívida controlada, não autorização para ampliar o uso.

### 3.3 Unitários por funcionalidade

Matriz separada:

- templates/medicações;
- audiências/destinatários;
- WhatsApp/lotes;
- identidade E2E;
- guards/papéis;
- jornadas;
- contratos de rotas;
- contratos de edge functions.

Cada item vira check independente e publica JUnit.

### 3.4 Cobertura

```bash
npm run test:coverage
```

| Métrica | Threshold inicial |
| --- | ---: |
| Statements | 45% |
| Branches | 35% |
| Functions | 45% |
| Lines | 45% |

Os limites são piso e devem subir progressivamente. Redução exige issue, ADR e
justificativa.

Artefatos: HTML, LCOV, JSON summary e JUnit.

### 3.5 Build

```bash
npm run build
```

Valida bundle Vite e publica `dist/` como `production-dist`.

### 3.6 E2E Playwright

Projetos Chromium:

| Projeto | Escopo |
| --- | --- |
| `public` | landing, auth, legais, anônimo e 404 |
| `institutional` | rotas/shell institucional |
| `superadmin` | operação transversal e proteção |
| `legacy` | redirects e bookmarks antigos |

Cada projeto:

- JUnit + HTML;
- screenshot somente em falha;
- vídeo retido em falha;
- trace no primeiro retry;
- retries na CI;
- falha em exceção JavaScript da página.

### 3.7 Quality gate

Consolida governança, análise estática, unitários, cobertura, build e E2E. Se
qualquer dependência não terminar com `success`, falha.

### 3.8 Artefato validado da `main`

Após push na `main` e Quality gate:

- baixa o bundle aprovado;
- cria `manifest.json` com SHA/run/timestamp;
- publica `validated-main-<sha>` por 30 dias.

É continuous delivery de artefato. A publicação efetiva continua no Lovable.

---

## 4. Comandos locais

```bash
npm install --no-audit --no-fund --legacy-peer-deps
npx playwright install chromium
```

O repositório possui `bun.lockb`, mas a alteração por conector não consegue
regenerar o binário. A CI usa `npm install` até a equipe versionar lockfile
atualizado; então deve migrar para instalação congelada.

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:coverage
npm run build
npm run test:e2e
npm run test:ci
```

Executar uma suíte:

```bash
npm run test:unit -- src/test/unit/templates.test.ts
npm run test:e2e -- --project=institutional
```

---

## 5. Ambiente E2E sintético

`.env.e2e` ativa exclusivamente:

```env
VITE_E2E_MOCK=true
```

Parâmetros:

- `__e2e_role=admin|equipe|superadmin`;
- `__e2e_auth=authenticated|anonymous`;
- `__e2e_institution=<slug-sintetico>`.

`src/lib/e2e.ts` cria sessão sintética. `AuthProvider` e `AccessProvider` só a
usam em modo E2E.

`tests/e2e/fixtures.ts` intercepta o host Supabase sintético e retorna REST,
Functions, Auth e Storage mockados. Nenhum teste de PR lê/escreve banco real.

É proibido usar nome, telefone, CPF, conteúdo clínico, token ou URL de produção
em fixture, trace, screenshot, vídeo ou JUnit.

---

## 6. Matriz de funcionalidades

Fonte: `tests/test-matrix.json`.

```json
{
  "id": "nome-estavel",
  "description": "...",
  "sources": ["src/features/exemplo/**"],
  "unitTests": ["src/test/unit/exemplo.test.ts"],
  "e2eTests": ["tests/e2e/institutional.spec.ts"]
}
```

Ao criar feature:

- cadastrar feature root/edge function;
- criar entrada ou ampliar existente;
- listar fontes;
- listar ao menos um unitário e um E2E;
- alterar esses testes no mesmo PR.

Cobertura por tipo:

- regra pura → unitário comportamental;
- hook/componente → Testing Library;
- rota/shell → contrato unitário + Playwright;
- edge function → helpers testáveis + contrato + integração protegida futura;
- RLS/migration → Supabase local/staging como alvo;
- integração externa → mock no PR + contract test protegido.

---

## 7. Política de testes

### Unitário

Não é aceito:

- `expect(true).toBe(true)`;
- teste que só importa;
- snapshot sem comportamento;
- mock que replica literalmente a implementação.

### E2E

Verificar caminho do usuário/contrato, incluindo quando aplicável:

- sucesso;
- autorização/papel;
- vazio/erro;
- redirect/compatibilidade;
- ausência de exceção JS.

### Integração

Mock não comprova contrato real. WhatsApp, Supabase, Storage e cron precisam de
suíte separada em ambiente protegido para mudanças de alto risco.

---

## 8. Branch protection recomendada

Em **Settings → Branches/Rulesets** para `main`:

- exigir PR;
- exigir branch atualizada;
- exigir aprovação;
- exigir resolução de conversations;
- bloquear force push/delete;
- exigir **Quality gate**;
- impedir bypass, exceto break-glass auditado.

O conector desta tarefa não oferece ação administrativa para rulesets; essa
ativação deve ser feita na interface do GitHub.

---

## 9. Secrets e ambiente futuro

A CI de PR não precisa de secrets.

Contract tests reais devem usar workflow separado, environment `staging`,
aprovações, tenant/número de teste, dados sintéticos e limpeza posterior.
Nunca usar `pull_request_target` para executar código não confiável com secrets.

---

## 10. Flakiness

1. consultar JUnit/trace/screenshot/vídeo;
2. reproduzir com o mesmo projeto;
3. corrigir causa/seletor/sincronização;
4. não usar timeout fixo como solução permanente;
5. não aumentar retries para esconder falha;
6. não usar skip/fixme sem issue, owner e prazo.

Seletores: role/name, label, texto estável, `data-testid`; nunca classe Tailwind.

---

## 11. Limitações conhecidas

- E2E usa backend mockado;
- RLS precisa de Supabase local/staging;
- edge functions têm baseline estrutural, não todos os handlers Deno;
- thresholds são moderados;
- instalação ainda não é congelada;
- Chromium é o browser obrigatório inicial;
- `no-explicit-any` permanece dívida controlada.

A matriz cria obrigação e baseline; a profundidade cresce a cada alteração.