---
id: 0001
titulo: Documentar coluna "Pendências" na lista de pessoas
status: concluido
tipo: docs
prioridade: baixa
criado_em: 2026-07-08
atualizado_em: 2026-07-08
responsavel: null
relacionados: []
adr: null
---

## Contexto

A coluna "Pendências" apareceu na tabela de `PeopleList` sem estar
documentada no glossário. O usuário perguntou o que ela representava e
pediu ajustes visuais (centralizar conteúdo, remover rótulo redundante
no botão). Faltava uma definição canônica do conceito **Pendência** para
ancorar futuras decisões de UI e regras de derivação
(`PersonDerived.pendencies`).

## O que fazer

- Adicionar o termo **Pendência** ao glossário em `docs/CONTEXT.md`
  com definição, categorias e sinônimos proibidos.
- Servir como referência viva para novos agentes de como um issue
  preenchido se parece.

## Critérios de aceitação

- [x] `docs/CONTEXT.md` contém entrada "Pendência" no glossário.
- [x] Entrada lista as categorias derivadas (canal, cuidador,
      consentimento, falha de envio, sem contato recente).
- [x] Entrada lista pelo menos um sinônimo proibido.

## Fora de escopo

- Refatorar a derivação em `PersonDerived` (fica para outro issue se
  necessário).
- Alterar a UI da tabela (já foi feita em conversa anterior).

## Notas

- Definição adotada: "o que falta para uma pessoa ficar em dia na
  jornada" — mantida deliberadamente ampla para acomodar novas
  categorias sem quebrar o vocabulário.
- Sinônimos proibidos escolhidos ("problema", "erro do paciente",
  "alerta") vieram de termos que apareceram informalmente no chat com
  o usuário e não devem entrar na UI.
