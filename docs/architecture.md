# Arquitetura — Chagas Digital Care

> Onboarding técnico do estado atual. Leia primeiro `CONTEXT.md` e
> `docs/domain/README.md`. Nomes de tabelas e capacidades aqui foram alinhados
> ao código e aos tipos gerados; intenções futuras são marcadas explicitamente.

---

## 1. Visão de contexto — C4 nível 1

```text
┌────────────────────┐
│ Paciente / contato │
│ WhatsApp / cadastro│
└─────────┬──────────┘
          │
          ▼
┌───────────────────────────────────────────────────────────────┐
│                    Chagas Digital Care                        │
│                                                               │
│ SPA React ──► Supabase/Lovable Cloud                          │
│              Auth + Postgres/RLS + Storage + Edge Functions   │
└──────────▲───────────────────────┬────────────────────────────┘
           │                       │
┌──────────┴──────────┐            ▼
│ Equipe / Admin      │   ┌──────────────────────┐
│ institucional       │   │ Meta WhatsApp Cloud │
└─────────────────────┘   │ API                  │
                          └──────────────────────┘
           ▲
┌──────────┴──────────┐
│ Superadmin          │
│ operação transversal│
└─────────────────────┘
```

### Atores

- paciente;
- contato da rede de cuidado;
- equipe;
- admin institucional;
- superadmin.

### Sistemas externos comprovados

- Meta WhatsApp Cloud API;
- serviço de resolução de CEP usado pelo cadastro, conforme implementação.

### Sistemas apenas sugeridos por dados

- CRM: existe `crm_sync_log`, mas integração ativa e contrato precisam ser
  inventariados.

---

## 2. Princípios arquiteturais vigentes

1. **SPA sem backend Node dedicado:** o frontend acessa Supabase e edge
   functions.
2. **Backend gerenciado:** Postgres, Auth, Storage e Edge Functions via
   Supabase/Lovable.
3. **Autorização no banco/servidor:** RLS, funções `has_role` e
   `get_user_institution`; UI não é barreira de segurança.
4. **Multi-instituição:** recursos usam instituição direta ou vínculo transitivo.
5. **Estado de servidor no TanStack Query:** cache e sincronização no frontend.
6. **Jornadas versionadas:** definição em JSON, execução persistida com versão e
   steps.
7. **Mensageria desacoplada de pessoa:** identidade e conversa WhatsApp são
   entidades próprias.
8. **Integração externa em edge functions:** segredos não chegam ao navegador.

ADRs `0001` a `0005` registram as decisões estruturais.

---

## 3. Containers — C4 nível 2

### 3.1 Frontend SPA

- React 18 + TypeScript 5 + Vite 5;
- React Router 6;
- TanStack Query 5;
- Tailwind CSS 3;
- shadcn/ui e Radix;
- Supabase client gerado;
- Vitest + Testing Library.

Responsabilidades:

- autenticação/sessão;
- navegação e experiência por papel;
- consultas e mutações permitidas por RLS;
- invocação de edge functions;
- edição de jornada, conteúdo, templates e cadastros;
- inbox e acompanhamento operacional.

### 3.2 Postgres

Responsabilidades:

- persistência transacional;
- relações entre pessoas, mensagens, jornadas e operação;
- RLS e funções auxiliares;
- filas/estados persistidos para processamento assíncrono;
- auditoria específica e health de integrações.

### 3.3 Supabase Auth

Responsabilidades:

- identidade do usuário autenticado;
- sessão/JWT;
- integração com `profiles` e `user_roles`.

### 3.4 Storage

Responsabilidades:

- mídia de WhatsApp/templates;
- acesso privado e URLs assinadas;
- escopo por instituição no path/policy.

### 3.5 Edge Functions Deno

Responsabilidades:

- integração com Meta;
- webhooks públicos;
- operações que usam segredos/service role;
- processamento de jornada e lote;
- onboarding público;
- exclusão de conta.

### 3.6 Meta WhatsApp Cloud API

Responsabilidades externas:

- recebimento de mensagens;
- entrega e status;
- gestão de templates;
- IDs de mídia, telefone e WABA;
- janela e regras operacionais do WhatsApp.

---

## 4. Rotas do frontend

Fonte: `src/App.tsx`.

### Públicas

| Rota | Responsabilidade |
| --- | --- |
| `/` | entrada/landing |
| `/auth` | autenticação |
| `/politica-de-privacidade` | política de privacidade |
| `/termos-de-uso` | termos de uso |
| `/exclusao-de-dados` | orientação de exclusão |
| `/cadastro/:token` | onboarding público |

