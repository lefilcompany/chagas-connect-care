# Consentimento, autorização e privacidade

> Documento de modelagem e engenharia. Não constitui parecer jurídico nem
> declaração de conformidade. Decisões sobre base legal, retenção e conteúdo de
> avisos devem ser validadas pelos responsáveis jurídicos e clínicos.

---

## 1. Princípio central

Ter um dado de contato não autoriza qualquer uso. Antes de comunicar, o sistema
deve combinar:

1. quem é o destinatário;
2. em nome de qual instituição ocorre o uso;
3. qual é a finalidade;
4. qual canal será usado;
5. qual fundamento/registro permite o uso;
6. qual conteúdo será compartilhado;
7. se existe revogação ou bloqueio;
8. se a regra do provedor permite o tipo de mensagem.

Janela de atendimento, preferência de canal e opt-in são conceitos diferentes.

---

## 2. Pessoas e representações

### Paciente

É titular dos próprios dados e destinatário possível. Sua autorização não deve
ser inferida da participação em uma instituição sem regra definida.

### Contato da rede de cuidado

É outro titular de dados. Pode receber comunicações sobre o paciente somente
dentro da relação, finalidade e autorização aplicáveis.

O campo `relation` descreve vínculo social/operacional, mas não comprova:

- representação legal;
- tutela/curatela;
- autorização para acessar qualquer informação clínica;
- autorização permanente.

### Usuário da equipe

É operador autorizado pela instituição. Acesso deve seguir papel, necessidade e
escopo institucional. Papel técnico não substitui dever de confidencialidade.

### Superadmin

Possui capacidade técnica transversal, mas acessos sensíveis devem ser
justificados e auditados. Evitar uso rotineiro de service role ou visão global
quando uma operação institucional é suficiente.

---

## 3. Representações atuais no schema

### Em `contacts`

- `authorization_status`;
- `authorization_scope`;
- `authorized_at`;
- `authorized_by`;
- `revoked_at`;
- `channel_pref`;
- `receives_reminders`.

### Em `whatsapp_identities`

- `opt_in_status`;
- `opt_in_at`;
- `opt_in_source`;
- `opt_in_notice_version`;
- `opt_out_at`;
- `allowed_purposes`;
- `is_active`.

### Problema de modelagem

Existem dois conjuntos de campos que podem representar autorização. Até haver
regra explícita, nenhum agente deve assumir que um sobrescreve o outro.

Questões que exigem decisão:

- contato autorizado com identidade `pending` pode receber?
- identidade `opted_in` vinculada a contato revogado pode receber?
- autorização é por pessoa, identidade, canal, instituição ou finalidade?
- qual registro é evidência primária?
- como sincronizar opt-out recebido pelo WhatsApp com `contacts`?

Recomendação provisória: tratar a elegibilidade como **interseção conservadora**
dos controles aplicáveis e registrar conflitos para revisão.

---

## 4. Modelo recomendado de autorização

Uma autorização completa deveria ser capaz de responder:

| Dimensão | Exemplo |
| --- | --- |
| Titular | paciente ou contato específico |
| Instituição controladora | instituição que realizará o envio |
| Canal/identidade | WhatsApp, SMS, endereço específico |
| Finalidade | lembrete, educação, atendimento, pesquisa etc. |
| Fundamento | consentimento ou outra base definida |
| Evidência | formulário, mensagem, operação assistida |
| Texto apresentado | versão do aviso/termo |
| Concedido em | timestamp e origem |
| Revogado em | timestamp, origem e abrangência |
| Validade | duração ou evento de expiração, se houver |

O schema atual cobre parte dessas dimensões. Lacunas devem virar issue antes de
mudança de comportamento.

---

## 5. Finalidades

`authorization_scope` e `allowed_purposes` sugerem autorização por finalidade,
mas os valores canônicos não estão formalizados.

Conjunto inicial para discussão, não canônico:

- `care_reminder` — lembrete relacionado ao cuidado;
- `care_education` — educação e orientação em saúde;
- `care_follow_up` — acompanhamento e verificação de resposta;
- `human_support` — atendimento iniciado ou solicitado;
- `administrative` — comunicação operacional da instituição;
- `research` — pesquisa, somente com governança específica;
- `marketing` — divulgação não assistencial, separada das finalidades de cuidado.

Não reutilizar autorização assistencial para marketing sem decisão explícita.

