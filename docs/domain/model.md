# Modelo de domínio

Este documento descreve o domínio além das tabelas: responsabilidades,
agregados, relações, invariantes, comandos, eventos e falhas esperadas.

---

## 1. Context map

```text
┌──────────────────────┐
│ Identidade e acesso  │
└──────────┬───────────┘
           │ usuário, papel, instituição
           ▼
┌──────────────────────┐        ┌─────────────────────────────┐
│ Pessoas e cuidado    │───────►│ Consentimento e identidade │
└──────┬───────┬───────┘        │ de canal                    │
       │       │                └──────────────┬──────────────┘
       │       │                               │
       │       ▼                               ▼
       │  ┌──────────────────────┐   ┌───────────────────────┐
       │  │ Audiências e lotes   │──►│ Conversas e mensagens│
       │  └──────────────────────┘   └───────────▲───────────┘
       │                                         │
       ▼                                         │
┌──────────────────────┐                         │
│ Jornadas e tarefas   │─────────────────────────┘
└──────────▲───────────┘
           │
┌──────────┴───────────┐
│ Conteúdo e templates │
└──────────────────────┘
```

Administração e operação atravessam todos os contextos.

---

## 2. Agregados e responsabilidades

### 2.1 Paciente

**Raiz:** `patients`.

**Responsabilidades:**

- identificar a pessoa sob cuidado dentro de uma instituição;
- concentrar contexto cadastral e clínico limitado;
- ancorar contatos, medicamentos, adesão, jornadas, tarefas e mensagens;
- permitir ownership operacional por `owner_id` quando aplicável.

**Relações:**

- 1:N contatos (`contacts`);
- 1:N medicamentos (`medications`);
- 1:N eventos de adesão (`adherence_events`);
- 1:N execuções e tarefas de jornada;
- 1:N mensagens e identidades de canal.

**Invariantes propostas:**

1. paciente pertence a exatamente uma instituição;
2. CPF, telefone e e-mail não são identificadores globais suficientes;
3. alteração de instituição não é operação cadastral comum e exige migração
   controlada;
4. exclusão deve considerar retenção, histórico de comunicação e obrigações
   legais;
5. dados clínicos devem ter finalidade explícita e mínimo necessário.

**Tensões atuais:**

- `current_medications` em texto coexistindo com `medications` estruturado;
- `stage` pode misturar fase clínica e etapa operacional;
- campos clínicos estão no mesmo agregado cadastral sem documentação de
  proveniência, validação ou responsável clínico.

### 2.2 Contato da rede de cuidado

**Raiz técnica:** `contacts`, subordinada a `patients`.

**Responsabilidades:**

- identificar pessoa relacionada ao paciente;
- registrar relação e preferências;
- registrar autorização própria;
- permitir receber comunicações dentro do escopo autorizado.

**Invariantes:**

1. contato pertence a um paciente;
2. autorização do contato não pode ser inferida da autorização do paciente;
3. `relation` não comprova representação legal;
4. revogação deve impedir novos envios cobertos;
5. contato não herda automaticamente todos os dados clínicos do paciente.

### 2.3 Identidade WhatsApp

**Raiz:** `whatsapp_identities`.

**Responsabilidades:**

- representar endereço E.164/`wa_id` dentro da instituição;
- associar o endereço a paciente ou contato quando conhecido;
- registrar opt-in/out, origem e finalidades;
- sustentar conversa e resolução de destinatário.

**Invariantes:**

1. identidade tem instituição explícita;
2. deve apontar para no máximo um destinatário lógico ativo por instituição,
   salvo regra de compartilhamento deliberada;
3. `recipient_type` precisa ser compatível com `patient_id`/`contact_id`;
4. telefone normalizado não deve ser resolvido fora do escopo institucional;
5. duplicidades precisam de estratégia de merge, preferência e auditoria;
6. opt-in e finalidade devem ser avaliados no envio.

### 2.4 Conversa WhatsApp

**Raiz:** `whatsapp_conversations`.

**Responsabilidades:**

- agrupar contexto de interação com uma identidade;
- registrar janela de atendimento e atividade recente;
- permitir remetente ainda não vinculado a paciente/contato;
- sustentar inbox e handoff humano.

**Invariantes:**

1. conversa pertence a uma instituição e identidade;
2. vínculo posterior com paciente/contato deve ser auditável;
3. janela de atendimento não substitui autorização;
4. uma mensagem não deve ser atribuída a paciente apenas por semelhança de
   telefone sem regra de resolução.

