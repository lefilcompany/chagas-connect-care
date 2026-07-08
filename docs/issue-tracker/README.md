# Issue tracker local

O trabalho do repositório é registrado em arquivos Markdown para manter
contexto, critérios e decisões junto ao código. A decisão e seus trade-offs
estão no ADR `0007`.

---

## Quando criar um issue

Crie ou reutilize um issue antes de:

- mudar código, schema, integração ou comportamento;
- alterar domínio, arquitetura, segurança ou privacidade;
- corrigir bug;
- executar spike/investigação relevante;
- produzir documentação estrutural.

Correções puramente tipográficas podem usar um issue agregador de documentação,
desde que não escondam mudança de significado.

---

## Nomenclatura

`NNNN-slug-curto.md`

- quatro dígitos com zero à esquerda;
- incremento sequencial no branch base;
- slug em kebab-case, pt-BR sem acentos, até seis palavras;
- conflitos de ID entre branches devem ser resolvidos antes do merge.

Exemplos:

- `0002-completar-documentacao-dominio-arquitetura.md`;
- `0017-corrigir-envio-template-midia.md`.

---

## Frontmatter obrigatório

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
adr: null                # null, um id ou lista de ids
---
```

### Regras

- `id` corresponde ao nome do arquivo;
- `atualizado_em` muda quando status, escopo ou decisão mudar;
- `responsavel` não pode permanecer `null` em issue concluído;
- `adr` referencia decisões, não substitui o contexto do issue;
- prioridade crítica exige risco/impacto explícito;
- `descartado` exige justificativa.

---

## Seções obrigatórias

1. **Contexto** — problema e por que importa.
2. **O que fazer** — resultado esperado, não lista prematura de arquivos.
3. **Evidências** — código, schema, reprodução, métricas ou pesquisa.
4. **Critérios de aceitação** — verificáveis.
5. **Fora de escopo** — limitações conscientes.
6. **Riscos/impactos** — domínio, segurança, privacidade, dados, operação.
7. **Validação** — testes ou revisão executados.
8. **Notas** — decisões e bloqueios durante o trabalho.

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

Escopo inicial conhecido; ainda sem execução ativa.

### Em andamento

Possui responsável e trabalho ativo. Registre decisões enquanto acontecem.

### Bloqueado

Existe dependência concreta. Notas devem explicar:

- o que bloqueia;
- quem decide/entrega;
- o que pode avançar;
- risco do atraso.

### Concluído

Somente quando:

- critérios estão marcados;
- validação está registrada;
- docs/ADRs foram atualizados;
- riscos residuais estão explícitos;
- mudança está no branch/PR correspondente.

Deploy em produção pode ser um critério separado quando fizer parte do escopo.

### Descartado

Não será executado no escopo previsível. Preserve o arquivo e explique a razão.

---

## Fluxo para agentes

1. procurar issue existente;
2. criar o próximo ID no branch base;
3. preencher contexto, evidências, critérios e riscos;
4. marcar em andamento e assumir responsabilidade;
5. atualizar notas durante a tarefa;
6. criar/propor ADR quando necessário;
7. validar;
8. concluir e referenciar no PR.

---

## Relação com GitHub Issues e PRs

- arquivo Markdown é a fonte canônica atual;
- GitHub Issue, quando usado, deve apontar para o arquivo;
- PR deve mencionar o ID e listar ADRs;
- título do PR não precisa repetir o título do issue;
- não exponha IDs internos de ferramentas ou segredos nas notas.

---

## Qualidade do issue

Um bom issue permite a outro agente responder:

- qual problema está sendo resolvido;
- como sabemos que ele existe;
- o que precisa ser verdadeiro ao final;
- quais decisões já foram tomadas;
- quais riscos não podem ser ignorados;
- como validar a entrega.