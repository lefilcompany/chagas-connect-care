# Glossário de domínio

Cada entrada diferencia:

- **termo canônico** usado em produto e documentação;
- **significado** no domínio;
- **nome técnico atual** no código/banco;
- **restrições de uso** e termos que geram ambiguidade.

Um nome técnico não deve ser inventado a partir do termo de negócio. Consulte o
schema gerado antes de escrever query ou migration.

---

## Pessoa

Rótulo de UI para apresentar, de forma menos clínica, pacientes e seu contexto.
Não existe tabela `people` no schema atual.

- **Nome técnico:** normalmente `patients`; em alguns contextos, a tela também
  apresenta `contacts`.
- **Não usar como:** entidade persistida presumida ou sinônimo técnico de
  `patients`.

## Paciente

Pessoa sob acompanhamento da instituição. É o agregado de referência para
contatos, medicamentos, eventos de adesão, jornadas, tarefas e mensagens.

- **Nome técnico:** `patients`.
- **Dados atuais:** cadastro, instituição, estágio, forma clínica, comorbidades,
  alergias, medicamentos em texto, medidas e observações.
- **Não usar:** cliente, lead, usuário.

## Contato da rede de cuidado

Pessoa relacionada a um paciente, como familiar, cuidador ou responsável. Tem
identidade, dados de contato e autorização próprios.

- **Nome técnico:** `contacts`.
- **Vínculo:** `contacts.patient_id`.
- **Não usar como nome técnico:** `care_network_contacts`, pois essa tabela não
  existe no schema atual.
- **Evitar:** "responsável" sem registrar a relação e o fundamento de
  representação.

## Usuário

Pessoa autenticada que opera a aplicação.

- **Nomes técnicos:** Supabase Auth, `profiles`, `user_roles`.
- **Não usar:** paciente, contato ou destinatário.

## Instituição

Unidade operacional e de isolamento dos dados.

- **Nome técnico:** valor textual `institution` presente em várias tabelas e em
  `profiles`.
- **Observação:** nem toda tabela possui a coluna diretamente; algumas dependem
  de isolamento transitivo por `patient_id`.
- **Evitar em UI:** tenant.

## Papel

Conjunto de permissões de um usuário autenticado.

- **Nome técnico:** enum `app_role` e tabela `user_roles`.
- **Valores atuais:** `superadmin`, `admin`, `equipe`.
- `profiles.role_label` é um rótulo profissional e não deve substituir
  autorização.

## Superadmin

Operador da plataforma com capacidade transversal. O papel não elimina a
necessidade de necessidade operacional, auditoria e minimização de acesso.

## Admin institucional

Usuário responsável por configurações e gestão da própria instituição.

## Equipe

Usuário operacional que acompanha pacientes, conversas, jornadas e tarefas.

---

## Canal

Meio técnico de comunicação.

- **Enum atual:** `message_channel = whatsapp | sms`.
- **WhatsApp:** capacidade principal implementada.
- **SMS:** presente no schema; a cobertura ponta a ponta deve ser validada.
- **E-mail:** direção futura; não faz parte do enum atual.

## Preferência de canal

Canal preferido cadastrado para paciente ou contato.

- **Nome técnico:** `channel_pref`.
- **Invariante:** preferência não equivale a autorização, disponibilidade ou
  validade técnica.

## Identidade WhatsApp

Representação institucional de um endereço de WhatsApp. Separa o telefone e o
`wa_id` das entidades clínicas/cadastrais.

- **Nome técnico:** `whatsapp_identities`.
- **Campos relevantes:** `phone_e164`, `wa_id`, `recipient_type`, `patient_id`,
  `contact_id`, `opt_in_status`, `allowed_purposes`.
- **Invariante:** deve pertencer a uma instituição e referenciar, quando
  conhecida, paciente ou contato compatível.

## Conversa WhatsApp

Contexto operacional de troca de mensagens com uma identidade.

- **Nome técnico:** `whatsapp_conversations`.
- **Campos relevantes:** identidade, paciente/contato, instituição, status,
  datas de entrada/saída e expiração da janela de atendimento.
- **Não reduzir a:** simples par paciente-canal; remetente desconhecido pode
  existir antes da vinculação a paciente.

## Mensagem

Unidade de comunicação recebida ou enviada.

- **Nome técnico:** `messages`.
- **Características:** direção, canal, status, destinatário, identidade,
  template, mídia, corpo renderizado, timestamps e erro.
- **Invariante:** mensagem outbound precisa de autorização de operação,
  instituição e destinatário resolvidos.

## Janela de atendimento

Período operacional em que determinadas mensagens livres podem ser enviadas em
resposta a uma interação, conforme regras do provedor.

- **Nome técnico:** `service_window_expires_at` em
  `whatsapp_conversations`.
- **Não confundir com:** consentimento ou finalidade.

## Opt-in / Autorização de comunicação

Registro de que uma pessoa autorizou comunicação para uma finalidade e canal.
Na UI, preferir **autorização** ou **consentimento**, conforme fundamento
jurídico definido.

- **Nomes técnicos:** campos de autorização em `contacts` e campos de opt-in em
  `whatsapp_identities`.
- **Lacuna atual:** coexistem modelos de autorização que precisam de regra de
  precedência e sincronização.

## Opt-out / Revogação

Manifestação que impede novos usos abrangidos pela revogação.

- **Nomes técnicos:** `revoked_at`, `opt_out_at`, estados correspondentes.
- **Invariante:** não implica apagar automaticamente histórico obrigatório, mas
  deve bloquear novos envios incompatíveis.

