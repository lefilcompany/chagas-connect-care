# Testes e CI/CD

Este documento descreve a estratégia executável de qualidade do repositório.
As decisões principais estão nos ADRs [`0008`](adr/0008-adotar-ci-cd-com-testes-por-funcionalidade.md)
e [`0009`](adr/0009-adotar-e2e-funcional-com-supabase-local.md).

---

## 1. Definition of Done para funcionalidades

Toda nova funcionalidade segue esta ordem:

1. criar ou atualizar o issue em `docs/issue-tracker/`;
2. criar ou atualizar o ADR antes do primeiro commit funcional;
3. registrar fontes, unitários e E2E na matriz de testes;
4. implementar a menor mudança completa;
5. adicionar ou atualizar testes unitários;
6. adicionar ou atualizar E2E funcional;
7. executar governança, lint, TypeScript, cobertura, build e E2E;
8. concluir o issue somente depois do **Quality gate** verde.

Para bugs e refatorações, issue continua obrigatório. ADR é exigido quando a
mudança altera decisão, contrato, domínio, segurança ou satisfaz a regra dos
três.

---

## 2. Eventos da pipeline

Workflow: `.github/workflows/ci-cd.yml`.

```yaml
pull_request: {}
push:
  branches: [main]
workflow_dispatch: {}
```

- qualquer pull request executa a pipeline;
- merge ou push na `main` executa novamente;
- execução manual serve para diagnóstico;
- runs obsoletos do mesmo PR ou ref são cancelados;
- o workflow usa somente `contents: read`.

---

## 3. Jobs obrigatórios

### 3.1 Governança documental e mapa de testes

```bash
npm run ci:governance
npm run ci:test-map
```

A validação:

- confere IDs, status e responsáveis de issues;
- confere IDs e status dos ADRs;
- exige issue e ADR para mudanças funcionais;
- verifica a ordem issue/ADR antes da implementação no histórico do PR;
- valida feature roots e edge functions conhecidas;
- exige fonte, unitário e E2E mapeados;
- inclui migrations, grants, triggers, constraints e RLS na governança.

Matrizes:

- `tests/test-matrix.json` — aplicação e Edge Functions;
- `tests/test-matrix.database.json` — migrations e isolamento do banco.

### 3.2 Análise estática

```bash
npm run lint
npm run typecheck
```

O typecheck cobre aplicação, testes, Playwright e configurações TypeScript.
Relatórios do ESLint e do typecheck são publicados como artifact mesmo em falha.

`@typescript-eslint/no-explicit-any` permanece desativado no baseline por dívida
legada. Código novo deve preferir tipos explícitos e `unknown`.

### 3.3 Unitários

As suítes cobrem:

- templates e medicações;
- audiências e destinatários;
- WhatsApp e lotes;
- sessão, acesso e guards;
- jornadas e rotas;
- contratos de Edge Functions;
- contratos críticos das migrations.

Os testes de migrations validam, entre outros pontos:

- grants do `service_role`;
- segurança de backfills em banco vazio;
- proteção para tabelas históricas opcionais;
- convenção e presença de migrations versionadas.

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

Os limites são piso. Redução exige issue e justificativa explícita.

### 3.5 Build

```bash
npm run build
```

O bundle Vite é publicado como `production-dist` quando o job conclui.

### 3.6 E2E funcional

```bash
npm run test:e2e
```

O runner:

1. inicia Supabase local em Docker;
2. executa `supabase db reset` em banco limpo;
3. aplica todas as migrations reais;
4. cria usuários e fixtures exclusivamente sintéticas;
5. autentica um superadmin real para preparar instituições sem desativar o
   trigger de proteção;
6. inicia Edge Functions locais;
7. constrói e serve a aplicação apontando para o backend local;
8. executa Playwright;
9. encerra Supabase sem preservar o banco.

Projetos Chromium:

| Projeto | Escopo |
| --- | --- |
| `public` | landing, autenticação, páginas legais, onboarding e 404 |
| `institutional` | shell e rotas da instituição |
| `superadmin` | papel real e operação transversal |
| `legacy` | redirects e bookmarks antigos |
| `auth-setup` | login real e storage states |

Os E2E validam:

- login e sessão reais;
- perfis e papéis persistidos;
- leitura e mutation no Postgres;
- RLS same-tenant e cross-tenant;
- superadmin real;
- onboarding por Edge Function local;
- ausência de exceções JavaScript na página.

O Playwright publica JUnit, HTML, screenshots, vídeos e traces de falha.

### 3.7 Quality gate

