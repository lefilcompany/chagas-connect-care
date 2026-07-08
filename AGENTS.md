# AGENTS — Regras para agentes neste repositório

> Este documento orienta agentes humanos e LLMs. `CONTEXT.md` define o produto;
> `docs/domain/` define o domínio; `docs/architecture.md` descreve o sistema;
> ADRs registram decisões; issues registram trabalho; `docs/testing-and-ci.md`
> define a validação obrigatória.

---

## 1. Regra-mãe: autonomia proporcional ao risco

Não tome decisões silenciosas que alterem domínio, segurança, privacidade,
dados persistidos, contratos externos, arquitetura ou comportamento relevante
do usuário.

Ao mesmo tempo, não bloqueie tarefas por detalhes reversíveis que podem ser
inferidos com segurança do código existente.

### Pode decidir autonomamente

Desde que siga padrões existentes e registre a escolha no issue:

- nomes locais de variáveis e helpers;
- organização interna reversível;
- tratamento defensivo de erro sem mudar contrato;
- pequenos ajustes visuais apoiados nos tokens existentes;
- testes adicionais;
- correções inequívocas entre documentação e código;
- refatorações locais sem mudança de comportamento.

### Deve parar e obter decisão humana

- novo conceito de domínio ou mudança de significado;
- coleta, retenção, compartilhamento ou exclusão de dados pessoais/clínicos;
- mudança de base legal, consentimento ou finalidade;
- nova entidade persistida ou migração destrutiva;
- alteração de RLS, GRANT, papel ou fronteira de instituição;
- envio de mensagem sem regra de autorização clara;
- mudança de contrato com Meta ou outro sistema externo;
- alteração de máquina de estados, retry, idempotência ou ordenação crítica;
- dependência nova com impacto de segurança, custo ou lock-in;
- decisão difícil de reverter ou surpreendente sem contexto.

Em tarefa não interativa, registre a lacuna como questão aberta ou ADR proposto
e implemente somente a parte segura e reversível.

---

## 2. Regra obrigatória para qualquer nova funcionalidade

**Nenhum commit funcional de uma nova funcionalidade pode acontecer antes de:**

1. existir um issue em `docs/issue-tracker/`;
2. o issue estar `em-andamento`, com responsável, evidências, critérios e riscos;
3. existir um ADR da funcionalidade/decisão em `docs/adr/`;
4. a funcionalidade estar planejada em `tests/test-matrix.json` com ao menos um
   teste unitário e um teste E2E.

**Nenhuma funcionalidade pode ser considerada concluída antes de:**

1. possuir testes unitários de suas regras e estados;
2. possuir testes E2E do caminho de usuário ou contrato de navegação;
3. atualizar a matriz de testes;
4. passar em governança, lint, TypeScript, cobertura, build e Playwright;
5. ter o check **Quality gate** verde;
6. atualizar documentos, issue e ADR;
7. registrar limitações ou testes de contrato ainda pendentes.

### O que é funcionalidade

Inclui, sem se limitar a:

- nova tela, rota, fluxo ou ação de usuário;
- novo bounded context, entidade, estado ou regra;
- nova edge function, integração ou provedor;
- novo canal, template, nó de jornada ou filtro;
- nova operação administrativa;
- mudança que amplie comportamento público ou persistido.

### Bugs, chores e refatorações

- issue continua obrigatório;
- testes de regressão são obrigatórios quando o comportamento é afetado;
- ADR é obrigatório se alterar decisão, contrato, arquitetura, dados, segurança
  ou satisfizer a regra dos três;
- correção tipográfica/documental pode usar issue agregador e não exige novo ADR
  quando não muda significado.

A CI verifica a ordem **issue/ADR → implementação → unitário/E2E**.

---

## 3. Fonte de verdade e leitura mínima

Antes de alterar o repositório:

1. leia `CONTEXT.md`;
2. leia `AGENTS.md` e `docs/testing-and-ci.md`;
3. localize ou crie o issue;
4. crie/leia o ADR aplicável;
5. leia os documentos de domínio afetados;
6. valide afirmações no código, migrations e tipos gerados;
7. consulte `tests/test-matrix.json`;
8. identifique riscos e critérios de validação.