## Finalidade

Motivo específico para uso de dado ou envio de comunicação.

- **Nomes técnicos observados:** `authorization_scope`, `allowed_purposes`.
- **Exemplos a validar:** lembrete, educação em saúde, acompanhamento,
  atendimento e comunicação administrativa.

---

## Modelo de mensagem

Conteúdo reutilizável com variáveis, segmentação e configuração de canal.

- **Nome técnico:** `message_templates`.
- **Não usar como nome técnico:** `templates`.

## Template Meta

Modelo de WhatsApp submetido ou sincronizado com a Meta.

- **Nome técnico:** registro em `message_templates` com metadados `meta_*` e
  `template_kind` correspondente.
- **Estados externos:** valores vindos da Meta; o código atual usa forma local
  normalizada em alguns fluxos.
- **Invariante:** o envio deve usar a definição aprovada/sincronizada.

## Resposta rápida

Texto curto reutilizável pelo atendimento humano.

- **Nome técnico:** `quick_replies`.
- **Não confundir com:** template Meta.

## Biblioteca de conteúdo

Conteúdos reutilizáveis para educação e comunicação.

- **Nomes técnicos:** `content_library`, `content_folders`.
- **Lacuna:** `content_library` não apresenta `institution` no tipo gerado,
  enquanto pastas são institucionais; a intenção deve ser validada.

---

## Audiência

Conjunto dinâmico de pessoas selecionado por critérios.

- **Nome técnico atual:** `audience_segments`.
- **Não usar como nome técnico:** `audiences`.
- **Campos relevantes:** instituição, filtros, tipos de audiência e owner.

## Campanha / Envio em lote

Operação delimitada de envio para uma audiência.

- **Nome técnico principal:** `message_batches`.
- **Não confundir com:** jornada, que é uma automação durável e orientada a
  eventos/estado.

## Segmento

Termo legado ou alternativo para audiência. Na UI e documentação nova, preferir
**audiência**; manter `segment_id` apenas como nome técnico existente.

---

## Jornada

Definição versionada de uma automação de cuidado representada por um grafo.

- **Nome técnico:** `journeys`.
- **Campos:** instituição, audiência opcional, objetivo, grafo, gatilho, status e
  versão.
- **Não usar:** campanha ou workflow genérico.

## Grafo da jornada

Estrutura JSON que representa nós, colunas, configuração e conexões.

- **Nome técnico:** `journeys.graph`.
- **Invariante:** uma execução registra a versão da jornada utilizada.

## Nó

Unidade executável ou estrutural do grafo, como entrada, condição, espera,
mensagem, criação de tarefa, handoff ou encerramento.

- **Nome técnico:** `node_id`, `node_kind` nos passos; configuração dentro do
  JSON do grafo.
- **Observação:** a lista canônica deve ser derivada do catálogo/runner, não
  presumida apenas pela documentação.

## Execução de jornada

Instância de uma jornada para um paciente.

- **Nome técnico:** `journey_runs`.
- **Termo técnico curto aceitável:** run, apenas em código ou discussão técnica.
- **Campos:** jornada, versão, paciente, estado, nó atual, retomada, tentativa,
  contexto e erro.

## Passo de execução

Registro de uma tentativa de executar um nó.

- **Nome técnico:** `journey_run_steps`.
- **Finalidade:** auditoria, diagnóstico, retry e rastreabilidade.

## Tarefa de jornada

Trabalho humano criado ou associado ao acompanhamento.

- **Nome técnico:** `journey_tasks`.
- **Campos:** paciente, jornada, run, responsável, prioridade, prazo e estado.

## Handoff

Transferência da automação para atuação humana.

- **Representação:** estado/resultado da execução e possível tarefa ou conversa.
- **Lacuna:** SLA, owner e regra de encerramento ainda precisam ser definidos.

---

## Dado clínico limitado

Informação clínica persistida para dar contexto a comunicação, segmentação,
acompanhamento ou adesão.

- **Nomes técnicos:** campos de `patients`, `medications` e
  `adherence_events`.
- **Não significa:** prontuário completo.
- **Exige:** minimização, finalidade, controle de acesso, retenção e auditoria.

## Estágio do paciente

Classificação clínica atual representada pelo enum `patient_stage`.

- **Valores atuais:** `diagnostico`, `agudo`, `cronico`.
- **Questão aberta:** confirmar se o conceito é fase clínica, etapa de jornada ou
  ambos; não ampliar valores sem validação clínica.

## Medicação

Registro estruturado de medicamento associado ao paciente.

- **Nome técnico:** `medications`.
- **Observação:** também existe `patients.current_medications` em texto, criando
  possível duplicidade de fonte.

## Evento de adesão

Fato observado relacionado ao uso de medicamento ou comportamento de adesão.

- **Nome técnico:** `adherence_events`.
- **Campos:** paciente, medicamento opcional, tipo, origem e ocorrência.

---

## Pendência

Condição que exige atenção ou impede o acompanhamento esperado.

- **Pode incluir:** canal inválido, autorização ausente, falha de mensagem,
  ausência de contato, tarefa vencida ou handoff sem owner.
- **Importante:** se for derivada no frontend, não tratá-la como estado
  persistido sem confirmar a implementação.
- **Evitar:** culpa do paciente, erro do paciente.

## Próxima melhor ação

Sugestão priorizada para orientar o trabalho da equipe.

- **Status:** conceito de produto; regras e fonte técnica precisam ser
  verificadas antes de tratá-lo como motor canônico.
- **Não significa:** recomendação clínica autônoma.