### Superadmin

| Rota | Responsabilidade |
| --- | --- |
| `/superadmin/dashboard` | visão operacional |
| `/superadmin/instituicoes` | instituições |
| `/superadmin/canais` | canais |
| `/superadmin/whatsapp/configuracoes` | configuração WhatsApp |
| `/superadmin/whatsapp/templates` | visão transversal de templates |
| `/superadmin/whatsapp/diagnostico` | diagnóstico da integração |
| `/superadmin/auditoria` | audit log |

Proteção: `RequireSuperAdmin` + layout próprio. A proteção visual não substitui
RLS/autorização no servidor.

### Aplicação institucional

| Rota | Responsabilidade |
| --- | --- |
| `/app/hoje` | rotina e prioridades |
| `/app/pessoas` | lista de pessoas/pacientes |
| `/app/pessoas/:id` | detalhe orientado à nova IA |
| `/app/caixa` | inbox de cuidado |
| `/app/jornadas` | jornadas |
| `/app/jornadas/tarefas` | tarefas |
| `/app/jornadas/:id` | editor da jornada |
| `/app/biblioteca` | biblioteca de conteúdo |
| `/app/audiencias` | audiências |
| `/app/insights` | métricas |
| `/app/admin/modelos-meta*` | modelos/templates Meta |
| `/app/admin/instituicao` | instituição |
| `/app/admin/equipe` | equipe |
| `/app/admin/privacidade` | configurações/visão de privacidade |
| `/app/admin/perfil` | perfil |

### Legado

Existem redirects para rotas antigas (`pacientes`, `mensagens`, `conteudos`,
`segmentos`, `relatorios` etc.) e uma rota de ficha clínica completa em
`/app/pacientes/:id`.

Implicações:

- bookmarks antigos são preservados;
- documentação e analytics devem distinguir rota canônica de rota legada;
- remoção exige inventário de uso e plano de migração;
- a coexistência de `PersonDetail` e `PatientDetail` indica duas experiências
  que precisam de convergência planejada.

---

## 5. Camadas e módulos frontend

A estrutura usa páginas, componentes compartilhados, libs e feature slices.

### Domínios de experiência

- **people/patients:** lista, detalhe, ficha clínica, contatos e pendências;
- **today:** rotina e priorização;
- **inbox:** conversas, thread, composer e contexto;
- **journeys:** editor, catálogo de nós, runs e tarefas;
- **library/content:** conteúdo reutilizável;
- **audiences:** filtros e edição de audiência;
- **meta templates:** criação, edição e sincronização;
- **insights/reports:** métricas;
- **channels/integrations:** saúde e configuração de integração;
- **privacy/admin:** equipe, instituição, perfis e controles.

### Transversal

- `src/lib/auth.tsx`: sessão;
- `src/lib/access.tsx`: papéis e instituição do usuário;
- `src/integrations/supabase/*`: client e tipos gerados;
- layouts de app e superadmin;
- services/helpers de WhatsApp, targeting e identidade institucional.

### Regras

- consultas remotas passam por TanStack Query quando representam estado de
  servidor;
- acesso e instituição devem vir do contexto autenticado, não de campo editável;
- componentes não devem executar regra sensível apenas no cliente;
- nomes de negócio não devem gerar nomes de tabela presumidos.

---

## 6. Modelo de dados por contexto

Fonte principal: `src/integrations/supabase/types.ts`.

### 6.1 Identidade e acesso

| Tabela | Papel |
| --- | --- |
| `profiles` | dados do usuário e instituição; `role_label` é descritivo |
| `user_roles` | papéis autorizativos `admin`, `equipe`, `superadmin` |

Funções:

- `has_role(_user_id, _role)`;
- `get_user_institution(_user_id)`;
- `is_superadmin(_user_id)`;
- `can_access_patient(_patient_id, _user_id)`.

### 6.2 Pessoas e cuidado

| Tabela | Papel | Tenancy |
| --- | --- | --- |
| `patients` | paciente e contexto clínico/cadastral | direta por `institution` |
| `contacts` | contatos vinculados ao paciente | transitiva por `patient_id` |
| `medications` | medicamentos estruturados | transitiva por `patient_id` |
| `adherence_events` | eventos de adesão | transitiva por `patient_id` |
| `onboarding_invites` | convites públicos | direta por `institution` |

