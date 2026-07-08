---
id: 0006
titulo: Limitar dados clínicos ao necessário para coordenação do cuidado
status: proposto
data: 2026-07-08
decisores: []
substitui: null
---

## Contexto

A documentação anterior afirmava que o produto não armazenava diagnóstico,
prescrições ou dados clínicos estruturados. O schema atual contradiz essa
fronteira: `patients` contém forma clínica, estágio, comorbidades, alergias,
medicamentos em texto, peso, altura e observações; existem também `medications`
e `adherence_events`.

É necessário definir se o produto é fonte clínica, cópia de prontuário ou apenas
consumidor de contexto mínimo. A decisão afeta LGPD, segurança, integração,
responsabilidade clínica, UX, retenção e escopo comercial.

## Decisão proposta

O Chagas Digital Care armazenará **somente dados clínicos necessários para
coordenação, comunicação, segmentação assistencial e acompanhamento de adesão**.

O produto não será a fonte oficial de prontuário completo nem suportará, sem
novo ADR:

- prescrição clínica autônoma;
- laudos e resultados de exames como repositório principal;
- evolução clínica longitudinal completa;
- assinatura clínica/prontuário legal;
- decisão diagnóstica automatizada.

Cada dado clínico deverá possuir finalidade, origem, responsável, regra de
atualização, acesso e retenção.

## Alternativas consideradas

### Tornar-se prontuário eletrônico completo

- **Prós:** centralização e contexto rico.
- **Contras:** enorme escopo regulatório, clínico, interoperabilidade,
  assinatura, auditoria e responsabilidade.
- **Por que não é recomendada agora:** desvia do núcleo de coordenação e exige
  capacidades ausentes.

### Não armazenar nenhum dado clínico

- **Prós:** menor risco e escopo.
- **Contras:** inviabiliza personalização, segmentação, adesão e contexto já
  implementados.
- **Por que não é recomendada:** incompatível com o produto atual.

### Armazenar qualquer dado útil à operação

- **Prós:** flexibilidade imediata.
- **Contras:** crescimento descontrolado, duplicidade, risco jurídico e fonte de
  verdade incerta.
- **Por que não é recomendada:** ausência de limite é uma decisão de alto risco.

## Consequências esperadas

### Positivas

- fronteira clara;
- minimização;
- menor competição com PEP;
- integrações podem trazer somente contexto necessário;
- revisão de features orientada por finalidade.

### Negativas / trade-offs

- parte dos campos atuais pode precisar de remoção/migração;
- dependência de sistema externo para prontuário completo;
- experiência pode precisar indicar origem e atualização;
- exige governança clínica e jurídica;
- alguns relatórios ficam limitados.

## Questões para aceitação

1. O produto é vertical de Chagas, genérico ou núcleo + vertical?
2. Quem é a fonte de verdade de estágio, forma clínica e medicamentos?
3. Quais dados são indispensáveis para cada caso de uso?
4. Qual base legal e retenção se aplicam?
5. Quem pode editar e validar?
6. Como exportar, corrigir e excluir?
7. `current_medications` e `medications` serão reconciliados como?
8. Há necessidade de interoperabilidade com PEP/FHIR?

## Plano após aceitação

- inventariar campos e usos;
- classificar sensibilidade/finalidade;
- definir fonte e owner;
- remover duplicidades;
- revisar RLS, logs e mensagens;
- criar política de retenção;
- atualizar termos e avisos;
- criar testes e auditoria.

## Impacto em outros documentos

- `CONTEXT.md`;
- `docs/domain/model.md`;
- `docs/domain/consent-and-privacy.md`;
- `docs/domain/open-questions.md`;
- `docs/risks.md`, R-008 e R-009.