### Hierarquia quando há divergência

1. migrations/policies aplicadas;
2. tipos gerados do Supabase;
3. código executável e edge functions;
4. ADR aceito;
5. documentação;
6. issue, comentário ou conversa.

Não altere código apenas para fazê-lo coincidir com documentação antiga.
Registre a divergência e determine qual lado está incorreto.

---

## 4. Fluxo obrigatório de trabalho

### Antes de implementar

1. **Issue-first:** localizar ou criar o issue.
2. Marcar `em-andamento`, responsável e data.
3. Registrar evidências, critérios, riscos e fora de escopo.
4. Criar o ADR quando for funcionalidade; para outros tipos, aplicar a regra
   definida na seção 2.
5. Atualizar `tests/test-matrix.json` com fontes, unitários e E2E planejados.
6. Ler domínio, arquitetura, riscos e ADRs relacionados.
7. Definir cenários: principal, vazio, erro, autorização e regressão.

### Durante a implementação

8. Implementar a menor mudança completa.
9. Escrever testes unitários junto da regra, não depois como formalidade.
10. Escrever/atualizar E2E do fluxo observável.
11. Registrar decisões e desvios no issue.
12. Atualizar docs quando significado, contrato ou operação mudar.

### Antes de concluir

13. Executar:

```bash
npm run ci:governance
npm run ci:test-map
npm run lint
npm run typecheck
npm run test:coverage
npm run build
npm run test:e2e
```

14. Corrigir falhas sem reduzir cobertura, pular teste ou enfraquecer check.
15. Atualizar critérios, validação e riscos residuais.
16. Marcar issue como concluído somente após Quality gate verde.
17. Referenciar issue e ADR no PR e na mensagem final.

---

## 5. Como perguntar bem

Quando uma decisão humana for necessária:

- agrupe perguntas dependentes em um bloco curto;
- apresente de duas a quatro alternativas reais;
- explique impacto em domínio, segurança, prazo e reversibilidade;
- recomende uma alternativa;
- diga o que pode avançar sem a resposta;
- não transfira ao usuário detalhes que o código já resolve.

Formato recomendado:

```text
Decisão necessária: ...
Opções: A (...), B (...), C (...)
Recomendação: B, porque ...
Impacto se adiada: ...
```

---

## 6. Linguagem e nomenclatura

- Respostas ao usuário e documentação em **pt-BR**.
- Strings de UI e comentários novos em pt-BR, salvo contrato externo.
- Símbolos, arquivos, tabelas e colunas permanecem em inglês.
- Use termos de `docs/domain/glossary.md`.
- Diferencie termo de domínio, rótulo de UI e nome técnico.
- Não invente tabela ou enum a partir do nome de negócio.

Exemplos:

- contato da rede de cuidado → `contacts`;
- audiência → `audience_segments`;
- modelo de mensagem → `message_templates`;
- Pessoa na UI → `patients` ou `contacts`, conforme o contexto.

---

## 7. Guard-rails de domínio

- Paciente, contato, identidade WhatsApp e usuário autenticado são diferentes.
- Jornada e campanha/envio em lote não são sinônimos.
- Capacidade planejada não pode ser apresentada como implementada.
- E-mail não é canal atual enquanto não existir no enum e nos fluxos.
- O produto armazena dados clínicos limitados; não afirmar o contrário.
- Questões abertas não podem virar regra canônica sem decisão.
- Mudança de conceito exige atualização de contexto, glossário, modelo, ADR e
  testes.

---

## 8. Guard-rails de segurança, privacidade e saúde

### Autorização

- Não confiar apenas na UI.
- Validar RLS e autorização no servidor.
- Service role contorna RLS; toda edge function deve validar ator, recurso,
  instituição e finalidade antes de usá-la.
- Superadmin não significa acesso irrestrito sem auditoria e necessidade.

### Migrations

Toda `CREATE TABLE public.<x>` deve avaliar:

1. ownership e GRANT;
2. RLS;
3. policies por operação;
4. índices para policies e chaves;
5. tenancy direta ou transitiva;
6. auditoria, retenção e exclusão;
7. constraints, idempotência e backfill;
8. testes same-tenant, cross-tenant e service role.

