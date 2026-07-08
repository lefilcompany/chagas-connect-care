# Issue tracker local

O trabalho é registrado em Markdown para manter contexto, critérios, decisões e
validação junto ao código. A decisão está no ADR `0007`; a integração com CI no
ADR `0008`.

---

## Quando criar

Crie ou reutilize um issue **antes do primeiro commit funcional** para:

- nova funcionalidade, rota, tela, regra, integração ou edge function;
- mudança de código, schema, comportamento ou contrato;
- bug e regressão;
- alteração de domínio, arquitetura, segurança ou privacidade;
- spike/investigação relevante;
- documentação estrutural.

Correção puramente tipográfica pode usar issue agregador, desde que não altere
significado.

### Nova funcionalidade

Antes do código, o issue deve:

1. estar `em-andamento`;
2. ter responsável;
3. descrever evidências, critérios, riscos e fora de escopo;
4. referenciar o ADR da funcionalidade;
5. indicar unitários e E2E planejados em `tests/test-matrix.json`.

A CI valida a existência e a ordem de issue/ADR antes da implementação.

---

## Nomenclatura

`NNNN-slug-curto.md`

- quatro dígitos;
- incremento no branch base;
- kebab-case, pt-BR sem acentos;
- resolver conflitos de ID antes do merge.

---

## Frontmatter

```yaml
---
id: 0042
titulo: Nome curto do issue
status: aberto           # aberto | em-andamento | bloqueado | concluido | descartado
tipo: feature            # bug | feature | chore | spike | docs | security
prioridade: media        # baixa | media | alta | critica
criado_em: 2026-07-08
atualizado_em: 2026-07-08
responsavel: null        # obrigatório em andamento/concluído
relacionados: []
adr: null                # obrigatório para feature; id ou lista
---
```

Regras:

- ID corresponde ao nome;
- data muda com status/escopo/decisão;
- responsável não fica `null` em andamento/concluído;
- feature exige ADR;
- prioridade crítica exige impacto explícito;
- descartado exige justificativa.

---

## Seções obrigatórias

1. **Contexto** — problema e usuário/risco afetado.
2. **O que fazer** — resultado esperado.
3. **Evidências** — código, schema, reprodução ou pesquisa.
4. **Critérios de aceitação** — verificáveis.
5. **Fora de escopo** — limites conscientes.
6. **Riscos e impactos** — domínio, segurança, dados, operação.
7. **Plano de testes** — unitários, E2E e contratos.
8. **Validação** — comandos e resultados executados.
9. **Notas** — decisões, bloqueios e riscos residuais.

Use `TEMPLATE.md`.

---

## Ciclo de vida

```text
aberto ──► em-andamento ──► concluido
   │            │
   │            └──► bloqueado ──► em-andamento
   └─────────────────────────────► descartado
```

### Aberto

Escopo inicial conhecido, sem execução ativa.

### Em andamento

Possui responsável, ADR quando aplicável e trabalho ativo.

### Bloqueado

Notas explicam dependência, responsável, parte que pode avançar e risco.

### Concluído

Somente quando:

- critérios estão marcados;
- unitários e E2E foram atualizados e mapeados;
- lint, typecheck, cobertura, build e Playwright passaram;
- Quality gate está verde;
- docs/ADRs foram atualizados;
- riscos residuais estão explícitos;
- mudança está no PR correspondente.

### Descartado

Preserve o arquivo e explique a razão.

---

## Fluxo para agentes

1. procurar/criar issue;
2. preencher contexto, evidências, critérios e riscos;
3. marcar em andamento e assumir responsabilidade;
4. criar ADR antes da implementação de feature;
5. mapear testes em `tests/test-matrix.json`;
6. implementar com unitários;
7. implementar/atualizar E2E;
8. executar CI local/proporcional;
9. atualizar notas e validação;
10. concluir apenas após Quality gate verde.

---

## Relação com GitHub

- Markdown é a fonte canônica atual;
- GitHub Issue, quando usado, aponta para o arquivo;
- PR menciona issue e ADRs;
- não expor segredo, token ou dado pessoal;
- branch protection deve exigir **Quality gate**.

---

## Qualidade do issue

Outro agente deve conseguir responder:

- qual problema existe;
- qual evidência o comprova;
- qual decisão foi tomada;
- quais riscos importam;
- quais testes demonstram o resultado;
- como reproduzir a validação;
- o que permanece pendente.