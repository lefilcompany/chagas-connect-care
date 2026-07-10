# ADRs — Architectural Decision Records

ADRs preservam o **porquê** de decisões, alternativas, consequências e
restrições. O formato é baseado em MADR e adaptado para pt-BR.

---

## Regra para novas funcionalidades

Toda nova funcionalidade exige um ADR antes do primeiro commit funcional. O ADR
deve delimitar:

- problema e usuário afetado;
- decisão de produto, domínio ou arquitetura;
- alternativas consideradas;
- riscos e guard-rails;
- estratégia de dados, segurança e observabilidade;
- testes unitários e E2E esperados;
- critério de revisão ou retirada.

Isso inclui nova rota, tela, fluxo, entidade, estado, edge function, integração,
canal, nó de jornada, filtro ou operação administrativa.

Para bugs, chores e refatorações sem ampliação funcional, use a regra dos três.

---

## Regra dos três

Para mudanças que não são novas funcionalidades, crie ADR quando as três
condições forem verdadeiras:

1. **Difícil de reverter:** envolve dados, contrato, migração, lock-in ou
   retrabalho amplo.
2. **Surpreendente sem contexto:** um leitor futuro perguntará por que foi feito
   assim.
3. **Trade-off real:** havia alternativas legítimas com custos diferentes.

Escolhas locais, óbvias e reversíveis podem permanecer no issue, teste ou código.

---

## Estados

```text
proposto ──► aceito ──► substituido-por(NNNN)
    │
    └──────► descartado
```

- **proposto:** precisa de decisão; não é regra vigente;
- **aceito:** decisão vigente;
- **substituido-por:** preservado como histórico, mas não vigente;
- **descartado:** alternativa formalmente rejeitada.

ADRs não são apagados. Para mudar uma decisão, crie outro ADR e estabeleça a
relação de substituição. Quando um ADR altera somente parte de outro, use uma
relação de complemento e descreva explicitamente qual trecho foi superado.

---

## ADR retrospectivo

É permitido registrar decisão já materializada quando:

- a implementação comprova uma escolha estrutural;
- contexto e alternativas podem ser reconstruídos honestamente;
- o documento não inventa reunião ou aprovação;
- dívidas e lacunas permanecem explícitas.

Quando a fronteira ainda depende de responsáveis, use `proposto`.

---

## Nomenclatura

`NNNN-titulo-kebab.md`

- quatro dígitos incrementais;
- título curto e orientado à decisão;
- `0000-template.md` é somente template.

---

## Como criar

1. Crie ou abra o issue primeiro.
2. Copie `0000-template.md`.
3. Use o próximo ID disponível.
4. Preencha contexto, evidências, decisão, alternativas, consequências,
   guard-rails e testes.
5. Relacione issue, documentos e matriz de testes.
6. Colete decisores para decisões novas.
7. Marque como `proposto` até decisão explícita.
8. Aceite antes do primeiro commit funcional quando for nova funcionalidade.
9. Atualize documentos e issues de implementação.

---

## Índice

| ID | Status | Decisão |
| --- | --- | --- |
| [0001](0001-adotar-supabase-lovable-como-backend.md) | aceito | Adotar Supabase/Lovable como backend gerenciado. |
| [0002](0002-isolar-instituicoes-com-rls.md) | aceito | Isolar instituições com RLS e vínculos institucionais. |
| [0003](0003-armazenar-papeis-em-user-roles.md) | aceito | Armazenar papéis autorizativos em `user_roles`. |
| [0004](0004-representar-jornadas-como-grafos-versionados.md) | aceito | Representar jornadas como grafos JSON versionados. |
| [0005](0005-separar-identidade-conversa-e-pessoa-no-whatsapp.md) | aceito | Separar identidade, conversa, mensagem e pessoa no WhatsApp. |
| [0006](0006-limitar-dados-clinicos-ao-cuidado-coordenado.md) | proposto | Limitar dados clínicos ao necessário para coordenação. |
| [0007](0007-manter-issue-tracker-local-em-markdown.md) | aceito | Manter issue tracker local em Markdown. |
| [0008](0008-adotar-ci-cd-com-testes-por-funcionalidade.md) | aceito | Adotar CI/CD com testes unitários e E2E por funcionalidade. |
| [0009](0009-adotar-e2e-funcional-com-supabase-local.md) | aceito | Executar E2E funcional com Supabase local efêmero. |

---

## Revisão

Ao alterar domínio, arquitetura ou funcionalidade:

- procure ADR vigente;
- não contradiga decisão aceita silenciosamente;
- confira se nova evidência exige substituição ou complemento;
- atualize este índice;
- atualize a matriz de testes aplicável;
- registre riscos, migração e estratégia de testes.
