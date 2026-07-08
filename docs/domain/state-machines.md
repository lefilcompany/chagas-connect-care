# Máquinas de estado

Os campos de status atuais são majoritariamente `string`, com exceção de enums
específicos. Este documento separa estados **observados**, estados **propostos**
e transições que precisam de validação.

> Não criar constraint, enum ou regra de transição apenas a partir deste
> documento. Primeiro validar código, dados existentes e integrações.

---

## 1. Mensagem

### Estados observados/referenciados

```text
queued ──► sent ──► delivered ──► read
   │          │           │
   └──────────┴───────────┴────► failed
```

Campos temporais presentes em `messages` incluem `queued_at`, `sent_at`,
`delivered_at`, `read_at` e `failed_at`.

### Regras propostas

- `queued` é estado inicial de outbound.
- `sent` significa aceitação pelo provedor, não entrega ao aparelho.
- `delivered` e `read` dependem de callback externo.
- `failed` deve registrar erro e tentativas.
- Eventos fora de ordem não devem regredir um estado mais avançado.
- Inbound pode nascer em estado próprio/normalizado; confirmar implementação.
- Retry pode reutilizar a mesma mensagem ou criar nova tentativa, mas a escolha
  deve ser consistente e auditável.

### Lacunas

- estados canônicos não estão em enum;
- não há semântica documentada para cancelamento, expirado ou parcialmente
  enviado;
- precedência de callbacks fora de ordem precisa de teste;
- comportamento após falha permanente versus transitória não está formalizado.

---

## 2. Template Meta

### Ciclo externo esperado

```text
rascunho-local
      │ submissão
      ▼
pending ──► approved
   │           │
   ├──► rejected
   └──► paused/disabled
```

O schema guarda status normalizado e bruto (`meta_status`, `meta_status_raw`),
além de timestamps, rejeição, qualidade, definição e diferenças locais.

### Regras

- template local ainda não submetido não deve ser descrito como aprovado;
- submissão exige payload e exemplos válidos;
- envio exige definição aprovada/sincronizada;
- edição local após aprovação gera divergência, não atualização automática do
  template externo;
- sincronização não deve apagar informação local sem trilha;
- template pausado/rejeitado impede novos envios, mas não apaga histórico.

### Lacunas

- valores e caixa (`APPROVED` versus `approved`) precisam ser normalizados em um
  único contrato interno;
- transição de qualidade baixa para pausa precisa de política operacional;
- versão e substituição de template ainda precisam de fluxo canônico.

---

## 3. Jornada

### Estados documentados/propostos

```text
rascunho ──► ativa ──► pausada ──► ativa
    │          │          │
    └──────────┴──────────┴────► arquivada
```

### Regras

- somente jornada válida pode ficar ativa;
- ativação incrementa/congela uma versão executável;
- pausar impede novas inscrições automáticas, mas precisa definir o que ocorre
  com runs ativos;
- arquivar impede edição operacional e novas inscrições;
- reativação de arquivada deve ser proibida ou gerar nova jornada/versão.

### Lacunas

- confirmar os valores realmente usados no código e dados;
- definir publicação versus ativação;
- definir efeito de pausa sobre runs `waiting`;
- definir política para edição de jornada ativa.

---

## 4. Execução de jornada

### Estados observados/documentados

```text
queued ──► running ──► waiting ──► running
             │   │          │
             │   ├──────────┴────► failed
             │   ├───────────────► handoff
             │   ├───────────────► stopped
             │   └───────────────► completed
             └───────────────────► failed
```

### Estados terminais

- `completed`;
- `failed` quando não haverá retry automático;
- `stopped` por interrupção explícita;
- `handoff` quando a automação transfere responsabilidade humana — confirmar se
  é terminal ou suspenso.

### Invariantes

- `waiting` exige condição/timestamp de retomada;
- `current_node_id` deve existir na versão registrada;
- cada tentativa de nó gera `journey_run_steps`;
- retry incrementa `attempt` e não duplica efeitos;
- transição terminal precisa de `ended_at`;
- execução concorrente do mesmo run deve ser impedida.

### Lacunas

- lock/lease do runner;
- limite de retry por nó e por run;
- distinção entre falha técnica e regra de negócio;
- retomada manual;
- semântica de handoff e retorno à automação.

---

## 5. Passo de execução

Modelo recomendado:

```text
started ──► succeeded
   │
   ├──────► waiting
   ├──────► failed-retryable
   └──────► failed-terminal
```

O campo atual é `status: string`; os valores reais precisam ser inventariados
antes de formalização.

Cada step deve registrar:

- run, nó e kind;
- início e término;
- tentativa;
- resultado mínimo;
- erro sanitizado;
- identificador do efeito externo quando houver.

---

## 6. Tarefa de jornada

### Estados propostos a partir da documentação existente

```text
aberta ──► concluida
   │
   └────► cancelada
```

Possíveis estados adicionais (`em-andamento`, `vencida`) não devem ser criados
sem decisão; vencimento pode ser derivado de `due_at`.

### Regras

- conclusão/cancelamento exigem ator e data;
- tarefa concluída não volta a aberta sem reabertura auditável;
- remoção do assignee não pode tornar tarefa crítica invisível;
- prioridade e prazo precisam de interpretação consistente.

### Lacunas

- schema atual mostrado nos tipos não evidencia `completed_at`/`completed_by`;
- SLA e escalonamento não estão definidos;
- relação entre handoff, inbox e tarefa precisa ser formalizada.

---

## 7. Identidade WhatsApp / opt-in

### Estados propostos

```text
pending ──► opted_in ──► opted_out
   │             │
   └────────────► invalid/blocked
```

Os valores reais de `opt_in_status` são strings e precisam ser inventariados.

### Regras

- `opted_out` prevalece até nova evidência válida;
- recadastro não reverte opt-out;
- identidade inativa não recebe outbound;
- alteração de telefone cria/reconcilia identidade, não muda endereço sem
  trilha;
- finalidades podem ser mais restritas que o status geral.

---

## 8. Contato e autorização

Modelo conceitual:

```text
pending ──► authorized ──► revoked
   │
   └──────► denied/invalid
```

### Regras

- `authorization_status` deve ser interpretado junto com escopo e timestamps;
- `receives_reminders` não deve sobrepor revogação;
- mudança de relação não mantém automaticamente autorização;
- representação legal precisa de evidência separada quando exigida.

---

## 9. Conversa WhatsApp

Estados possíveis precisam ser inventariados. Modelo inicial:

```text
open ──► resolved ──► open
  │
  └────► blocked/archived
```

A janela de atendimento é um estado temporal paralelo:

```text
open-window ──(tempo)─► expired-window
```

Não confundir status da conversa com status de opt-in ou janela.

---

## 10. Envio em lote

Modelo recomendado:

```text
draft/queued ──► processing ──► completed
      │               │
      ├──────────────► cancelled
      └──────────────► failed
```

Lotes grandes podem concluir com falhas parciais. Se isso ocorrer, o estado
`completed` precisa vir acompanhado de contadores detalhados ou de um estado
`completed_with_errors` formalizado.

---

## 11. Processo para tornar estados canônicos

1. inventariar valores existentes no banco e código;
2. identificar estados legados e inválidos;
3. definir transições, atores e efeitos;
4. decidir política de migração;
5. criar ADR quando houver impacto amplo;
6. adicionar enums/constraints apenas após migração segura;
7. criar testes de transição e callbacks fora de ordem;
8. atualizar este documento e o glossário.