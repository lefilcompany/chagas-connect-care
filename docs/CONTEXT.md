# CONTEXT — Chagas Digital Care

> Documento canônico do domínio. Toda decisão de nomenclatura, modelagem
> e UX deve respeitar os termos aqui. Termo novo → atualize este arquivo
> **na mesma tarefa** em que ele for introduzido.

Idioma oficial da documentação e do produto: **pt-BR**.

---

## 1. Visão do produto

O **Chagas Digital Care** é uma plataforma para instituições de saúde
acompanharem a **jornada de cuidado do paciente** — da entrada na rede
até a alta clínica — combinando:

- **Comunicação multicanal** (WhatsApp, SMS, e-mail) com conformidade
  LGPD e templates aprovados pelo Meta Business.
- **Automações de jornada** (grafos de nós executados por um runner
  próprio) para lembretes, educação, verificação de resposta e
  encaminhamento humano.
- **Biblioteca clínica** de conteúdos reutilizáveis versionados.
- **Inbox unificada** para atendimento humano quando a automação
  precisa escalar.
- **Rotina da equipe** (tela "Hoje", tarefas, próxima melhor ação,
  pendências por paciente).
- **Multi-instituição** (superadmin gerencia várias instituições; cada
  instituição opera isoladamente via RLS).

**Núcleo do domínio:** a **jornada de cuidado do paciente**. Tudo o mais
(canais, mensagens, biblioteca, tarefas, audiências) existe para
viabilizar essa jornada.

---

## 2. Glossário de domínio

Cada termo tem uma definição canônica. **Sinônimos proibidos** são
termos que aparecem em conversas informais mas **não devem** ser usados
em código, UI, docs ou issues.

### Paciente / Pessoa
- **Definição:** indivíduo sob cuidado da instituição. Tabela principal:
  `patients`. A camada de UI usa o rótulo "Pessoa" quando o contexto é
  cadastral (lista, edição), e "Paciente" quando é clínico (jornada,
  mensagens).
- **Sinônimos proibidos:** "usuário" (usuário = quem opera o sistema),
  "cliente", "contato" (contato = rede de cuidado).

### Rede de cuidado / Contato
- **Definição:** pessoas ao redor do paciente (cuidador principal,
  familiar, responsável legal). Tabela: `care_network_contacts`.
- Um paciente pode ter zero, um ou vários contatos. Cada contato tem
  `relation`, `channel_pref` e `authorization_status` próprios.
- **Sinônimos proibidos:** "acompanhante", "responsável" isolado
  (usar `relation`), "parente".

### Consentimento / Autorização
- **Definição:** permissão explícita da pessoa (paciente ou contato de
  rede de cuidado) para receber comunicações por um canal. Coluna:
  `authorization_status`.
- **Sinônimos proibidos:** "opt-in" (só em código técnico interno).

### Canal
- **Definição:** meio pelo qual a instituição fala com paciente/contato.
  Valores canônicos: `whatsapp`, `sms`, `email`. Preferência armazenada
  em `channel_pref`.
- Um canal é **válido** quando existe identificador (telefone/e-mail) +
  consentimento + verificação técnica (ex.: número existe no WhatsApp).

### Pendência
- **Definição:** o que falta para uma pessoa ficar "em dia" na jornada.
  Derivado (não persistido) em `PersonDerived.pendencies`. Categorias:
  sem canal válido, sem cuidador cadastrado, sem consentimento, última
  mensagem falhou, sem contato recente.
- **Sinônimos proibidos:** "problema", "erro do paciente", "alerta".

### Jornada
- **Definição:** fluxo automatizado modelado como grafo de nós. Tabela:
  `journeys`. Estados: `rascunho`, `ativa`, `pausada`, `arquivada`.
- Uma jornada tem uma `trigger` (`manual` ou `event`) e uma audiência
  opcional.
- **Sinônimos proibidos:** "fluxo" solto (fluxo = qualquer sequência),
  "campanha" (campanha é envio pontual, não automação recorrente),
  "workflow".