Não presuma que toda tabela possui `institution`.

### Dados sensíveis

- Nunca incluir segredo, token, CPF, telefone, mensagem clínica ou payload de
  saúde em log desnecessário.
- Nunca colocar segredo em `VITE_*`.
- Minimizar dados em mensagens, URLs, notificações, analytics e artifacts.
- Fixtures, traces, screenshots e vídeos usam somente dados sintéticos.
- Mudança em consentimento/finalidade exige revisar
  `docs/domain/consent-and-privacy.md`.

### WhatsApp

- Resolver destinatário com instituição e identidade.
- Respeitar template aprovado, janela, opt-in/finalidade e idempotência.
- Webhooks devem ser verificados, deduplicados e auditáveis.
- Não enviar com definição local divergente da Meta.

---

## 9. Guard-rails de frontend e design

- Usar tokens semânticos de `src/index.css`.
- Evitar cores hardcoded e estética genérica.
- Preservar foco, teclado, labels, contraste, loading, empty e erro.
- Não esconder informação clínica essencial por economia visual.
- Não expor dado sensível em toast, URL, título ou preview público.
- Estado de servidor permanece em TanStack Query, salvo ADR substituto.
- E2E prioriza role/name/label; não usar classes Tailwind como seletor.

---

## 10. Arquivos auto-gerados ou gerenciados

Nunca editar manualmente:

- `src/integrations/supabase/client.ts`;
- `src/integrations/supabase/types.ts`;
- `supabase/config.toml`;
- variáveis `VITE_SUPABASE_*` gerenciadas pela plataforma.

Podem ser lidos como evidência. A correção deve ocorrer na fonte geradora.

---

## 11. Política de testes

### Unitários

Obrigatórios para regras, transformações, estados, guards, hooks e contratos.
Não são aceitos:

- `expect(true).toBe(true)`;
- teste que apenas importa o arquivo;
- snapshot sem comportamento;
- mock que reproduz literalmente a implementação.

### E2E

Obrigatórios para cada funcionalidade. Cobrir, conforme aplicável:

- caminho principal;
- usuário anônimo/papel incorreto;
- vazio e erro;
- redirects/compatibilidade;
- ausência de exceção JavaScript;
- ação crítica completa.

### Integrações

- PR usa mocks determinísticos e dados sintéticos.
- RLS, Meta, Storage, cron e integrações reais exigem contract/integration tests
  em ambiente protegido.
- Um mock verde não comprova contrato externo.

### Cobertura

- thresholds são piso e devem subir progressivamente;
- não reduzir cobertura para aprovar PR;
- não usar `.skip`, `.only` ou `.fixme` sem issue, responsável e prazo;
- teste flaky é defeito e bloqueia merge.

Detalhes em `docs/testing-and-ci.md`.

---

## 12. Quando atualizar cada documento

| Mudança | Documentos mínimos |
| --- | --- |
| Nova funcionalidade | issue + ADR + test matrix + unit/E2E + docs afetadas |
| Termo ou significado | `CONTEXT.md` + glossário/modelo + ADR |
| Entidade, relação ou estado | modelo + state machines + arquitetura + testes |
| Consentimento/dado pessoal | consentimento/privacidade + riscos + ADR + testes negativos |
| Decisão estrutural | ADR + arquitetura + issue |
| Capacidade futura | current-vs-target + issue; não marcar como atual |
| Novo risco | `docs/risks.md` + issue de mitigação |
| Nova integração | arquitetura + ADR + contract tests |
| Novo feature root/edge function | `tests/test-matrix.json` + unitário + E2E |
| Mudança na CI | ADR + `docs/testing-and-ci.md` |

---

## 13. Definition of Done

Uma tarefa está concluída quando:

- issue e ADR precederam a implementação quando exigidos;
- critérios de aceitação estão atendidos;
- unitários e E2E foram adicionados/atualizados e mapeados;
- lint, typecheck, cobertura, build e E2E passaram;
- Quality gate está verde;
- não há `.only`, skip injustificado ou teste trivial;
- documentação foi atualizada;
- riscos residuais e limitações estão explícitos;
- issue está concluído;
- PR explica estado anterior, mudança, testes, artifacts e impacto.