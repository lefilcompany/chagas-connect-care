# ADRs (Architectural Decision Records)

Um ADR registra **uma decisão arquitetural**, o contexto que a motivou,
as alternativas consideradas e as consequências assumidas. Formato
baseado em [MADR](https://adr.github.io/madr/), adaptado para pt-BR.

---

## Quando criar um ADR (regra dos 3)

Crie um ADR **somente** quando **as três** condições forem verdadeiras:

1. **Difícil de reverter** — o custo de mudar de ideia depois é
   relevante (migração de dados, quebra de contrato, retrabalho amplo).
2. **Surpreendente sem contexto** — um leitor futuro vai perguntar
   "por que fizeram assim?".
3. **Resultado de trade-off real** — havia alternativas legítimas e
   você escolheu uma por razões específicas.

Se **qualquer uma** falha, **não crie ADR**. Escolhas rotineiras,
padrões óbvios do stack e decisões facilmente reversíveis não merecem
ADR — vão poluir o histórico e afogar as decisões que importam.

---

## Ciclo de vida

```text
proposto ──► aceito ──► substituido-por(NNNN)
   │
   └──► descartado
```

- **proposto** — em discussão; ainda não decidido.
- **aceito** — decisão vigente.
- **substituido-por: NNNN** — decisão foi trocada; ADR antigo permanece
  no histórico com link para o novo.
- **descartado** — proposta que não virou decisão; permanece como
  registro do "não vamos por aqui".

ADRs **nunca** são deletados. Se uma decisão muda, cria-se um ADR novo
e marca-se o antigo como `substituido-por`.

---

## Nomenclatura

`NNNN-titulo-kebab.md`

- `NNNN` — 4 dígitos, incremental (`0001`, `0002`, ...).
- `0000-template.md` é reservado para o template — não é um ADR
  aceito.

---

## Como criar

1. Copiar `docs/adr/0000-template.md` para
   `docs/adr/NNNN-titulo-kebab.md`.
2. Preencher todas as seções em pt-BR.
3. Abrir issue correspondente em `docs/issue-tracker/` para trilhar a
   implementação (se houver).
4. Ao aceitar, mudar `status` no frontmatter para `aceito`.

---

## Índice

Nenhum ADR aceito ainda. O primeiro ADR real deve começar em `0001`.