### 6.3 Audiências, conteúdo e lotes

| Tabela | Papel | Tenancy |
| --- | --- | --- |
| `audience_segments` | audiências/filtros | direta |
| `message_batches` | envios em lote | direta |
| `content_folders` | pastas de conteúdo | direta |
| `content_library` | itens de conteúdo | **sem coluna direta no tipo; decisão pendente** |
| `quick_replies` | respostas rápidas | direta |
| `message_templates` | modelos e templates Meta | direta |

### 6.4 Jornadas

| Tabela | Papel | Tenancy |
| --- | --- | --- |
| `journeys` | definição e grafo | direta |
| `journey_runs` | execução por paciente | direta + relação |
| `journey_run_steps` | histórico de passos | transitiva pelo run |
| `journey_tasks` | trabalho humano | direta + relações |

### 6.5 WhatsApp/mensageria

| Tabela | Papel | Tenancy |
| --- | --- | --- |
| `messages` | mensagens e status | coluna `institution` nullable + relações |
| `whatsapp_identities` | endereço e opt-in | direta |
| `whatsapp_conversations` | contexto de conversa/janela | direta |
| `whatsapp_channels` | canal por instituição | direta |
| `institution_whatsapp_settings` | branding/assinatura | direta |
| `whatsapp_media_assets` | mídia | direta |
| `whatsapp_template_header_media` | mídia de header de template | validar no schema/policies |
| `whatsapp_admin_audit_log` | auditoria administrativa | instituição nullable para escopo global |
| `whatsapp_integration_health` | saúde/diagnóstico | escopo definido por campos próprios |
| `whatsapp_webhook_activity` | atividade de webhook | instituição nullable durante resolução |
| `whatsapp_unmatched_events` | eventos ainda não associados | instituição/identidade opcionais |

### 6.6 Outros

- `crm_sync_log`: log genérico de sincronização, sem contrato ativo documentado.

---

## 7. Estratégias de tenancy

A afirmação "toda tabela operacional possui `institution`" é incorreta. Existem
quatro estratégias:

### A. Instituição direta

A tabela contém `institution`; RLS compara com
`get_user_institution(auth.uid())` ou permite superadmin.

Exemplos: `patients`, `journeys`, `journey_runs`, `journey_tasks`,
`message_templates`, `whatsapp_identities`.

### B. Instituição transitiva

A tabela é protegida por join com um pai institucional.

Exemplos:

- `contacts` → `patients`;
- `medications` → `patients`;
- `adherence_events` → `patients`;
- `journey_run_steps` → `journey_runs`.

Requisitos:

- FK obrigatória quando possível;
- policy com `EXISTS`/helper estável e indexado;
- testes de cross-tenant;
- operação com service role deve repetir a validação.

### C. Escopo global/administrativo

Recursos podem não pertencer a uma instituição ou usar `institution = null`.
Exigem papel de superadmin, motivo e auditoria.

### D. Estado não resolvido

Eventos públicos podem chegar antes de a instituição ser identificada. Devem
ficar em quarentena operacional com dados mínimos e ser vinculados de modo
auditável.

---

## 8. Edge functions

Lista derivada da documentação e caminhos existentes; a existência e o contrato
final devem ser verificados no diretório `supabase/functions/` em mudanças.

| Função | Entrada | Responsabilidade | Autorização esperada |
| --- | --- | --- | --- |
| `send-whatsapp` | JWT + `message_id` | resolver destinatário e enviar mensagem | valida recurso via client RLS antes de usar service role |
| `whatsapp-webhook` | HTTP público Meta | receber mensagens e status | assinatura/verificação Meta + idempotência |
| `whatsapp-diagnostics` | superadmin | testar e diagnosticar canal | papel + auditoria |
| `create-whatsapp-template` | usuário autorizado | criar template na Meta | instituição, papel, ownership |
| `sync-whatsapp-templates` | UI/cron | sincronizar definições/status | instituição ou operação controlada |
| `upload-whatsapp-template-media` | usuário autorizado | enviar mídia de template | tipo/tamanho + instituição |
| `upload-whatsapp-media` | usuário autorizado | preparar mídia de mensagem | instituição + storage privado |
| `repair-whatsapp-channel` | superadmin | reparar configuração | auditoria e validação rígida |
| `journey-enroll` | UI/integração | criar run | jornada/paciente mesma instituição |
| `journey-runner` | cron/manual protegido | avançar runs | segredo/claim + idempotência |
| `process-message-batch` | cron | processar lote | instituição + revalidação de elegibilidade |
| `public-onboarding` | token público | concluir cadastro | token, expiração, escopo, rate limit |
| `create-onboarding-invite` | usuário autorizado | criar convite | instituição e finalidade |
| `delete-account` | usuário | exclusão de conta | identidade, escopo e política de retenção |

