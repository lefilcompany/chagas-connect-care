---
id: 0004
titulo: Representar jornadas como grafos JSON versionados
status: aceito
data: 2026-07-08
decisores: [equipe-do-projeto]
substitui: null
---

## Contexto

Jornadas combinam entrada, condições, espera, comunicação, tarefas, handoff e
encerramento. A estrutura precisa ser editável visualmente e evoluir sem criar
uma tabela por tipo de nó. O schema atual persiste o grafo em `journeys.graph` e
registra `version`; cada `journey_run` armazena `journey_version` e nó atual.

## Decisão

Persistimos a definição da jornada como **grafo JSON versionado** em `journeys`.
Execuções registram a versão utilizada e produzem `journey_run_steps` por nó.

A ativação/publicação deve congelar uma versão executável. Alterações futuras
não mudam a semântica de runs já iniciados.

## Alternativas consideradas

### Tabelas normalizadas para nós e arestas

- **Prós:** constraints relacionais, queries por nó, updates pontuais.
- **Contras:** maior complexidade de edição, migrations para novos tipos,
  reconstrução frequente do grafo.
- **Por que não foi escolhida:** o editor e a evolução dos nós favorecem
  documento agregado.

### Workflow em código

- **Prós:** tipagem e testes fortes.
- **Contras:** não editável por usuário, deploy para cada mudança, baixa
  flexibilidade institucional.
- **Por que não foi escolhida:** jornadas são conteúdo/configuração de produto.

### Provedor externo de workflow

- **Prós:** motor pronto, observabilidade e escalabilidade.
- **Contras:** custo, lock-in, integração com RLS/dados, exposição de contexto
  clínico e menor controle de UX.
- **Por que não foi escolhida:** o runner atual atende a arquitetura e mantém
  dados no backend existente.

## Consequências

### Positivas

- flexibilidade para novos nós;
- leitura/escrita agregada pelo editor;
- versionamento explícito;
- execução independente da versão editável atual.

### Negativas / trade-offs

- constraints internas dependem de validação de aplicação;
- migrations de formato JSON podem ser necessárias;
- queries analíticas por nó são mais difíceis;
- referências a template/conteúdo podem ficar inválidas;
- concorrência e idempotência ficam a cargo do runner.

## Guard-rails

- definir schema/version do próprio JSON;
- validar nós, IDs, conexões, alcançabilidade e configuração antes de ativar;
- nunca executar o grafo editável se o run aponta para versão anterior;
- steps registram node ID/kind, tentativa, duração e resultado;
- efeitos externos têm chave de idempotência;
- edição de jornada ativa segue regra explícita de nova versão;
- catálogo de nós deve ser compartilhado entre editor e runner ou validado em
  contrato comum.

## Dívidas conhecidas

- documentar catálogo real de nós a partir do runner;
- definir semântica de pausa e handoff;
- implementar claim/lock atômico;
- definir armazenamento das versões anteriores;
- formalizar migração do formato do grafo.

## Impacto em outros documentos

- `docs/domain/model.md`;
- `docs/domain/state-machines.md`;
- `docs/architecture.md`;
- `docs/risks.md`, R-006, R-007 e R-020.