O check **Quality gate** consolida:

- governança;
- análise estática;
- unitários;
- cobertura;
- build;
- E2E funcional.

Qualquer resultado diferente de `success` bloqueia o gate.

### 3.8 Artefato validado da `main`

Após push na `main` e Quality gate verde:

- o bundle aprovado é baixado;
- um `manifest.json` registra repositório, SHA, run e data;
- `validated-main-<sha>` é publicado por 30 dias.

Isso é **continuous delivery de artefato**. A publicação efetiva continua sob o
fluxo do Lovable enquanto não existir mecanismo oficial de deploy automatizado
adotado pelo projeto.

---

## 4. Comandos locais

Pré-requisitos:

- Node.js 22;
- Docker Desktop ou Docker Engine;
- Chromium do Playwright.

```bash
npm install --no-audit --no-fund --legacy-peer-deps
npx playwright install chromium
```

Validações isoladas:

```bash
npm run ci:governance
npm run ci:test-map
npm run lint
npm run typecheck
npm run test:unit
npm run test:coverage
npm run build
npm run test:e2e
```

Pipeline local completa:

```bash
npm run test:ci
```

O comando `test:ci` inclui governança e mapa de testes, além dos gates técnicos.

---

## 5. Dados e segredos nos testes

É proibido usar em fixtures ou artifacts:

- nomes ou documentos reais;
- telefone de paciente real;
- conteúdo clínico real;
- URL de produção;
- token Meta;
- service role remota;
- segredo de runner ou webhook.

As credenciais E2E são fixas, locais e reservadas às contas sintéticas criadas
em cada execução efêmera.

O bootstrap nunca deve desativar trigger ou policy de produção para aprovar o
E2E. A fixture deve atravessar a mesma autorização que protege o fluxo real.

---

## 6. Migrations e RLS

Toda mudança em `supabase/migrations/**` é considerada funcional pela CI.

Ela deve atualizar:

- `src/test/unit/database-contracts.test.ts`, quando houver contrato estrutural;
- `tests/e2e/data-access.spec.ts`, quando houver impacto de acesso, RLS ou
  persistência;
- matriz complementar `tests/test-matrix.database.json`;
- issue e ADR aplicáveis.

`supabase db reset` é obrigatório no E2E e falha de reconstrução bloqueia merge.

---

## 7. Integrações externas

A suíte obrigatória de PR não envia mensagens reais para a Meta.

Testes de contrato Meta devem usar workflow separado com:

- environment protegido;
- aprovação manual quando aplicável;
- WABA e número exclusivos de staging;
- templates e destinatários sintéticos;
- secrets indisponíveis para código não confiável;
- limpeza e auditoria.

Um frontend ou banco verde não comprova a integração Meta.

---

## 8. Branch protection recomendada

Na regra da `main`:

- exigir pull request;
- exigir branch atualizada;
- exigir aprovação;
- exigir resolução das conversas;
- exigir o check **Quality gate**;
- bloquear force push e exclusão;
- restringir bypass a break-glass auditado.

A configuração do ruleset é administrativa e não está contida no YAML do
workflow.

---

## 9. Dependências e lockfile

O repositório possui `package-lock.json`, mas ele precisa ser regenerado para
incluir todas as dependências adicionadas pela pipeline. Enquanto essa
atualização não for versionada, os jobs usam `npm install --legacy-peer-deps`.

Após regenerar o lockfile em um ambiente Node 22:

```bash
npm install --package-lock-only --legacy-peer-deps
```

A mudança seguinte deve trocar os jobs para `npm ci`. Não declarar instalação
congelada antes de o lockfile refletir `package.json`.

---

## 10. Flakiness e diagnóstico

1. consultar JUnit, trace, screenshot, vídeo e logs do bootstrap;
2. reproduzir com o mesmo projeto Playwright;
3. corrigir causa, seletor ou sincronização;
4. não usar timeout fixo como solução permanente;
5. não aumentar retries para esconder falha;
6. não usar `.skip`, `.only` ou `.fixme` sem issue, responsável e prazo.

Seletores devem priorizar role, nome, label e `data-testid`, nunca classes
Tailwind.

---

## 11. Limitações conhecidas

- a integração Meta real ainda exige staging protegido;
- o lockfile ainda precisa ser atualizado antes da adoção de `npm ci`;
- Chromium é o browser obrigatório inicial;
- os thresholds de cobertura são moderados e devem crescer;
- `no-explicit-any` permanece dívida controlada;
- o GitHub Actions produz artifact validado, mas não publica automaticamente no
  Lovable.