### Padrão obrigatório ao usar service role

1. autenticar ou validar segredo/webhook;
2. validar ator e papel;
3. validar acesso ao recurso por RLS ou consulta institucional explícita;
4. somente então usar client admin;
5. registrar ação/resultado sem dado excessivo.

---

## 9. Fluxos críticos

### 9.1 Envio WhatsApp

```text
UI / jornada / lote
    │ cria ou seleciona `messages` (outbound/queued)
    ▼
edge `send-whatsapp`
    │ autentica JWT
    │ consulta mensagem pelo client RLS
    │ lê dados completos pelo client admin
    │ resolve paciente/contato/identidade/instituição
    │ verifica canal, template e configuração
    │ chama Meta Graph API
    ▼
`messages`: sent/failed + external_message_id
    │
    ▼
webhook Meta atualiza delivered/read/failed
```

Pontos críticos:

- o código normaliza telefones BR e considera variantes com/sem nono dígito;
- conflito de identidades precisa de política explícita;
- envio de template usa definição sincronizada aprovada;
- opt-in/finalidade deve ser consolidado entre contato e identidade;
- retry e callbacks precisam de idempotência.

### 9.2 Inbound WhatsApp

```text
Meta webhook
    │ verifica origem e deduplica
    ▼
resolve canal/instituição/identidade
    │
    ├── conhecida ──► conversa + mensagem inbound
    │
    └── desconhecida ──► identidade/evento não associado
                              │
                              ▼
                         triagem/vínculo auditável
```

### 9.3 Execução de jornada

```text
UI / gatilho / integração
    │ `journey-enroll`
    ▼
`journey_runs` queued + journey_version
    │
    ▼
cron/manual `journey-runner`
    │ claim atômico (requisito)
    │ resolve nó na versão
    │ executa handler
    │ grava `journey_run_steps`
    │ atualiza current_node/resume/status
    ▼
waiting | completed | failed | stopped | handoff
```

### 9.4 Envio em lote

```text
audience/filter + content/template
    │ cria `message_batches`
    ▼
process-message-batch
    │ resolve destinatários
    │ revalida instituição, canal, autorização e deduplicação
    │ cria/enfileira mensagens
    ▼
contadores, erros e conclusão do lote
```

### 9.5 Onboarding público

```text
equipe cria convite
    │ token com instituição/expiração
    ▼
/cadastro/:token
    │ formulário público
    ▼
public-onboarding
    │ valida token e payload
    │ cria/atualiza paciente/contato
    │ registra evidência aplicável
    │ marca convite concluído
```

---

## 10. Autenticação e autorização

### Frontend

`AccessProvider` consulta:

- papéis em `user_roles`;
- instituição em `profiles`.

Deriva:

- `isSuperAdmin`;
- `isInstitutionAdmin`;
- `isTeamMember`.

Isso controla experiência, não substitui autorização persistente.

### Banco

- RLS por instituição/papel;
- helpers `SECURITY DEFINER` precisam ser pequenos, estáveis, com search path e
  grants revisados;
- policies de tabelas transitivas precisam de índices;
- superadmin deve ser exceção explícita, não fallback acidental.

### Edge functions

- JWT do usuário para ações interativas;
- segredo/verificação para cron/webhook;
- service role apenas após autorização contextual;
- CORS não é controle de acesso.

---

## 11. Segredos e configuração

### Permitido no frontend

Somente valores publicáveis exigidos pelo cliente Supabase, gerenciados pela
plataforma.

### Somente servidor/edge

- `WHATSAPP_TOKEN`;
- `WHATSAPP_PHONE_NUMBER_ID` quando não for configuração persistida segura;
- `WHATSAPP_APP_SECRET`;
- `WHATSAPP_VERIFY_TOKEN`;
- `JOURNEY_RUNNER_SECRET`;
- service role key;
- segredos de provedores futuros.

A versão Graph é configurável por `WHATSAPP_GRAPH_VERSION`, com fallback
observado `v25.0`. Alteração de versão exige teste de contrato.

---

## 12. Storage e mídia

Princípios:

