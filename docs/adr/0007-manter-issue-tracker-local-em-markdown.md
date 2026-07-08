---
id: 0007
titulo: Manter issue tracker local em Markdown
status: aceito
data: 2026-07-08
decisores: [equipe-do-projeto]
substitui: null
---

## Contexto

O repositório adotou issues versionados em `docs/issue-tracker/`, com
frontmatter, critérios de aceitação, notas e vínculo com ADR. A prática facilita
leitura por agentes e mantém contexto perto do código, mas pode duplicar
ferramentas externas e gerar conflito de IDs entre branches.

## Decisão

Mantemos o issue tracker local em Markdown como registro canônico de trabalho
para agentes neste repositório, até decisão substituta.

Toda alteração relevante deve apontar para um issue local. GitHub Issues ou
outras ferramentas podem ser usadas como espelho/coordenação, mas devem
referenciar o arquivo canônico correspondente.

## Alternativas consideradas

### GitHub Issues como única fonte

- **Prós:** colaboração, busca, labels, automações e IDs concorrentes seguros.
- **Contras:** contexto fora da árvore, dependência do conector e menor acesso em
  ambientes de agente que recebem apenas o código.
- **Por que não foi escolhida:** o fluxo atual prioriza documentação versionada
  e legível junto ao repositório.

### Issues em ferramenta externa de gestão

- **Prós:** roadmap, métricas e colaboração organizacional.
- **Contras:** acesso variável, sincronização e perda de contexto técnico.
- **Por que não foi escolhida:** não há ferramenta externa canônica definida.

### Sem issue obrigatório

- **Prós:** menor burocracia.
- **Contras:** decisões e critérios se perdem; agentes têm menos contexto.
- **Por que não foi escolhida:** o projeto precisa de rastreabilidade.

## Consequências

### Positivas

- histórico revisável no PR;
- contexto disponível offline/no clone;
- formato uniforme para agentes;
- vínculo direto com docs e ADRs.

### Negativas / trade-offs

- IDs podem colidir em branches;
- busca e métricas são manuais;
- risco de issue concluído não refletir deploy real;
- possível duplicação com GitHub Issues;
- alterações triviais podem gerar ruído.

## Guard-rails

- responsável obrigatório quando em andamento/concluído;
- critérios e validação explícitos;
- PR referencia issue;
- conflitos de número são resolvidos antes do merge;
- correções tipográficas podem usar issue agregador;
- issue não substitui ADR para decisão arquitetural;
- considerar validação automatizada de frontmatter e IDs.

## Critério de revisão

Reavaliar quando:

- conflitos de IDs se tornarem frequentes;
- houver ferramenta externa oficial;
- métricas e automações forem necessárias;
- agentes conseguirem operar GitHub Issues com confiabilidade equivalente.

## Impacto em outros documentos

- `AGENTS.md`;
- `docs/issue-tracker/README.md`;
- `docs/risks.md`, R-021.