### Nó / Coluna
- **Definição:** unidade atômica de uma jornada. Kinds suportados:
  `entrada`, `evento`, `audiencia`, `condicao`, `whatsapp`, `sms`,
  `email`, `pagina-segura`, `aguardar`, `verificar-resposta`,
  `criar-tarefa`, `notificar-equipe`, `encaminhar-humano`, `encerrar`.
- Nós são agrupados visualmente em colunas (`JourneyColumn`) no editor.

### Run (execução de jornada)
- **Definição:** instância de execução de uma jornada para um paciente
  específico. Tabela: `journey_runs`. Estados: `queued`, `running`,
  `waiting`, `completed`, `failed`, `stopped`, `handoff`.
- Cada passo produz um `journey_run_steps`.
- **Sinônimos proibidos:** "instância", "processo", "execução" solto
  (execução = ato; run = entidade).

### Tarefa da jornada
- **Definição:** tarefa humana criada por um nó `criar-tarefa`. Tabela:
  `journey_tasks`. Estados: `aberta`, `concluida`, `cancelada`.

### Template Meta / WhatsApp
- **Definição:** mensagem pré-aprovada pelo Meta Business para envio via
  WhatsApp Cloud API. Ciclo: rascunho → submissão → `APPROVED` /
  `REJECTED` / `PAUSED`.
- **Sinônimos proibidos:** "modelo" (ambíguo com modelos de dados).

### Audiência / Segmento
- **Definição:** coorte dinâmica de pacientes definida por filtros
  (`TargetingMode`). Reutilizável em jornadas e campanhas.

### Biblioteca de conteúdo
- **Definição:** cápsulas de conteúdo clínico reutilizáveis. Tabela:
  `content_library`. Status derivados: `rascunho`,
  `revisao-clinica`, `revisao-privacidade`, `aprovado`, `expirando`,
  `arquivado`.

### Inbox / Conversa
- **Definição:** thread bidirecional entre a equipe e uma pessoa. Uma
  conversa é o par (paciente, canal). Mensagens: `messages` com
  `direction ∈ {inbound, outbound}`.

### Instituição
- **Definição:** tenant do sistema. Cada linha das tabelas operacionais
  carrega uma coluna `institution`, e RLS impede leitura/escrita
  cruzada. Função helper: `get_user_institution(auth.uid())`.
- **Sinônimos proibidos:** "empresa", "tenant" em UI (só em docs
  técnicas), "organização".

### Papéis (roles)
Armazenados em `user_roles` (nunca em `profiles`). Checagem via
`has_role(user_id, role)` `SECURITY DEFINER`.

- **`superadmin`** — opera o produto; enxerga todas as instituições.
- **`admin`** — administra uma instituição específica.
- **`equipe`** — membro operacional de uma instituição (uso diário).

### Today / Próxima melhor ação
- **Today** é a tela inicial da equipe: agenda, fila de atenção, resumo
  de comunicações.
- **Próxima melhor ação** é a sugestão priorizada por paciente derivada
  das pendências (`nextActionKey` em `PersonDerived`).

---

## 3. Fronteiras do domínio (o que NÃO somos)

- **Não somos prontuário eletrônico.** Não guardamos evolução clínica,
  prescrições, exames ou diagnóstico estruturado.
- **Não somos ERP/faturamento.** Nenhuma cobrança, TISS, convênio.
- **Não somos telemedicina síncrona.** Sem vídeo, sem sala virtual.
- **Não somos CRM genérico.** Somos verticais em cuidado; pipeline
  comercial não é responsabilidade nossa.

---

## 4. Stack técnica (100 % detalhada)

### 4.1 Frontend
- **React 18** + **TypeScript 5** + **Vite 5**.
- **Tailwind CSS v3** com tokens semânticos definidos em
  `src/index.css` (HSL). **Proibido** hardcode de cor (`text-white`,
  `bg-[#...]`), fontes genéricas (Inter/Poppins default) e gradientes
  roxo/azul padrão de IA.
- **shadcn/ui** (Radix) como base de componentes; variantes tematizadas
  via CSS variables.
