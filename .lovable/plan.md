# Motor de execução de Jornadas — plano

Substitui o stub atual (localStorage) por persistência real, runner determinístico e agendador. Mantém a UI atual do `JourneyBuilder`/`JourneyList` intacta, apenas trocando a fonte de dados. Preserva contratos das edge functions de envio (`send-whatsapp`) e não altera nenhum schema existente.

## Escopo desta fase

Suportado no runner v1:
- Nós **entrada** (gatilho manual + gatilho por evento `patient.created`, `patient.appointment_upcoming`), **audiencia** (aplica filtro do `audience_segments`), **condicao** (regra simples campo/operador/valor), **whatsapp** (chama `send-whatsapp` com template Meta aprovado), **aguardar** (delay em minutos/horas/dias ou até timestamp), **verificar-resposta** (checa se houve reply na janela), **criar-tarefa** (grava em `journey_tasks`), **notificar-equipe** (marca notificação interna), **encaminhar-humano** (fecha o run + abre conversa priorizada), **encerrar**.
- Nós **sms**, **email**, **pagina-segura** ficam persistidos mas o runner os marca `skipped` com motivo "canal não habilitado" — sem quebrar o fluxo.

Fora do escopo (fica para uma próxima fase):
- Editor visual de arestas condicionais complexas (a v1 usa a ordem das colunas + ramificação binária "sim/não" só no `verificar-resposta` e `condicao`).
- Retry exponencial configurável por nó (v1 tem retry fixo: 3 tentativas, backoff 1min/5min/30min).

## Modelo de dados (nova migração)

Quatro tabelas novas, todas com `institution` para RLS por instituição via `get_user_institution(auth.uid())`:

```
journeys                — 1 linha por jornada
  id, institution, name, goal, status ('rascunho'|'ativa'|'pausada'|'arquivada'),
  trigger jsonb,        — { kind: 'manual'|'event', event?: 'patient.created'|... }
  audience_id uuid null → audience_segments.id,
  graph jsonb,          — { columns: [{id,title,nodes:[...]}] }  (mesma forma do stub)
  version int,          — incrementa a cada publish
  created_by, created_at, updated_at

journey_runs            — 1 linha por pessoa entrando na jornada
  id, journey_id, journey_version, institution, patient_id,
  status ('queued'|'running'|'waiting'|'completed'|'failed'|'stopped'|'handoff'),
  current_node_id text, entered_at, ended_at, error text,
  context jsonb         — variáveis acumuladas (ex: last_message_id)

journey_run_steps       — trilha de auditoria imutável
  id, run_id, node_id, node_kind, status ('ok'|'skipped'|'failed'|'waiting'),
  started_at, finished_at, attempt int, detail jsonb, error text

journey_tasks           — tarefas criadas pelo nó criar-tarefa
  id, institution, run_id, patient_id, title, description,
  assignee_id uuid null, priority ('baixa'|'media'|'alta'),
  status ('aberta'|'concluida'|'cancelada'), due_at, created_at, updated_at
```

Todas seguem o padrão do projeto: GRANT `authenticated`+`service_role`, RLS ligado, políticas via `has_role('admin')` OU `institution = get_user_institution(auth.uid())`. `service_role` tem `ALL` para o runner rodar sem sessão.

Índices: `journey_runs(status, journey_id)`, `journey_runs(patient_id)`, `journey_run_steps(run_id, started_at)`, `journey_tasks(institution, status)`.

## Runner (edge function)

`supabase/functions/journey-runner/index.ts` — executor único, idempotente, chamado tanto pelo cron quanto por invocação manual.

Fluxo por invocação:
1. Seleciona até 25 `journey_runs` com `status IN ('queued','running')` OU `status='waiting' AND resume_at <= now()` (novo campo `resume_at timestamptz` em `journey_runs`, incluso na migração).
2. Para cada run, resolve o próximo nó a partir de `current_node_id` percorrendo `graph` em ordem coluna→nó. Ramifica em `condicao`/`verificar-resposta` via campo `config.branch_true_node_id` / `config.branch_false_node_id`.
3. Aplica o handler do nó (dispatch por `kind`). Grava `journey_run_steps`. Atualiza `current_node_id`.
4. Nó `aguardar` seta `status='waiting'` + `resume_at`. Nó `whatsapp` chama `send-whatsapp` (mesma interface hoje usada pelo `InboxComposer`). Falha marca `status='failed'` após 3 tentativas.
5. Nó `encerrar`/fim de grafo → `status='completed'`, `ended_at=now()`.