### 2.5 Mensagem

**Raiz:** `messages`.

**Responsabilidades:**

- registrar conteúdo e direção;
- controlar fila, envio, entrega, leitura e falha;
- referenciar destinatário, identidade, conversa, template, lote e mídia;
- preservar corpo original/renderizado e snapshots necessários.

**Invariantes:**

1. outbound exige ator/autorização de operação ou execução de sistema válida;
2. instituição e destinatário precisam ser resolvidos antes do envio;
3. envio deve ser idempotente por mensagem/solicitação;
4. status não deve regredir sem evento compensatório explícito;
5. template Meta precisa estar aprovado e pertencer à instituição;
6. erro externo deve ser persistido sem expor segredo ou dado excessivo;
7. webhook duplicado não pode duplicar mensagem ou efeito.

### 2.6 Jornada

**Raiz:** `journeys`.

**Responsabilidades:**

- definir automação versionada;
- representar objetivo, gatilho, audiência e grafo;
- controlar ciclo de vida editorial/operacional.

**Invariantes:**

1. jornada pertence a uma instituição;
2. publicação/ativação deve produzir versão imutável para runs existentes;
3. nós e conexões precisam ser válidos antes da ativação;
4. audiência, conteúdo e templates referenciados devem ser acessíveis pela mesma
   instituição;
5. edição posterior não altera retroativamente a semântica de um run.

### 2.7 Execução de jornada

**Raiz:** `journey_runs`.

**Responsabilidades:**

- executar uma versão da jornada para um paciente;
- controlar nó atual, espera, tentativa, contexto, conclusão e erro;
- produzir passos auditáveis.

**Invariantes:**

1. run registra `journey_version`;
2. instituição do run, jornada e paciente devem coincidir;
3. somente um worker deve avançar o mesmo run por vez;
4. retry não pode repetir efeito não idempotente sem proteção;
5. `waiting` exige `resume_at` ou condição clara de retomada;
6. estado terminal não deve voltar a estado ativo sem operação de compensação;
7. handoff deve produzir owner ou tarefa rastreável.

### 2.8 Tarefa de jornada

**Raiz:** `journey_tasks`.

**Responsabilidades:**

- representar trabalho humano;
- associar paciente, run e jornada quando aplicável;
- registrar prioridade, prazo, responsável e conclusão.

**Invariantes:**

1. tarefa e paciente pertencem à mesma instituição;
2. conclusão exige ator e timestamp auditável — lacuna a validar no schema;
3. tarefa cancelada/concluída não deve permanecer em fila ativa;
4. handoff crítico sem responsável deve aparecer como risco operacional.

### 2.9 Audiência

**Raiz:** `audience_segments`.

**Responsabilidades:**

- armazenar filtros reutilizáveis e escopo institucional;
- estimar/produzir conjunto de destinatários;
- servir jornadas e disparos.

**Invariantes:**

1. audiência pertence a uma instituição;
2. filtros devem ser validados e interpretados de forma determinística;
3. preview e execução precisam declarar se a audiência é dinâmica no momento do
   envio ou materializada;
4. finalidades e autorização devem ser aplicadas depois da seleção, antes do
   envio.

### 2.10 Envio em lote

**Raiz:** `message_batches`.

**Responsabilidades:**

- registrar disparo delimitado;
- apontar conteúdo/template e critérios;
- acompanhar início, fim, quantidade, estado e erro.

**Invariantes:**

1. lote pertence a uma instituição;
2. destinatários elegíveis devem ser revalidados no processamento;
3. cancelamento e retry precisam de semântica explícita;
4. total de recipients não deve ser confundido com enviados/entregues;
5. deduplicação deve considerar identidade e finalidade.

### 2.11 Modelo de mensagem / Template Meta

**Raiz:** `message_templates`.

**Responsabilidades:**

- armazenar conteúdo reutilizável, variáveis e targeting;
- espelhar definição, status e qualidade do template na Meta;
- controlar diferenças locais e sincronização.

**Invariantes:**

1. template institucional não pode ser usado por outra instituição;
2. a definição enviada deve ser a versão aprovada;
3. variável obrigatória precisa de valor e tipo válido;
4. alteração local não muda silenciosamente a versão externa aprovada;
5. status externo bruto e status normalizado devem ser distinguíveis.

---

## 3. Comandos principais

Comandos expressam intenção. Eles podem ser UI, função ou processo.

### Pessoas e cuidado

