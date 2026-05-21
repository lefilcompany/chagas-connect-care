
# Sistema para equipes de saúde — área logada

Vamos transformar a landing atual num produto: manter o site público em `/` e criar uma área autenticada em `/app` para as equipes gerenciarem a comunicação com pacientes, famílias e cuidadores via WhatsApp/SMS (simulado).

## 1. Infraestrutura

- Ativar **Lovable Cloud** (banco, auth, edge functions).
- Auth por **email + senha** e **Google**.
- Tabela `profiles` (criada via trigger no signup) com: `full_name`, `role_label` (médico, enfermeiro, coordenador…), `institution`, `professional_registry` (CRM/COREN).
- Tabela `user_roles` + enum `app_role` (`admin`, `equipe`) com função `has_role()` SECURITY DEFINER (padrão Lovable, sem recursão).
- RLS em todas as tabelas; admin enxerga tudo da instituição, equipe enxerga apenas seus pacientes atribuídos + os da instituição quando aplicável.

## 2. Modelo de dados

```text
profiles (id, full_name, role_label, institution, professional_registry)
user_roles (user_id, role)                       -- admin | equipe
patients (id, full_name, birth_date, stage,       -- diagnóstico, agudo, crônico
          phone, channel_pref, institution, owner_id, notes)
contacts (id, patient_id, full_name, relation,    -- familiar | cuidador | responsável
          phone, channel_pref, receives_reminders)
content_library (id, category, title, body,       -- alimentação, sono, medicação…
                 audience)                        -- paciente | familia | ambos
journeys (id, name, stage)                        -- trilha por etapa
journey_steps (id, journey_id, day_offset,
               content_id, audience)
patient_journeys (id, patient_id, journey_id, started_at, status)
medications (id, patient_id, name, dose, schedule_cron, start_date, end_date)
messages (id, patient_id, contact_id, channel,    -- whatsapp | sms
          direction, body, status, scheduled_for, sent_at,
          template_id, created_by)
adherence_events (id, patient_id, medication_id,
                  event_type, occurred_at, source) -- confirmado | perdido
crm_sync_log (id, patient_id, crm_name, payload, status, created_at)
```

## 3. Rotas e telas (`/app`)

- `/login`, `/signup`, `/reset-password`
- `/app` — dashboard: KPIs (pacientes ativos, adesão %, mensagens enviadas hoje, próximos lembretes)
- `/app/pacientes` — lista + busca + filtros (etapa, instituição)
- `/app/pacientes/novo` e `/app/pacientes/:id` — perfil com abas: Dados, Família & Cuidadores, Medicação, Jornada, Mensagens, Adesão
- `/app/mensagens` — composer manual (1:1 ou em massa), seleção de canal WhatsApp/SMS, escolha de template, agendamento
- `/app/conteudos` — biblioteca educativa (CRUD)
- `/app/jornadas` — configurar trilhas por etapa e passos
- `/app/relatorios` — adesão por paciente, por equipe, taxa de resposta
- `/app/integracoes` — toggle CRM mock (HubSpot/Salesforce/Pipedrive), botão "Sincronizar" que grava em `crm_sync_log`
- `/app/equipe` (admin) — convidar membros, gerenciar papéis
- `/app/perfil` — editar dados do profissional

Header da área logada com sidebar e avatar/logout. A landing `/` continua intacta com CTA "Entrar" e "Cadastre-se agora" apontando para `/signup`.

## 4. Envio de mensagens (simulado)

- Edge function `send-message` grava em `messages` com `status='sent'` e `sent_at=now()` — sem provedor externo.
- Edge function agendada `process-reminders` (cron diário) lê `medications` e `patient_journeys`, gera mensagens pendentes respeitando horário e canal preferido do destinatário (paciente e/ou responsável).
- Edge function `simulate-adherence-response` para o usuário marcar manualmente "paciente confirmou" / "não tomou" gerando `adherence_events`.

## 5. Relatórios

- View SQL `v_adherence_by_patient` (eventos confirmados / esperados nos últimos 30 dias).
- Tela de relatório consome a view e renderiza com Recharts (linha de adesão, barras por etapa, ranking de pacientes em risco).

## 6. Integração CRM (mock)

- Tela `/app/integracoes`: cards de HubSpot / Salesforce / Pipedrive com switch "conectado" (apenas visual nesta fase).
- Botão "Sincronizar agora" chama edge function `crm-sync` que serializa pacientes + contatos e grava no `crm_sync_log` — sem chamada externa real. Estrutura pronta para plugar provedor depois.

## 7. UI/UX

- Reutilizar o design system atual (cores brand/primary, fonte display, cards arredondados, shadow-soft).
- Sidebar fixa no `/app` com ícones lucide já presentes (Users, Pill, MessageCircle, HeartPulse, Apple, Plug, BarChart3, Settings).
- Estados vazios ilustrados com microcopy em PT-BR.
- Toda comunicação em PT-BR; manter tom acolhedor da landing.

## 8. Segurança

- RLS obrigatória em todas as tabelas; nada de role na `profiles`.
- Validação de entrada com Zod em formulários e edge functions.
- Senhas: ativar HIBP (leaked password protection).
- Convites de equipe via edge function que cria registro em `user_roles` após signup confirmado.

## 9. Entrega faseada (dentro deste plano)

1. Cloud + auth + profiles + roles + login/signup/reset + layout `/app` com sidebar.
2. Pacientes + contatos (família/cuidadores) + CRUD completo.
3. Biblioteca de conteúdos + jornadas + medicação.
4. Mensagens (composer + lista) + edge function simulada + lembretes agendados.
5. Adesão + relatórios com gráficos.
6. CRM mock + tela de integrações + admin/convites.

Tudo fica numa só entrega; a numeração é só a ordem de implementação interna.

## Fora de escopo agora

- Envio real via Twilio/WhatsApp Business API (estrutura fica pronta para plugar).
- Integração CRM real (apenas mock + log).
- App mobile dedicado para paciente — comunicação continua por WhatsApp/SMS.
