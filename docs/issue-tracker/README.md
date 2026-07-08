# Issue-tracker (markdown local)

Todo trabalho neste repositório passa por um issue aqui. Sem exceção
(ver `docs/AGENTS.md` §4 — Issue-first obrigatório).

---

## Nomenclatura

`NNNN-slug-curto.md`

- `NNNN` — 4 dígitos com zero à esquerda, incremental (`0001`, `0002`,
  ..., `0042`, ...).
- `slug-curto` — kebab-case, pt-BR sem acentos, ≤ 6 palavras.

Exemplos:

- `0001-exemplo-issue.md`
- `0017-corrigir-envio-whatsapp-template-midia.md`
- `0042-remover-coluna-pendencias-legada.md`

---

## Frontmatter obrigatório

```yaml
---
id: 0042
titulo: Nome curto do issue
status: aberto           # aberto | em-andamento | bloqueado | concluido | descartado
tipo: feature            # bug | feature | chore | spike | docs
prioridade: media        # baixa | media | alta | critica
criado_em: 2026-07-08
atualizado_em: 2026-07-08
responsavel: null        # login/nome do responsável, ou null
relacionados: []         # ex.: [0017, 0031]
adr: null                # ex.: 0003 se o issue implementa/depende de um ADR
---
```

**Regras:**

- `id` deve casar com o número no nome do arquivo.
- `atualizado_em` muda toda vez que status/notas mudarem.
- Se o issue depende de outro, listar em `relacionados`.
- Se implementa uma decisão de ADR, referenciar em `adr`.

---

## Corpo (seções obrigatórias)

Cada issue tem: **Contexto**, **O que fazer**, **Critérios de
aceitação** (checklist), **Fora de escopo**, **Notas**. Ver
`docs/issue-tracker/TEMPLATE.md`.

---

## Ciclo de vida

```text
aberto ──► em-andamento ──► concluido
   │            │
   │            └──► bloqueado ──► em-andamento
   │
   └──► descartado (nunca voltará; explicar em Notas)
```

- **aberto** — criado, ainda não em execução.
- **em-andamento** — alguém está trabalhando ativamente.
- **bloqueado** — depende de decisão externa; documentar o bloqueio em
  Notas.
- **concluido** — todos os critérios de aceitação marcados; código em
  preview/published; notas de decisão gravadas.
- **descartado** — não será feito; explicar por quê em Notas.

---

## Regras para agentes

1. **Antes de codar:** localizar (ou criar) o issue.
2. **Ao começar:** mudar `status` para `em-andamento`, atualizar
   `atualizado_em`, definir `responsavel`.
3. **Durante:** registrar decisões relevantes em **Notas** conforme
   acontecem (não deixar para o fim).
4. **Ao terminar:** marcar critérios de aceitação, mudar `status` para
   `concluido`, atualizar `atualizado_em`.
5. **Se afetou o domínio:** atualizar `docs/CONTEXT.md` na mesma
   entrega.
6. **Se produziu decisão arquitetural:** propor ADR em `docs/adr/`.

---

## Como criar um issue novo

1. Descobrir o próximo `NNNN` (`ls docs/issue-tracker/ | sort` e somar 1
   ao maior).
2. Copiar `docs/issue-tracker/TEMPLATE.md` para
   `docs/issue-tracker/NNNN-slug.md`.
3. Preencher frontmatter e corpo.
4. Referenciar o issue nas conversas subsequentes.