- `CadastrarPaciente`
- `AtualizarPaciente`
- `AdicionarContatoDaRede`
- `AtualizarAutorizacaoDoContato`
- `RegistrarMedicacao`
- `RegistrarEventoDeAdesao`
- `ConvidarParaOnboarding`
- `ConcluirOnboardingPublico`

### Comunicação

- `ResolverIdentidadeWhatsApp`
- `VincularIdentidadeADestinatario`
- `RegistrarOptIn`
- `RegistrarOptOut`
- `EnfileirarMensagem`
- `EnviarMensagemWhatsApp`
- `ProcessarWebhookWhatsApp`
- `AnexarMidia`
- `ResponderConversa`

### Conteúdo e targeting

- `CriarModeloDeMensagem`
- `SubmeterTemplateMeta`
- `SincronizarTemplatesMeta`
- `CriarAudiencia`
- `EstimarAudiencia`
- `CriarEnvioEmLote`
- `ProcessarEnvioEmLote`

### Jornadas

- `CriarJornada`
- `ValidarGrafo`
- `AtivarJornada`
- `InscreverPaciente`
- `AvancarExecucao`
- `RetomarExecucao`
- `CriarTarefaHumana`
- `EncaminharParaHumano`
- `InterromperExecucao`

---

## 4. Eventos de domínio e integração

Eventos abaixo são linguagem recomendada. Nem todos possuem event store; podem
ser representados por mudança de estado, step, webhook ou audit log.

### Pessoas/consentimento

- `PacienteCadastrado`
- `ContatoAdicionado`
- `AutorizacaoConcedida`
- `AutorizacaoRevogada`
- `IdentidadeWhatsAppReconhecida`
- `IdentidadeVinculada`
- `DestinatarioSolicitouOptOut`

### Mensageria

- `MensagemEnfileirada`
- `MensagemEnviadaAoProvedor`
- `MensagemEntregue`
- `MensagemLida`
- `MensagemFalhou`
- `MensagemRecebida`
- `JanelaDeAtendimentoAberta`
- `JanelaDeAtendimentoExpirada`
- `WebhookDuplicadoIgnorado`

### Templates

- `TemplateSubmetido`
- `TemplateAprovado`
- `TemplateRejeitado`
- `TemplatePausado`
- `TemplateSincronizado`
- `DivergenciaLocalDetectada`

### Jornadas

- `PacienteInscritoNaJornada`
- `ExecucaoIniciada`
- `NoExecutado`
- `ExecucaoAguardando`
- `ExecucaoRetomada`
- `ExecucaoFalhou`
- `TarefaCriada`
- `HandoffSolicitado`
- `ExecucaoConcluida`
- `ExecucaoInterrompida`

---

## 5. Políticas de domínio

### Elegibilidade de envio

Uma pessoa é elegível quando, no mínimo:

1. pertence ao escopo institucional da operação;
2. possui endereço de canal válido;
3. possui autorização/finalidade compatível ou outra base operacional definida;
4. não possui opt-out aplicável;
5. o tipo de mensagem é permitido na janela ou utiliza template válido;
6. o conteúdo não excede a minimização necessária;
7. não há bloqueio operacional conhecido.

### Resolução de destinatário WhatsApp

1. normalizar telefone;
2. restringir por instituição;
3. localizar identidade por variantes válidas;
4. preferir identidade com conversa/janela coerente somente quando a regra for
   determinística;
5. vincular paciente/contato quando houver evidência;
6. registrar conflitos em vez de escolher silenciosamente em caso ambíguo.

### Retry

- retry técnico não deve criar novo efeito de negócio;
- passos e mensagens precisam de chave de idempotência;
- falhas permanentes e transitórias devem ser diferenciadas;
- limite e backoff devem ser observáveis;
- esgotamento gera tarefa, alerta ou estado final definido.

---

## 6. Casos de falha que o modelo deve suportar

- telefone compartilhado por paciente e contato;
- mesma pessoa em duas instituições;
- inbound de número desconhecido;
- opt-out recebido durante um lote;
- template pausado após criação da jornada;
- webhook entregue duas vezes ou fora de ordem;
- runner executando o mesmo run concorrentemente;
- paciente removido ou transferido durante jornada;
- contato revogado ainda presente em audiência materializada;
- mídia expirada antes do envio;
- handoff sem responsável disponível;
- dados clínicos inconsistentes entre texto e estrutura;
- jornada editada enquanto runs usam versão anterior.

Esses casos devem orientar testes e questões abertas, não ser resolvidos apenas
por fallback silencioso.