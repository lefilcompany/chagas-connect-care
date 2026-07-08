# Registro de riscos e dívidas

Este registro não substitui threat model, avaliação jurídica, teste de segurança
ou plano de continuidade. Ele torna explícitos riscos já identificáveis no
domínio e na arquitetura.

## Escala

- **Impacto:** baixo, médio, alto, crítico.
- **Probabilidade:** baixa, média, alta.
- **Estado:** aberto, mitigado parcialmente, aceito, encerrado.

Cada mitigação que exige trabalho deve possuir issue.

---

## R-001 — Acesso cruzado entre instituições

- **Impacto:** crítico
- **Probabilidade:** média
- **Estado:** mitigado parcialmente
- **Causa:** políticas RLS incompletas, uso incorreto de service role ou join
  transitivo sem restrição institucional.
- **Evidência:** nem todas as tabelas possuem `institution` diretamente;
  `contacts`, `medications` e `adherence_events` dependem de vínculo com
  paciente.
- **Controles atuais:** RLS, `get_user_institution`, `has_role`, validação via
  cliente do usuário em parte das edge functions.
- **Ações:** matriz de tenancy por tabela; testes same-tenant/cross-tenant;
  revisão de toda edge function que usa service role.

## R-002 — Mensagem enviada à pessoa errada

- **Impacto:** crítico
- **Probabilidade:** média
- **Estado:** mitigado parcialmente
- **Causa:** telefone compartilhado, variantes com/sem nono dígito, identidade
  duplicada ou associação automática ambígua.
- **Controles atuais:** normalização e `whatsapp_identities` por instituição.
- **Ações:** política de resolução; detecção de conflito; merge auditável;
  confirmação humana quando houver ambiguidade.

## R-003 — Conteúdo sensível exposto ao contato sem autorização

- **Impacto:** crítico
- **Probabilidade:** média
- **Estado:** aberto
- **Causa:** `receives_reminders` ou relação usados como permissão ampla.
- **Ações:** matriz de conteúdo por finalidade/relação; templates neutros;
  autorização explícita; testes de destinatário paciente versus contato.

## R-004 — Conflito entre autorização do contato e opt-in da identidade

- **Impacto:** alto
- **Probabilidade:** alta
- **Estado:** aberto
- **Causa:** modelos paralelos em `contacts` e `whatsapp_identities` sem
  precedência formal.
- **Ações:** decisão de domínio; regra mais restritiva provisória; reconciliação
  e auditoria de opt-out.

## R-005 — Webhook duplicado ou fora de ordem

- **Impacto:** alto
- **Probabilidade:** alta
- **Estado:** mitigado parcialmente
- **Causa:** entrega pelo menos uma vez do provedor e callbacks assíncronos.
- **Consequências:** mensagem duplicada, regressão de status, conversa incorreta,
  efeitos repetidos em jornadas.
- **Ações:** chave de deduplicação; tabela/evento de recebimento; matriz de
  precedência de status; testes de reordenação.

## R-006 — Execução concorrente da mesma jornada

- **Impacto:** alto
- **Probabilidade:** média
- **Estado:** aberto
- **Causa:** cron, invocação manual e retries processando o mesmo run.
- **Consequências:** mensagens/tarefas duplicadas e avanço inconsistente.
- **Ações:** lease/lock transacional; claim atômico; idempotência por step;
  monitoramento de runs presos.

## R-007 — Efeito externo repetido em retry

- **Impacto:** alto
- **Probabilidade:** média
- **Estado:** aberto
- **Causa:** falha após envio externo, antes de persistir sucesso.
- **Ações:** idempotency key, external ID, confirmação antes de repetir e
  reconciliação assíncrona.

## R-008 — Dados clínicos sem fronteira de responsabilidade

- **Impacto:** crítico
- **Probabilidade:** alta
- **Estado:** aberto
- **Causa:** armazenamento de forma clínica, comorbidades, medicamentos e adesão
  sem política canônica de fonte, validação, retenção e uso.
- **Ações:** decidir ADR 0006; classificar dados; definir owner clínico;
  minimização; integração com fonte oficial quando aplicável.

## R-009 — Duplicidade de medicações

- **Impacto:** alto
- **Probabilidade:** média
- **Estado:** aberto
- **Causa:** `patients.current_medications` em texto e tabela `medications`.
- **Ações:** eleger fonte de verdade; migrar/conciliar; indicar proveniência e
  atualização.

## R-010 — Biblioteca de conteúdo sem tenancy clara

- **Impacto:** alto
- **Probabilidade:** média
- **Estado:** aberto
- **Causa:** `content_library` sem `institution` no tipo gerado e
  `content_folders` institucional.
