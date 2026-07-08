# CONTEXT — Chagas Digital Care

> Mapa canônico do produto e porta de entrada da documentação. Este arquivo
> explica **por que o produto existe, qual é seu domínio, quais afirmações estão
> comprovadas e onde encontrar os detalhes**. Não substitui o schema, os ADRs
> nem os documentos especializados em `docs/`.

Idioma oficial do produto e da documentação: **pt-BR**.

---

## 1. Como interpretar esta documentação

Toda afirmação relevante deve ser classificada em uma destas categorias:

| Marcador | Significado | Fonte de verdade |
| --- | --- | --- |
| **[ATUAL]** | Existe no código, banco ou operação atual. | Código, migrations e tipos gerados. |
| **[DECISÃO]** | Escolha consciente vigente. | ADR aceito. |
| **[ALVO]** | Direção desejada, ainda não necessariamente implementada. | Roadmap, issue ou ADR proposto. |
| **[HIPÓTESE]** | Entendimento ainda não validado. | `docs/domain/open-questions.md`. |

### Hierarquia de evidências

Quando documentos divergirem, use esta ordem:

1. migrations e políticas SQL aplicadas;
2. `src/integrations/supabase/types.ts` para o schema gerado;
3. edge functions e código que executa a regra;
4. ADR aceito;
5. documentação de domínio e arquitetura;
6. comentários, issues e conversas.

A divergência deve ser corrigida na mesma tarefa. Não adapte silenciosamente o
código para satisfazer uma documentação desatualizada.

---

## 2. Visão do produto

**[ATUAL]** O Chagas Digital Care é uma aplicação multi-instituição para
coordenar comunicação, acompanhamento e ações humanas ao redor da jornada de
cuidado de pacientes. O produto combina:

- cadastro e visão longitudinal de pacientes e contatos de sua rede de cuidado;
- mensageria, com implementação principal em WhatsApp;
- caixa de conversas para atendimento humano;
- jornadas automatizadas representadas por grafos;
- tarefas operacionais associadas a pacientes e execuções de jornada;
- audiências dinâmicas e envios em lote;
- biblioteca de conteúdo e modelos de mensagem;
- administração de instituições, usuários, canais e integrações;
- dados clínicos limitados usados no contexto de cuidado e adesão.

**[ALVO]** A proposta de valor é reduzir perdas de acompanhamento, tornar a
comunicação mais segura e oportuna e ajudar a equipe a perceber qual ação
precisa acontecer a seguir.

### Domínio central

O domínio central é a **coordenação da jornada de cuidado**: transformar estado,
contexto, consentimento, eventos e respostas em comunicações e ações humanas
rastreáveis.

Mensageria, templates, audiências e integrações são capacidades de suporte. A
interface com dados clínicos é necessária para o cuidado, mas seu limite
estratégico ainda precisa de decisão formal; ver ADR `0006` e
`docs/domain/open-questions.md`.

---

## 3. Atores e objetivos

| Ator | Objetivo no sistema |
| --- | --- |
| **Paciente** | Receber orientação, lembretes e acompanhamento adequados ao seu contexto. |
| **Contato da rede de cuidado** | Apoiar o paciente dentro das autorizações e finalidades permitidas. |
| **Equipe** | Executar rotinas, responder conversas, concluir tarefas e acompanhar pacientes da instituição. |
| **Admin institucional** | Configurar equipe, identidade institucional, canais, conteúdo e operação da instituição. |
| **Superadmin** | Operar a plataforma, instituições e integrações com visão ampliada e auditável. |
| **Sistema externo** | Trocar eventos e mensagens por contratos explícitos, como a Meta WhatsApp Cloud API. |

Usuário autenticado é quem opera a aplicação. Paciente e contato não são
"usuários" do sistema, ainda que interajam por WhatsApp ou formulário público.

---

## 4. Capacidades e estado