- **TanStack Query v5** como fonte única de estado de servidor. Não há
  Redux/Zustand/Recoil neste projeto.
- **React Router** para rotas.
- **Vitest** + **@testing-library/react** para testes de unidade e
  componente.

### 4.2 Backend (Lovable Cloud / Supabase gerenciado)
- **Postgres** com Row-Level Security habilitado em todas as tabelas de
  `public`.
- **Auth** (Supabase Auth) com e-mail/senha e sessão gerenciada.
- **Storage** com bucket privado `whatsapp-media` (mídia de templates e
  mensagens).
- **Edge Functions** em **Deno** (`supabase/functions/*`).

### 4.3 Autorização e isolamento
- Papéis em `user_roles` (`app_role` enum: `superadmin | admin | equipe`).
- Checagem: `public.has_role(_user_id uuid, _role app_role)`
  `SECURITY DEFINER STABLE` — evita recursão em políticas RLS.
- Isolamento por instituição: coluna `institution` em toda tabela
  operacional + `public.get_user_institution(uid)` `SECURITY DEFINER`.

### 4.4 Integrações externas
- **Meta WhatsApp Cloud API** — Graph API `v25.0`. Envio, webhook de
  status, templates, diagnóstico, mídia.
- **CEP** — resolução de endereço no cadastro de paciente.

### 4.5 Edge functions ativas
Lista canônica (fonte: `supabase/functions/`):

| Função | Responsabilidade |
| --- | --- |
| `send-whatsapp` | Enviar uma `messages` via Graph API. |
| `whatsapp-webhook` | Receber status/mensagens do Meta. |
| `whatsapp-diagnostics` | Diagnóstico de canal (superadmin). |
| `create-whatsapp-template` | Criar template no Meta. |
| `sync-whatsapp-templates` | Sincronizar status dos templates. |
| `upload-whatsapp-template-media` | Subir mídia para templates. |
| `upload-whatsapp-media` | Subir mídia para mensagens ad-hoc. |
| `repair-whatsapp-channel` | Reparar configuração de canal. |
| `journey-enroll` | Inscrever paciente em jornada. |
| `journey-runner` | Cron que avança runs pendentes/em espera. |
| `process-message-batch` | Processar lote de mensagens agendadas. |
| `public-onboarding` | Endpoint público de onboarding de paciente. |
| `create-onboarding-invite` | Gerar link de convite de onboarding. |
| `delete-account` | Remoção de conta conforme LGPD. |

### 4.6 Build / deploy
- **Lovable** hospeda preview e versão publicada. Não há CI/CD próprio.
- Edge functions são versionadas em `supabase/functions/` e implantadas
  pela plataforma.
- Migrations em `supabase/migrations/` — cada `CREATE TABLE` em `public`
  **exige** `GRANT` + `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` +
  `CREATE POLICY` na **mesma** migration.

### 4.7 Segredos
- **Nunca** em variáveis `VITE_*` (chegam ao bundle do navegador).
- Chaves publicáveis (anon key) podem ficar em `.env`.
- Segredos do WhatsApp (`WHATSAPP_TOKEN`, `WHATSAPP_APP_SECRET`,
  `WHATSAPP_VERIFY_TOKEN`, `JOURNEY_RUNNER_SECRET`) vivem apenas no
  ambiente das edge functions.

---

## 5. Convenções de código

- Comentários e strings de UI em **pt-BR**.
- Nomes de arquivos, símbolos e colunas em **inglês** (consistência com
  ecossistema React/Supabase). Ex.: `PeopleList.tsx`, `patients.phone`.
- Nunca editar arquivos auto-gerados: `src/integrations/supabase/client.ts`,
  `src/integrations/supabase/types.ts`, `supabase/config.toml`,
  variáveis `VITE_SUPABASE_*` em `.env`.
- Design tokens semânticos obrigatórios (ver seção 4.1).
- Toda tabela `public` nova exige o combo `GRANT + RLS + POLICY` na
  mesma migration.