- **Consequências:** conteúdo compartilhado indevidamente ou inacessível.
- **Ações:** decidir global versus institucional; revisar RLS; migrar referências.

## R-011 — Template local divergente do aprovado

- **Impacto:** alto
- **Probabilidade:** média
- **Estado:** mitigado parcialmente
- **Causa:** edição local após sincronização.
- **Controles atuais:** `meta_definition`, `meta_has_local_differences`, status e
  versão.
- **Ações:** bloquear uso da edição não aprovada; UX de comparação; fluxo de nova
  versão/submissão.

## R-012 — Template pausado durante jornada ativa

- **Impacto:** alto
- **Probabilidade:** média
- **Estado:** aberto
- **Causa:** mudança externa na Meta após validação da jornada.
- **Ações:** revalidar no envio; fallback permitido somente se definido; tarefa
  operacional; alertar owner da jornada.

## R-013 — Handoff sem responsável ou SLA

- **Impacto:** alto
- **Probabilidade:** alta
- **Estado:** aberto
- **Causa:** automação transfere responsabilidade sem fila/owner claro.
- **Ações:** política de roteamento, prazo, escalonamento e dashboard de tarefas
  órfãs.

## R-014 — Onboarding público reutilizado ou enumerado

- **Impacto:** alto
- **Probabilidade:** média
- **Estado:** mitigado parcialmente
- **Causa:** token fraco, longo prazo, reuso ou ausência de rate limit.
- **Ações:** token forte, expiração, uso único, revogação, rate limit e logs
  minimizados.

## R-015 — Payload sensível duplicado no convite concluído

- **Impacto:** alto
- **Probabilidade:** média
- **Estado:** aberto
- **Causa:** `onboarding_invites.completed_payload` conservar dados já
  persistidos.
- **Ações:** inventariar conteúdo, minimizar, criptografar quando necessário e
  definir retenção curta.

## R-016 — Service role usada sem autorização prévia

- **Impacto:** crítico
- **Probabilidade:** média
- **Estado:** mitigado parcialmente
- **Causa:** edge function autentica usuário, mas lê/escreve recurso com client
  admin sem validar instituição/recurso pelo contexto do chamador.
- **Controles atuais:** `send-whatsapp` consulta a mensagem pelo client RLS antes
  do client admin.
- **Ações:** padrão obrigatório e helper compartilhado; revisão função a função;
  teste negativo cross-tenant.

## R-017 — Status livres e inconsistentes

- **Impacto:** médio/alto
- **Probabilidade:** alta
- **Estado:** aberto
- **Causa:** múltiplos campos `status: string`, valores externos e normalizações
  diferentes.
- **Ações:** inventário de dados; state machines; constants tipadas;
  constraints/enums após migração.

## R-018 — Logs contendo dados ou segredos

- **Impacto:** crítico
- **Probabilidade:** média
- **Estado:** aberto
- **Causa:** logging de payloads externos, mensagem, telefone, CPF ou headers.
- **Ações:** política de logging; redaction; revisão de edge functions; acesso e
  retenção dos logs.

## R-019 — Mídia acessível fora do escopo institucional

- **Impacto:** crítico
- **Probabilidade:** média
- **Estado:** mitigado parcialmente
- **Causa:** policy de Storage baseada em path inconsistente ou URL longa.
- **Ações:** prefixo institucional obrigatório; signed URL curta; testes
  cross-tenant; expiração e limpeza.

## R-020 — Pausa/edição de jornada com efeito indefinido em runs

- **Impacto:** alto
- **Probabilidade:** média
- **Estado:** aberto
- **Causa:** ausência de semântica canônica de versão, pausa e retomada.
- **Ações:** decisão; preservar versão; matriz de comportamento; testes.

## R-021 — Issue tracker local divergente do trabalho real

- **Impacto:** médio
- **Probabilidade:** alta
- **Estado:** aceito com mitigação
- **Causa:** IDs concorrentes, issues esquecidos ou duplicação com GitHub.
- **Ações:** ADR 0007; validação em PR; responsável obrigatório; considerar
  automação de índice/ID.

## R-022 — Documentação voltar a divergir do schema

- **Impacto:** médio
- **Probabilidade:** alta
- **Estado:** mitigado parcialmente
- **Causa:** nomes copiados de intenção ou refatoração não refletida.
- **Ações:** hierarchy de evidência; checklist de PR; validação automatizada de
  nomes técnicos quando viável.

---

## Revisão periódica

- revisar riscos críticos a cada mudança de integração, RLS ou dados clínicos;
- revisar riscos de mensageria após alteração da API Meta;
- revisar o registro ao menos por release relevante;
- não marcar risco como encerrado sem evidência e issue associado.