| Capacidade | Estado | Observação |
| --- | --- | --- |
| WhatsApp bidirecional | **[ATUAL]** | Envio, webhook, identidade, conversa, janela de atendimento, mídia e templates. |
| SMS | **[ATUAL parcial]** | Existe no enum `message_channel`; a completude operacional deve ser validada por fluxo. |
| E-mail | **[ALVO]** | Não consta no enum atual; não tratar como capacidade disponível. |
| Jornadas automatizadas | **[ATUAL]** | `journeys`, `journey_runs`, `journey_run_steps` e `journey_tasks`. |
| Audiências | **[ATUAL]** | Nome técnico: `audience_segments`. |
| Campanhas/envios em lote | **[ATUAL]** | Nome técnico principal: `message_batches`; conceito distinto de jornada. |
| Biblioteca de conteúdo | **[ATUAL]** | `content_library` e `content_folders`, com assimetrias de tenancy documentadas. |
| Dados clínicos limitados | **[ATUAL]** | `patients`, `medications` e `adherence_events`. |
| Prontuário eletrônico completo | **[FORA DO ESCOPO ATUAL]** | O sistema não deve ser descrito como substituto de PEP sem nova decisão. |
| Faturamento/TISS/convênios | **[FORA DO ESCOPO]** | Não pertence ao domínio atual. |
| Telemedicina síncrona | **[FORA DO ESCOPO]** | Sem vídeo ou sala de consulta como capacidade central. |

---

## 5. Fronteiras do domínio

### O que o produto é

- Uma plataforma de coordenação e comunicação em saúde.
- Um sistema operacional para jornadas, mensagens, tarefas e resposta humana.
- Um repositório de dados necessários para segmentação, acompanhamento e
  contexto de comunicação.

### O que o produto não deve afirmar ser

- Um prontuário eletrônico completo.
- Uma ferramenta de diagnóstico ou prescrição autônoma.
- Um ERP hospitalar ou sistema de faturamento.
- Uma plataforma de teleconsulta síncrona.
- Um CRM comercial genérico.

### Fronteira clínica real

O produto **já armazena dados clínicos estruturados ou semiestruturados**, como
forma clínica, fase, comorbidades, alergias, medicamentos, medidas e eventos de
adesão. Portanto, a fronteira correta não é "não guardamos dados clínicos".

A fronteira provisória é:

> Armazenamos apenas os dados clínicos necessários para coordenação,
> comunicação e acompanhamento do cuidado; não pretendemos substituir o
> prontuário longitudinal oficial nem suportar, sem nova decisão, prescrição,
> laudos, resultados de exames ou evolução clínica completa.

Essa fronteira é uma proposta sujeita a validação clínica, jurídica e de
produto. Ver ADR `0006`.

---

## 6. Linguagem ubíqua

O glossário completo está em [`docs/domain/glossary.md`](docs/domain/glossary.md).
Regras essenciais:

- **Paciente**: pessoa sob cuidado, persistida em `patients`.
- **Pessoa**: rótulo de UI mais amplo; não corresponde a uma tabela `people`.
- **Contato da rede de cuidado**: persistido em `contacts` e vinculado a um
  paciente. `care_network_contacts` não é o nome atual da tabela.
- **Audiência**: conceito de domínio; nome técnico atual `audience_segments`.
- **Modelo de mensagem**: conceito amplo; nome técnico `message_templates`.
- **Template Meta**: modelo submetido/sincronizado com a Meta, representado em
  `message_templates` quando `template_kind` indica essa origem.
- **Conversa WhatsApp**: contexto operacional persistido em
  `whatsapp_conversations`; não é apenas o par abstrato paciente-canal.
- **Identidade WhatsApp**: endereço de mensageria em
  `whatsapp_identities`, separado de paciente e contato.
- **Jornada**: automação durável e versionada.
- **Campanha/envio em lote**: disparo delimitado por audiência, persistido em
  `message_batches`; não usar como sinônimo de jornada.
- **Instituição**: unidade de isolamento e operação. Em UI, evitar "tenant".

Termo novo que altera o entendimento do domínio exige atualização do glossário
e, quando houver trade-off estrutural, ADR.

---

## 7. Invariantes essenciais

1. Nenhuma operação deve permitir acesso cruzado entre instituições sem uma
   autorização explícita de superadmin.
2. RLS e validação no servidor são a barreira de segurança; ocultar elementos
   na UI não constitui autorização.
3. Um destinatário de WhatsApp deve ser resolvido por identidade e instituição,
   evitando associação apenas por telefone sem escopo institucional.
