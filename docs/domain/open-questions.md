# Questões abertas — sessão de grilling

Estas perguntas não são detalhes de implementação. Cada uma pode alterar
vocabulário, schema, UX, segurança ou responsabilidades do produto. Enquanto
não houver decisão, o agente deve preservar o comportamento atual e evitar
expandir a hipótese.

## Como usar

Para cada pergunta resolvida:

1. registrar participantes e evidências;
2. atualizar glossário/modelo;
3. criar ou aceitar ADR quando houver trade-off estrutural;
4. abrir issues de implementação/migração;
5. atualizar `current-vs-target.md`.

---

## P0 — Decisões estruturais

### Q1. Qual é o posicionamento do produto?

**A. Vertical exclusivamente de Chagas**

- Vantagem: linguagem clínica e fluxos muito específicos.
- Custo: menor reutilização e maior acoplamento ao protocolo.

**B. Plataforma genérica de coordenação de cuidado**

- Vantagem: maior mercado e reutilização.
- Custo: risco de generalizar cedo e perder profundidade clínica.

**C. Núcleo genérico com módulo vertical de Chagas**

- Vantagem: separa comunicação/jornadas de conceitos específicos.
- Custo: exige fronteiras, configuração e governança modular.

**Recomendação preliminar:** C, porque o código já contém os dois tipos de
conceito. **Status:** não decidido.

### Q2. Qual é o limite de dados clínicos?

- Quais campos são necessários para comunicação e coordenação?
- O sistema é fonte primária ou cópia de outro prontuário?
- Quem valida e corrige dado clínico?
- Quais dados não podem entrar?
- Qual retenção e exportação?

**Impacto:** segurança, LGPD, UX, integrações, responsabilidade clínica.

### Q3. Qual é a unidade real de isolamento?

- Instituição textual é estável e única?
- Pode haver unidades/filiais/equipes dentro da instituição?
- Paciente pode pertencer a mais de uma instituição?
- Transferência é cópia, compartilhamento ou mudança de ownership?

**Impacto:** RLS, chaves, auditoria e modelo de paciente.

### Q4. Como funciona autorização por finalidade?

- Quais finalidades existem?
- Qual base legal é aplicada a cada uma?
- Paciente e contato autorizam separadamente?
- Como conflitos entre `contacts` e `whatsapp_identities` são resolvidos?
- Quem pode registrar autorização assistida?

**Impacto:** toda mensageria e segmentação.

### Q5. Telefone pode ser compartilhado?

- Um telefone pode representar paciente e cuidador?
- Pode representar várias pessoas da mesma família?
- Como o inbound é atribuído?
- A identidade é por telefone, `wa_id`, pessoa ou vínculo institucional?

**Impacto:** risco de vazamento e resolução de conversa.

---

## P1 — Operação de cuidado

### Q6. O que significa `patient_stage`?

Valores atuais: `diagnostico`, `agudo`, `cronico`.

- É fase clínica?
- É etapa da jornada operacional?
- Um paciente pode estar em mais de uma?
- Quem altera e com base em quê?

**Recomendação:** separar fase clínica de etapa operacional se ambos existirem.

### Q7. Qual é a fonte de verdade de medicações?

- `patients.current_medications` em texto ou `medications` estruturado?
- O texto é legado, resumo ou campo independente?
- Há conciliação e histórico?
- Quem pode cadastrar/alterar?

### Q8. O que é um evento de adesão?

- Quais `event_type` e `source` são válidos?
- É autorrelato, confirmação de entrega, inferência ou observação clínica?
- Pode gerar alerta ou recomendação?
- Qual nível de confiabilidade precisa ser exibido?

### Q9. O que é "próxima melhor ação"?

- Regra operacional ou recomendação clínica?
- Quais dados alimentam a priorização?
- Como explicar a sugestão?
- Quem pode sobrescrever?
- Há risco de viés ou atraso?

**Recomendação:** manter como priorização operacional explicável, não decisão
clínica autônoma, até governança específica.

### Q10. Como funciona handoff?

- `handoff` termina ou suspende o run?
- Cria tarefa, abre conversa ou ambos?
- Quem recebe?
- Qual SLA e escalonamento?
- A automação pode retomar depois?

### Q11. O que acontece ao pausar uma jornada?

