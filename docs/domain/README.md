# Domínio — Chagas Digital Care

Esta pasta descreve o produto usando linguagem de negócio, regras, relações,
estados e perguntas. Nomes técnicos são registrados para manter rastreabilidade,
mas o modelo não deve ser reduzido ao schema.

## Ordem de leitura

1. [`glossary.md`](glossary.md) — linguagem ubíqua e mapeamento técnico.
2. [`model.md`](model.md) — contextos, entidades, invariantes, comandos e eventos.
3. [`consent-and-privacy.md`](consent-and-privacy.md) — identidade, autorização,
   finalidade, revogação e proteção de dados.
4. [`state-machines.md`](state-machines.md) — estados observados, transições e
   lacunas de padronização.
5. [`current-vs-target.md`](current-vs-target.md) — o que existe, o que é parcial
   e o que é visão futura.
6. [`open-questions.md`](open-questions.md) — perguntas da sessão de grilling que
   ainda exigem decisão humana.

## Princípios do modelo

- **O paciente é o centro do cuidado, mas não é a única identidade.** Um contato
  e uma identidade WhatsApp têm ciclos de vida próprios.
- **Comunicar é uma ação regulada.** Ter telefone não significa ter permissão,
  finalidade ou janela operacional para enviar qualquer conteúdo.
- **Automação não elimina responsabilidade humana.** Jornadas devem produzir
  rastreabilidade, tarefas e handoff quando necessário.
- **Estado atual não é visão futura.** Uma intenção de produto não pode ser
  documentada como capacidade implementada.
- **Schema não é domínio.** Uma mesma entidade de negócio pode envolver várias
  tabelas; uma tabela pode ser legado ou detalhe técnico.
- **Dados clínicos exigem minimização.** O sistema já os armazena, portanto a
  fronteira deve ser explícita e governada.

## Bounded contexts propostos

Os contextos abaixo refletem a implementação e servem como ferramenta de
organização. A separação física em módulos não é obrigatória.

| Contexto | Responsabilidade | Entidades principais |
| --- | --- | --- |
| **Identidade e acesso** | Usuários autenticados, papéis e instituição. | `profiles`, `user_roles`. |
| **Pessoas e cuidado** | Pacientes, contatos, dados clínicos limitados e adesão. | `patients`, `contacts`, `medications`, `adherence_events`. |
| **Consentimento e identidade de canal** | Endereço WhatsApp, opt-in/out, finalidades e associação. | `whatsapp_identities`, campos de autorização em `contacts`. |
| **Conversas e mensagens** | Threads, mensagens, status, mídia e janela de atendimento. | `whatsapp_conversations`, `messages`, `whatsapp_media_assets`. |
| **Conteúdo e templates** | Conteúdo reutilizável, respostas rápidas e modelos Meta. | `content_library`, `content_folders`, `quick_replies`, `message_templates`. |
| **Audiências e disparos** | Segmentação e envios delimitados. | `audience_segments`, `message_batches`. |
| **Jornadas e trabalho humano** | Automação versionada, execução, passos e tarefas. | `journeys`, `journey_runs`, `journey_run_steps`, `journey_tasks`. |
| **Administração e operação** | Canais, identidade institucional, diagnóstico e auditoria. | `whatsapp_channels`, `institution_whatsapp_settings`, logs de integração. |

## Dependências conceituais

```text
Identidade e acesso
        │
        ▼
Pessoas e cuidado ───────► Consentimento e identidade de canal
        │                               │
        │                               ▼
        ├──────────────► Conversas e mensagens
        │                               ▲
        ├──────────────► Audiências e disparos
        │                               │
        └──────────────► Jornadas e trabalho humano
                                        │
Conteúdo e templates ───────────────────┘

Administração e operação suporta todos os contextos.
```

## Regra para mudanças

- Novo termo: glossário.
- Nova regra ou relação: modelo.
- Novo estado/transição: state machines.
- Mudança de dado pessoal/finalidade: consentimento e privacidade.
- Capacidade ainda não entregue: current-vs-target.
- Pergunta sem resposta: open-questions.
- Decisão difícil de reverter: ADR.