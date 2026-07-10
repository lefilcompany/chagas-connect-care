# Estado atual versus visão futura

Este documento impede que intenção de produto seja descrita como capacidade
existente. A classificação deve ser atualizada junto com código e issues.

## Legenda

- **Atual:** evidência direta no código, schema, rotas ou pipeline validada.
- **Parcial:** existe representação ou parte do fluxo, sem cobertura ponta a
  ponta comprovada.
- **Alvo:** direção desejada, sem implementação suficiente.
- **Não decidido:** depende de decisão de produto ou domínio.

---

## Capacidades

| Capacidade | Estado | Evidência/observação | Próximo passo |
| --- | --- | --- | --- |
| Cadastro de pacientes | Atual | `patients`, rotas de pessoas/paciente e onboarding. | Definir fonte dos dados e validação clínica. |
| Rede de cuidado | Atual | `contacts` vinculados a `patients`. | Formalizar representação, autorização e duplicidade. |
| Dados clínicos limitados | Atual | Campos em `patients`, `medications`, `adherence_events`. | Decidir fronteira e retenção no ADR 0006. |
| WhatsApp outbound | Atual | `messages`, `send-whatsapp`, canais e templates. | Consolidar idempotência e matriz de elegibilidade. |
| WhatsApp inbound | Atual | webhook, identidades e conversas. | Formalizar deduplicação e vínculo de desconhecidos. |
| Templates Meta | Atual | `message_templates` com campos `meta_*`. | Padronizar estados e versionamento. |
| Mídia WhatsApp | Atual | assets, Storage e funções de upload. | Documentar retenção e expiração. |
| Caixa de conversas | Atual | rota `/app/caixa`, conversas e mensagens. | Definir SLA, ownership e resolução. |
| SMS | Parcial | enum `message_channel` inclui `sms`. | Verificar provedor, envio, webhook, UI e consentimento. |
| E-mail | Alvo | não consta no enum atual. | Criar ADR e issue antes de anunciar suporte. |
| Audiências dinâmicas | Atual | `audience_segments`. | Definir snapshot versus avaliação no envio. |
| Envio em lote | Atual | `message_batches`. | Documentar cancelamento, retry e falhas parciais. |
| Jornadas em grafo | Atual | `journeys.graph`, runner, runs e steps. | Formalizar catálogo de nós e validação. |
| Tarefas humanas | Atual | `journey_tasks` e rota de tarefas. | Adicionar SLA, conclusão auditável e handoff. |
| Próxima melhor ação | Parcial/não decidido | conceito aparece na experiência, mas motor canônico não está documentado. | Definir regras, explicabilidade e se é clínico ou operacional. |
| Biblioteca de conteúdo | Atual com lacuna | `content_library`, `content_folders`. | Decidir tenancy e governança editorial. |
| Revisão clínica/privacidade de conteúdo | Não comprovado | estados descritos na documentação antiga não estão evidenciados no schema consultado. | Não tratar como implementado sem código e dados. |
| Multi-instituição | Atual | `institution`, RLS, helpers e perfis. | Auditar tabelas sem instituição direta. |
| Superadmin | Atual | papel, layout e rotas dedicadas. | Restringir acesso sensível por necessidade e auditoria. |
| Auditoria | Parcial | logs específicos de WhatsApp. | Definir auditoria transversal de domínio e acesso. |
| Integração CRM | Parcial/legado | `crm_sync_log` existe; contrato não está documentado. | Identificar integração ativa ou remover expectativa. |
| Prontuário eletrônico completo | Fora do alvo atual | produto armazena contexto clínico, mas não possui escopo de PEP completo. | Não expandir sem decisão estratégica e regulatória. |
| Telemedicina síncrona | Fora do alvo atual | sem fluxo central de vídeo ou consulta. | Exige novo bounded context se priorizada. |
| Faturamento/TISS | Fora do alvo atual | sem domínio correspondente. | Manter fora do escopo. |

---

## Arquitetura e operação

| Item | Estado | Observação |
| --- | --- | --- |
| SPA React/Vite | Atual | Rotas públicas, app e superadmin no mesmo frontend. |
| Supabase/Lovable Cloud | Atual | Postgres, Auth, Storage e Edge Functions. |
| TanStack Query | Atual | Estado de servidor e cache. |
| RLS | Atual, requer auditoria contínua | A CI reconstrói migrations e valida same-tenant e cross-tenant; novas tabelas ainda exigem revisão específica. |
| CI com Quality gate | Atual | GitHub Actions executa governança, lint, TypeScript, unitários, cobertura, build e E2E funcional com Supabase local. |
| Entrega de artefato | Atual | Push na `main` produz bundle e manifesto validados. |
| Deploy automático no Lovable | Não implementado | A publicação efetiva permanece fora do workflow até existir mecanismo oficial adotado. |
| Observabilidade centralizada | Parcial | Logs e health específicos do WhatsApp; não há SLOs documentados. |
| Event bus/event store | Não implementado | Eventos de domínio são conceituais, não infraestrutura atual. |
| Runner de jornada | Atual | Edge Function e cron descritos. |
| Lock distribuído do runner | Não comprovado | Risco de concorrência permanece. |
| Catálogo tipado de estados | Parcial | Muitos status são strings. |
| Contratos versionados de integração | Parcial | Versão Graph configurável; demais contratos precisam de documentação. |

---

## Produto: hipótese de organização

A implementação atual combina:

- infraestrutura genérica de comunicação e jornadas;
- conceitos clínicos específicos, como `patient_stage`, forma clínica,
  medicamentos e adesão;
- marca e experiência orientadas a Chagas.

Três posições estratégicas continuam possíveis:

1. vertical exclusivamente de Chagas;
2. plataforma genérica de coordenação de cuidado;
3. núcleo genérico com módulo vertical de Chagas.

Até decisão, não mover conceitos específicos para o núcleo genérico nem remover
a especificidade clínica existente. A recomendação técnica preliminar é a opção
3, registrada apenas como hipótese em `open-questions.md`.

---

## Critério de promoção de estado

Uma capacidade só muda para **Atual** quando houver:

1. contrato ou modelo definido;
2. persistência e autorização adequadas;
3. fluxo principal e falhas cobertos;
4. UI ou integração utilizável;
5. observabilidade mínima;
6. testes e validação;
7. documentação atualizada;
8. rollout ou ambiente confirmado.

Ter tabela, enum, tela isolada ou artifact sem publicação não comprova a
capacidade completa.
