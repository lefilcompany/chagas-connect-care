---
id: 0002
titulo: Completar documentação de domínio e arquitetura
status: concluido
tipo: docs
prioridade: alta
criado_em: 2026-07-08
atualizado_em: 2026-07-08
responsavel: openai-codex
relacionados: [0001]
adr: [0001, 0002, 0003, 0004, 0005, 0006, 0007]
---

## Contexto

A primeira versão de `CONTEXT.md`, `AGENTS.md` e `docs/` criou uma boa
estrutura, mas misturou intenção futura com estado implementado e registrou
nomes que não correspondem ao schema atual. Entre as divergências encontradas:

- `care_network_contacts` na documentação versus `contacts` no banco;
- `audiences` versus `audience_segments`;
- `templates` versus `message_templates`;
- e-mail descrito como canal atual, embora `message_channel` aceite apenas
  `whatsapp | sms`;
- afirmação de que toda tabela operacional possui `institution`, embora parte
  do isolamento seja transitivo por `patient_id`;
- fronteira "não somos prontuário" incompatível com dados clínicos já
  persistidos em `patients`, `medications` e `adherence_events`.

A documentação também não distinguia fatos, decisões, hipóteses e visão futura,
e não possuía ADRs para decisões estruturais já materializadas no código.

## O que fazer

- Reorganizar a documentação em camadas de contexto, domínio, arquitetura,
  decisões, riscos e trabalho.
- Corrigir nomenclatura e capacidades de acordo com o código atual.
- Separar claramente **estado atual**, **visão futura** e **questões abertas**.
- Documentar atores, entidades, invariantes, comandos, eventos, estados,
  consentimento, privacidade e fronteiras clínicas.
- Registrar ADRs para decisões estruturais comprovadas pelo repositório.
- Ajustar `AGENTS.md` para autonomia proporcional ao risco, evitando tanto
  decisões silenciosas quanto bloqueio por perguntas desnecessárias.
- Criar um registro explícito de riscos e dívidas.

## Evidências consultadas

- `src/integrations/supabase/types.ts`;
- `src/App.tsx`;
- `src/lib/access.tsx`;
- `supabase/functions/send-whatsapp/index.ts`;
- `supabase/config.toml`;
- documentação existente no repositório.

## Critérios de aceitação

- [x] `CONTEXT.md` diferencia fato, decisão, hipótese e visão futura.
- [x] Glossário usa nomes atuais do schema e explica diferenças entre termo de
      domínio, rótulo de UI e nome técnico.
- [x] Arquitetura descreve isolamento direto, transitivo e recursos globais.
- [x] Canais atuais e planejados não são misturados.
- [x] Fronteira de dados clínicos é documentada sem afirmar que o produto não
      armazena dados clínicos.
- [x] Consentimento e identidade WhatsApp têm invariantes documentadas.
- [x] Máquinas de estado e eventos principais estão registrados.
- [x] Riscos conhecidos possuem impacto, mitigação e ação recomendada.
- [x] Decisões estruturais existentes possuem ADR.
- [x] Questões não decididas permanecem abertas, sem serem apresentadas como
      decisões vigentes.
- [x] README e regras para agentes apontam para a nova estrutura.

## Fora de escopo

- Alterar schema, migrations, RLS, código de aplicação ou comportamento de
  produção.
- Resolver perguntas de produto que exigem decisão dos responsáveis clínicos,
  jurídicos ou de negócio.
- Declarar conformidade legal; a documentação registra controles e lacunas,
  mas não substitui avaliação jurídica ou de segurança.

## Validação

- Revisão cruzada dos nomes técnicos contra os tipos gerados do Supabase.
- Revisão das rotas contra `src/App.tsx`.
- Revisão do modelo de acesso contra `src/lib/access.tsx`.
- Revisão do envio WhatsApp contra `supabase/functions/send-whatsapp/index.ts`.

## Notas

- ADRs que descrevem implementação existente foram marcados como `aceito`.
- A fronteira clínica foi registrada como decisão proposta, pois o código atual
  demonstra armazenamento clínico, mas o limite estratégico ainda exige
  validação humana.
- A recomendação de separar núcleo genérico e vertical de Chagas permanece em
  `docs/domain/open-questions.md`, sem ser promovida a decisão canônica.