---

## 6. Regra de elegibilidade de comunicação

Uma política conservadora para outbound:

```text
mesma instituição
AND identidade/endereço válido
AND destinatário resolvido
AND finalidade compatível
AND sem revogação/opt-out aplicável
AND conteúdo mínimo necessário
AND regra do provedor satisfeita
AND usuário/processo autorizado
```

### Mensagem livre no WhatsApp

Além da elegibilidade, exige janela operacional válida, salvo regra do provedor
que permita outro formato.

### Template Meta

Exige template aprovado/sincronizado, pertencente à instituição, com variáveis
válidas e finalidade compatível. O uso de template não substitui autorização.

### Inbound

A recepção pode ocorrer de remetente desconhecido. O sistema deve:

- registrar evento com minimização;
- criar/localizar identidade dentro da instituição correta;
- evitar associação automática ambígua;
- permitir triagem e vínculo auditável;
- processar palavras/ações de opt-out com prioridade.

---

## 7. Revogação e opt-out

Ao receber revogação:

1. registrar data, origem, identidade e abrangência;
2. interromper novos envios abrangidos;
3. retirar destinatário de lotes ainda não processados;
4. impedir novas inscrições incompatíveis em jornadas;
5. avaliar runs ativos e tarefas associadas;
6. preservar apenas histórico necessário e protegido;
7. informar a equipe quando houver impacto assistencial que exija canal
   alternativo legítimo.

Revogação não deve ser revertida por sincronização posterior ou recadastro sem
nova evidência.

---

## 8. Minimização por superfície

### Banco

- guardar somente o necessário;
- preferir campos estruturados quando há regra clara;
- evitar duplicidade sem fonte de verdade definida;
- classificar dados clínicos e identificadores.

### Mensagens

- não incluir diagnóstico ou detalhe sensível quando um lembrete neutro basta;
- considerar visualização em tela bloqueada e aparelho compartilhado;
- não pressupor que o contato pode receber todo o conteúdo do paciente.

### Logs e auditoria

- registrar IDs, decisões e códigos, não corpos completos por padrão;
- mascarar telefone/CPF quando o valor integral não for necessário;
- nunca registrar tokens e segredos;
- definir acesso e retenção dos logs.

### URLs e frontend

- não colocar CPF, telefone ou conteúdo clínico em query string;
- tokens públicos devem expirar, ter escopo e uso único quando aplicável;
- evitar dado sensível em título, analytics, toast e mensagens de erro.

### Integrações

- enviar somente campos necessários ao contrato;
- registrar versão do contrato e finalidade;
- definir comportamento para falha, retry e exclusão.

---

## 9. Onboarding público

O link público deve possuir:

- token imprevisível e armazenado de forma segura;
- expiração;
- instituição e finalidade vinculadas;
- uso único ou regra explícita de reuso;
- proteção contra enumeração e brute force;
- confirmação do titular/representante quando necessária;
- aviso de privacidade versionado;
- registro de conclusão sem persistir payload excessivo;
- revogação/invalidação pelo time.

`completed_payload` deve ser revisado para evitar duplicação permanente de dados
sensíveis já persistidos nas tabelas finais.

---

## 10. Direitos, retenção e exclusão

A existência de `delete-account` e páginas legais não define por si só uma
política completa.

A política precisa distinguir:

- conta do usuário operador;
- cadastro do paciente;
- cadastro do contato;
- mensagens e evidências de entrega;
- consentimentos e revogações;
- logs de auditoria;
- dados exigidos por obrigação legal;
- backups e dados em provedores externos.

Toda solicitação deve produzir trilha: recebimento, identidade verificada,
escopo, decisão, execução, exceções e conclusão.

---

## 11. Checklist para novas features

- Qual dado pessoal/clínico será usado?
- Quem é o titular?
- Qual instituição e finalidade?
- O dado já existe ou será duplicado?
- Quem pode ler, criar, alterar e excluir?
- Qual política RLS protege o acesso?
- O dado aparece em log, URL, mensagem ou analytics?
- Existe integração externa?
- Qual retenção e comportamento de exclusão?
- Como funciona opt-out/revogação?
- Que evidência será guardada?
- Qual risco em aparelho ou telefone compartilhado?
- Há necessidade de revisão jurídica/clínica?

Mudança que não responda a essas perguntas não está pronta para produção.