4. Mensagem enviada deve possuir instituição e destinatário resolvidos, canal
   permitido e regra de autorização aplicável.
5. Conteúdo de template Meta usado no envio deve corresponder à definição
   aprovada/sincronizada, não a uma edição local divergente.
6. Execuções de jornada precisam ser rastreáveis por versão, passos, tentativas,
   estado e erro.
7. Revogação de autorização não apaga necessariamente o histórico, mas impede
   novos usos incompatíveis com a finalidade; retenção e base legal precisam ser
   definidas por política.
8. Dados clínicos não devem ser expostos em logs, URLs, notificações ou mensagens
   além do mínimo necessário.
9. Toda alteração de schema em `public` deve avaliar GRANT, RLS, políticas,
   índices, auditoria, retenção e impacto multi-instituição.

Detalhes em `docs/domain/model.md`, `docs/domain/consent-and-privacy.md` e
`docs/architecture.md`.

---

## 8. Stack e fontes técnicas

A arquitetura detalhada está em [`docs/architecture.md`](docs/architecture.md).
Resumo **[ATUAL]**:

- React 18, TypeScript 5 e Vite 5;
- React Router 6;
- Tailwind CSS 3 e shadcn/ui/Radix;
- TanStack Query 5 para estado de servidor;
- Vitest e Testing Library;
- Supabase/Lovable Cloud: Postgres, Auth, Storage e Edge Functions em Deno;
- Meta WhatsApp Cloud API, com versão configurável e fallback atual `v25.0`.

### Fontes que não devem ser editadas manualmente

- `src/integrations/supabase/client.ts`;
- `src/integrations/supabase/types.ts`;
- `supabase/config.toml`;
- variáveis `VITE_SUPABASE_*` gerenciadas pela plataforma.

Os tipos gerados podem e devem ser **lidos** para validar documentação e código.

---

## 9. Decisões vigentes

ADRs aceitos descrevem decisões já materializadas:

- `0001` — Supabase/Lovable como backend gerenciado;
- `0002` — isolamento multi-instituição com RLS;
- `0003` — papéis em `user_roles`;
- `0004` — jornadas como grafos JSON versionados;
- `0005` — separação entre identidade, conversa, paciente e contato no WhatsApp;
- `0007` — issue tracker local em Markdown.

ADR proposto:

- `0006` — limite dos dados clínicos armazenados.

Um ADR aceito descreve a decisão vigente, não garante que toda implementação
esteja completa ou livre de dívida.

---

## 10. Questões abertas prioritárias

As perguntas completas e seus impactos estão em
[`docs/domain/open-questions.md`](docs/domain/open-questions.md). As mais
urgentes são:

1. O produto é vertical de Chagas, plataforma genérica ou núcleo genérico com
   módulo vertical?
2. Qual é o conjunto máximo de dados clínicos sob responsabilidade do produto?
3. Quais bases legais, finalidades, retenções e evidências de consentimento se
   aplicam a paciente e contato?
4. SMS é uma capacidade operacional completa ou apenas preparação de schema?
5. `content_library` é global, legada ou deveria ser institucional?
6. Quais estados são canônicos para jornadas, tarefas, mensagens, identidades e
   contatos?
7. Qual é a política para duplicidade de telefone e associação de identidades?
8. Quais SLAs e responsabilidades governam handoff e tarefas humanas?

Perguntas abertas não devem ser resolvidas silenciosamente por um agente.

---

## 11. Mapa da documentação

- `AGENTS.md` — comportamento e fluxo de trabalho.
- `docs/domain/README.md` — índice de domínio.
- `docs/domain/glossary.md` — termos canônicos.
- `docs/domain/model.md` — entidades, relações, invariantes, comandos e eventos.
- `docs/domain/consent-and-privacy.md` — autorização, finalidade e proteção.
- `docs/domain/state-machines.md` — estados atuais e lacunas.
- `docs/domain/current-vs-target.md` — capacidade implementada versus desejada.
- `docs/domain/open-questions.md` — grilling pendente.
- `docs/architecture.md` — arquitetura executável e fluxos técnicos.
- `docs/risks.md` — riscos, controles e dívidas.
- `docs/adr/` — decisões e alternativas.
- `docs/issue-tracker/` — trabalho rastreável.