- Bloqueia novas inscrições?
- Para runs ativos?
- Runs em espera continuam?
- Mensagens já enfileiradas são canceladas?

### Q12. Como versionar jornada?

- Ativar incrementa versão?
- O grafo antigo é preservado onde?
- Conteúdo/templates são referenciados por ID mutável ou snapshot?
- É permitido editar jornada ativa?

---

## P1 — Mensageria

### Q13. SMS está realmente disponível?

O enum suporta `sms`, mas é necessário confirmar:

- provedor;
- credenciais;
- edge function;
- status/webhook;
- UI;
- templates;
- autorização e opt-out.

Até isso, classificar como parcial.

### Q14. E-mail faz parte do roadmap aprovado?

Não está no enum. Se sim, definir:

- provedor;
- identidade remetente;
- bounce/complaint;
- unsubscribe;
- templates;
- anexos;
- auditoria e retenção.

### Q15. Qual é a semântica de campanha?

- `message_batches` representa campanha, lote técnico ou ambos?
- Audiência é reavaliada no processamento?
- Como cancelar?
- Como mostrar falhas parciais?
- Quais métricas são de negócio?

### Q16. Qual regra prevalece para opt-out?

- comando inbound;
- campo do contato;
- campo da identidade;
- bloqueio do provedor;
- desativação administrativa.

**Recomendação:** regra mais restritiva prevalece, com trilha e reconciliação.

### Q17. Como tratar eventos fora de ordem?

- `read` antes de `delivered`;
- duplicidade de webhook;
- status de mensagem antes da criação local;
- inbound repetido.

É necessária matriz de precedência e idempotência.

### Q18. Qual conteúdo pode aparecer para um contato?

- lembrete neutro;
- nome do medicamento;
- diagnóstico;
- horário de consulta;
- resultado de acompanhamento.

A resposta deve variar por relação, finalidade e autorização, não apenas pelo
campo `receives_reminders`.

---

## P1 — Dados e segurança

### Q19. `content_library` é global ou institucional?

O tipo gerado não mostra `institution`, mas `content_folders` mostra.

Possibilidades:

- biblioteca global compartilhada;
- conteúdo legado sem tenancy;
- conteúdo institucional com schema incompleto;
- conteúdo global com overrides locais.

Exige decisão e auditoria de RLS.

### Q20. Qual é a política de exclusão?

Separar:

- conta do usuário;
- paciente;
- contato;
- autorização;
- mensagens;
- auditoria;
- arquivos;
- dados na Meta;
- backups.

### Q21. Quais acessos de superadmin são permitidos?

- pode ler corpo de mensagens?
- pode ver dados clínicos?
- pode impersonar usuário?
- exige motivo/ticket?
- quais ações entram em audit log?

### Q22. Como transferir paciente entre instituições?

- proibido;
- exportar/importar;
- compartilhar;
- mudar instituição;
- criar vínculo separado.

Não implementar update simples em `institution` sem essa decisão.

---

## P2 — Governança e operação

### Q23. Issue tracker local substitui GitHub Issues?

- Qual é a fonte oficial?
- Como evitar IDs duplicados entre branches?
- Como pesquisar e medir lead time?
- Quando usar issue agregador?

ADR `0007` documenta a decisão atual e seus limites.

### Q24. Quais SLOs importam?

Sugestões para decisão:

- tempo de processamento do webhook;
- atraso do runner;
- tempo de mensagem `queued`;
- disponibilidade do envio;
- tempo de resposta a handoff;
- taxa de falha por canal/template.

### Q25. Qual é a governança de conteúdo clínico?

- autor;
- revisor clínico;
- revisor de privacidade;
- validade;
- versão;
- instituição versus conteúdo global;
- retirada urgente.

A documentação antiga descrevia estados de revisão não comprovados pelo schema
consultado; não tratá-los como atuais sem evidência.

---

## Próxima sessão recomendada

A próxima sessão de grilling deve resolver, nesta ordem:

1. Q1 — posicionamento;
2. Q2 — fronteira clínica;
3. Q4/Q16 — autorização e opt-out;
4. Q5 — telefone compartilhado;
5. Q10/Q11/Q12 — semântica de jornadas;
6. Q19 — tenancy da biblioteca.

Essas respostas desbloqueiam a maior parte das decisões restantes.