# ADRs — Architectural Decision Records

ADRs registram decisões difíceis de reverter, surpreendentes sem contexto e
resultantes de trade-off real. O objetivo não é documentar toda escolha, mas
preservar o **porquê** das decisões estruturais.

Formato baseado em MADR, adaptado para pt-BR.

---

## Regra dos três

Crie um ADR quando as três condições forem verdadeiras:

1. **Difícil de reverter:** envolve dados, contrato, migração, lock-in ou
   retrabalho amplo.
2. **Surpreendente sem contexto:** um leitor futuro perguntará por que foi feito
   assim.
3. **Trade-off real:** havia alternativas legítimas com custos diferentes.

Se a escolha for local, óbvia e reversível, registre no issue, teste ou código —
não em ADR.

---

## Estados

```text
proposto ──► aceito ──► substituido-por(NNNN)
    │
    └──────► descartado
```

- **proposto:** precisa de decisão; não é regra vigente.
- **aceito:** decisão vigente.
- **substituido-por:** preservado como histórico, mas não vigente.
- **descartado:** alternativa formalmente rejeitada.

ADRs não são apagados. Corrija erro factual pequeno no próprio ADR; para mudar a
decisão, crie outro ADR e estabeleça substituição.

---

## ADR retrospectivo

É permitido registrar decisão já materializada quando:

- a implementação comprova uma escolha estrutural;
- o contexto e as alternativas ainda podem ser reconstruídos honestamente;
- o ADR deixa claro que descreve o estado vigente, sem fingir uma reunião que
  não ocorreu;
- dívidas e lacunas permanecem explícitas.

Não use ADR retrospectivo para legitimar decisão insegura ou inventar aprovação.
Quando a fronteira ainda depende de pessoas responsáveis, use `proposto`.

---

## Nomenclatura

`NNNN-titulo-kebab.md`

- quatro dígitos incrementais;
- título curto e orientado à decisão;
- `0000-template.md` é somente template.

---

## Como criar

1. Copie `0000-template.md`.
2. Use o próximo ID disponível.
3. Preencha contexto, decisão, alternativas, consequências e guard-rails.
4. Relacione issue e documentos afetados.
5. Colete decisores para decisões novas.
6. Marque como `proposto` até decisão explícita.
7. Ao aceitar, atualize documentos e issues de implementação.

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

---

## Revisão

Ao alterar domínio ou arquitetura:

- procure ADR vigente;
- não contradiga decisão aceita silenciosamente;
- confira se nova evidência exige substituição;
- atualize o índice;
- registre risco residual e plano de migração.