- bucket privado;
- path inicia com instituição;
- policy valida bucket, path e instituição;
- URL assinada de curta duração;
- validar MIME real, extensão, tamanho e tipo permitido;
- registrar hash/ID externo quando necessário;
- expirar e limpar assets;
- nunca aceitar path fornecido pelo cliente sem normalização.

---

## 13. Cache, consistência e realtime

O `QueryClient` atual usa, por padrão:

- `staleTime` de 5 minutos;
- `gcTime` de 30 minutos;
- sem refetch automático em foco, reconexão ou mount;
- um retry.

Consequências:

- troca de rota é rápida;
- dados operacionais podem permanecer visualmente desatualizados;
- mensagens, tarefas, status Meta e runs críticos precisam invalidar cache ou
  usar realtime/refetch direcionado;
- mutações devem atualizar/invalidate chaves corretas;
- não ampliar caching agressivo para dados críticos sem avaliar stale state.

---

## 14. Observabilidade mínima

### Correlation IDs

Propagar entre:

- ação do frontend;
- edge function;
- chamada externa;
- webhook;
- mensagem/run/audit log.

### Métricas recomendadas

- mensagens queued por idade;
- taxa sent/delivered/read/failed;
- falhas por template/código;
- atraso de webhook;
- runs por estado e idade;
- runs waiting além do esperado;
- tarefas vencidas/sem responsável;
- lotes em processamento e falhas parciais;
- saúde de canais e última sincronização.

### Alertas mínimos

- aumento de falha de envio;
- webhook sem atividade;
- runner atrasado;
- backlog de mensagens/runs;
- template principal pausado/rejeitado;
- tentativa de acesso cross-tenant;
- falha de policy/storage.

Logs devem ser estruturados e sanitizados.

---

## 15. Testes arquiteturais prioritários

### Tenancy

Para cada recurso:

- usuário da mesma instituição consegue a operação prevista;
- usuário de outra instituição não lê nem altera;
- usuário sem papel não obtém elevação;
- superadmin somente no fluxo permitido;
- service role não ignora validação de negócio.

### WhatsApp

- telefone inválido;
- identidade duplicada;
- contato revogado;
- template não aprovado;
- template de outra instituição;
- webhook duplicado/fora de ordem;
- janela expirada;
- mídia expirada;
- provider timeout após aceitar mensagem.

### Jornadas

- versão imutável;
- claim concorrente;
- espera/retomada;
- retry idempotente;
- nó inexistente;
- template pausado;
- handoff;
- paciente de outra instituição.

### Onboarding

- token expirado, revogado, reutilizado ou inválido;
- rate limit;
- payload excessivo/malformado;
- instituição incorreta;
- atualização de paciente existente;
- minimização de `completed_payload`.

---

## 16. Deploy e ambientes

Estado documentado:

- preview e publicação via Lovable;
- Supabase/Lovable Cloud para backend;
- edge functions versionadas em `supabase/functions/`;
- migrations em `supabase/migrations/`;
- `journey-runner` acionado por cron, frequência descrita historicamente como um
  minuto — confirmar no ambiente antes de depender desse SLA;
- `supabase/config.toml` marca `whatsapp-webhook` com `verify_jwt = false`, como
  esperado para endpoint público, exigindo verificação própria do provedor.

A documentação não deve declarar CI/CD independente enquanto não houver
workflow comprovado.

---

## 17. Dívidas e riscos prioritários

Registro completo: `docs/risks.md`.

Prioridades arquiteturais:

1. auditar tenancy de tabelas transitivas e edge functions com service role;
2. consolidar autorização entre contato e identidade;
3. formalizar idempotência de webhook, envio e runner;
4. decidir fronteira clínica;
5. resolver tenancy da biblioteca;
6. inventariar e tipar estados;
7. definir handoff/SLA;
8. eliminar fontes duplicadas de medicação;
9. estabelecer observabilidade e alertas.

---

## 18. Checklist para mudança arquitetural

- Qual bounded context é afetado?
- É estado atual ou alvo?
- Qual instituição possui o dado?
- Tenancy é direta, transitiva, global ou não resolvida?
- Qual RLS/policy protege?
- Usa service role?
- Qual dado pessoal/clínico é tratado?
- Qual finalidade e retenção?
- Há efeito externo e idempotência?
- Qual máquina de estados muda?
- Qual comportamento de retry/cancelamento?
- Que métricas e logs serão produzidos?
- Exige migration/backfill?
- Exige ADR?
- Quais documentos e testes precisam mudar?