Segurança: função usa `SUPABASE_SERVICE_ROLE_KEY`, valida payload com Zod, verifica assinatura HMAC do cron via header `x-runner-secret` (novo secret `JOURNEY_RUNNER_SECRET` — vou pedir com `add_secret`).

## Enfileirador de eventos

`supabase/functions/journey-enroll/index.ts` — recebe `{ journey_id, patient_ids[] }` (enroll manual) ou `{ event, patient_id }` (enroll por evento). Cria `journey_runs` com `status='queued'` respeitando: consentimento válido, canal disponível, não já ativo na mesma jornada (dedupe por `journey_id + patient_id + status IN queued/running/waiting`).

Gatilhos por evento **nesta fase** são disparados explicitamente pelo app (ex: após `INSERT` em `patients` o front chama `journey-enroll` com `event='patient.created'`). Trigger SQL fica marcado como TODO — evita acoplamento pesado agora.

## Agendador

Ativa `pg_cron` + `pg_net` e agenda via `supabase--insert` (não migração, pois carrega URL+anon key específicas do projeto):

```
cron.schedule('journey-runner-tick', '* * * * *',
  select net.http_post(url:='.../functions/v1/journey-runner',
    headers:=jsonb com Content-Type + apikey + x-runner-secret,
    body:='{"tick":true}'))
```

Tick de 1 minuto. Idempotência: cada run tem `SELECT ... FOR UPDATE SKIP LOCKED` para evitar processamento duplo.

## Camada de acesso no front

- `src/features/journeys/api.ts` — funções `listJourneys/getJourney/saveJourney/publishJourney/pauseJourney/enrollPatients/listRuns/listTasks` usando o client Supabase.
- `useJourneys.ts` reescrito com `@tanstack/react-query`, mantendo a assinatura (`journeys`, `create`, `update`, `remove`, `duplicate`) e adicionando `publish`, `pause`, `enroll`.
- `useJourney(id)` idem, mantendo `addNode/removeNode/patchNode/addColumn/...`.
- Migração one-shot: se existir `localStorage['ccc:journeys:v1']`, um botão discreto "Importar rascunhos locais" no `JourneyList` copia para o banco e limpa o storage. Nada é migrado automaticamente para evitar duplicação silenciosa.

## Mudanças de UI

Mínimas, focadas em expor o motor:
- `JourneyList`: badges de `status` reais (`ativa`/`pausada`/`rascunho`/`arquivada`) + botões `Publicar`/`Pausar`/`Duplicar`. Métricas do card puxam `count()` real de `journey_runs` por status nas últimas 30 dias.
- `JourneyBuilder`: novo header com `Salvar rascunho`, `Publicar`, `Pausar`, seletor de audiência (dropdown com `audience_segments`), gatilho (manual|evento). Substitui o `PreviewBanner` por um `RunStatusBanner` mostrando "N pessoas ativas / M aguardando / K concluídas hoje".
- Nova aba lateral **Execuções** no builder: tabela paginada de `journey_runs` com filtro por status + drawer com `journey_run_steps` do run selecionado (auditoria).
- Nova página `/app/jornadas/tarefas` listando `journey_tasks` da instituição (assumir / concluir / cancelar).

## Ordem de execução

1. Migração (tabelas + RLS + GRANTs + índices + campo `resume_at`).
2. Solicitar secret `JOURNEY_RUNNER_SECRET`.
3. Edge functions `journey-runner` e `journey-enroll`.
4. Habilitar `pg_cron`+`pg_net` e agendar tick via `supabase--insert`.
5. Camada de acesso (`api.ts` + hooks reescritos).
6. Ajustes de UI (header do builder, status reais, aba Execuções, página Tarefas).
7. Verificação: criar jornada de teste "Boas-vindas" → publicar → enroll manual em 1 paciente → observar `journey_runs` avançar pelos nós → conferir mensagem WhatsApp enviada em `messages`.

## Detalhes técnicos

- Contratos preservados: nenhuma alteração em `messages`, `patients`, `audience_segments`, `send-whatsapp`, `approvedTemplatePayload`. O runner é consumidor puro dessas APIs.
- Formato `graph` idêntico ao `Journey.columns` atual, então o `JourneyBuilder` continua funcionando sem refatoração estrutural — só troca a fonte de dados.
- Retenção: `journey_run_steps` só cresce; incluir cleanup manual (documentado, não implementado) em `> 180 dias`.
- Observabilidade: cada step grava `detail jsonb` com o request/response resumido; página `/app/insights` ganhará seção "Jornada" alimentada por `journey_runs` (fase posterior — não neste plano).

Posso começar pela migração?
