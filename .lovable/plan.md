## Caixa de Entrada WhatsApp + Cadastro Público

Adicionar uma nova área "Conversas" que mostra cada chat com pacientes/familiares/cuidadores, respeitando a janela de 24h do WhatsApp, e um fluxo de onboarding para contatos desconhecidos via link público — sempre usando formatos gratuitos (mensagem de serviço dentro da janela ou Template de UTILIDADE fora dela).

### 1. Banco de dados

Migration única:

- `messages`: garantir `direction` ('inbound'|'outbound') e `read_at` (verificar antes de adicionar); índice `(institution, identity_id, sent_at desc)`.
- Nova `quick_replies` (sugestões por categoria/objetivo, escopo por instituição, RLS).
- Nova `onboarding_invites`:
  - `token` (uuid público), `institution`, `wa_id`, `phone`, `intended_role` ('paciente'|'familiar'|'cuidador'), `patient_id` opcional, `status` ('pending'|'completed'|'expired'), `expires_at`, `completed_at`, `created_by`.
  - RLS: equipe da instituição lê/cria; leitura pública só via edge function pelo token.
- `whatsapp_identities`: apenas consulta da vinculação existente (`patient_id`/`contact_id`) para classificar conhecido/desconhecido.
- GRANT + RLS conforme padrão.

### 2. Edge functions

- `whatsapp-webhook` (update): no inbound, além de renovar janela 24h, classifica identidade como conhecida/desconhecida e dispara realtime `inbox:{institution}` evento `new_message`.
- `create-onboarding-invite` (nova): equipe gera token e envia o convite **sempre como formato gratuito**:
  - Janela 24h aberta → mensagem `interactive` `button` (resposta de serviço, custo zero) com botão `url` "Fazer cadastro" → `https://<app>/cadastro/{token}`.
  - Janela fechada → Template de categoria **UTILITY** pré-aprovado (`onboarding_invite_utility`) com botão `url` dinâmico recebendo o `{{token}}`. Nada de Marketing.
  - Retorna a URL gerada e o modo usado.
- `public-onboarding` (nova, `verify_jwt=false`): GET valida token e devolve dados mínimos; POST cria `patients` ou `contacts` conforme `intended_role`, vincula `whatsapp_identities`, marca invite `completed`. Rate limit por IP/token.

### 3. Frontend — área "Conversas" (`/app/conversas`)

Layout inbox em 2 colunas:

```text
┌─────────────────┬──────────────────────────────┐
│ Lista de chats  │  Conversa selecionada        │
│ • badge não lida│  Header: nome / paciente /   │
│ • último trecho │          janela 24h restante │
│ • janela aberta │  Histórico de mensagens      │
│ • desconhecido  │  ─────────────────────────── │
│                 │  [Respostas rápidas]         │
│                 │  [Composer]                  │
└─────────────────┴──────────────────────────────┘
```

Componentes em `src/components/app/inbox/`:

- `ConversationList.tsx` — agrupa por `identity_id`, badge não lida, chip "janela aberta Xh", chip "desconhecido".
- `ConversationView.tsx` — bolhas inbound/outbound, marca como lida ao abrir.
- `WindowStatusBadge.tsx` — usa helper existente em `whatsapp.ts`.
- `QuickRepliesBar.tsx` — 3-5 sugestões a partir de `quick_replies` e da categoria do último inbound.
- `MessageComposer.tsx`:
  - Janela aberta → envio de texto livre (mensagem de serviço, gratuita).
  - Janela fechada → composer desabilitado, com CTA "Enviar Template" abrindo `UseTemplateDialog` (apenas Templates de UTILIDADE).
- `UnknownContactPanel.tsx` — quando identidade desconhecida: botão "Enviar convite de cadastro" abre dialog (escolhe `intended_role` e paciente opcional) e chama `create-onboarding-invite`, que decide automaticamente entre interactive (janela aberta) ou Template UTILITY (janela fechada).

Realtime: canal `inbox:{institution}` para atualizar lista e badge global de não lidas no item de menu "Conversas" no `AppLayout`.

### 4. Frontend — página pública de cadastro

Rota `/cadastro/:token` (fora do `/app`, sem auth):

- `src/pages/public/OnboardingForm.tsx` com layout próprio, identidade da instituição.
- Fluxo:
  1. GET `public-onboarding` valida token.
  2. Form curto adaptado ao `intended_role`:
     - paciente: nome, data nasc., contato preferencial, consentimento LGPD.
     - familiar/cuidador: nome, parentesco, paciente vinculado pré-preenchido, consentimento.
  3. POST cria registro e mostra tela de sucesso.
  4. Token inválido/expirado/usado → tela amigável.
- Não é o cadastro de equipe; sem senha, sem login.

### 5. Integração com envio existente (somente formatos gratuitos)

- `send-whatsapp`: já suporta `interactive` e `template` com botão URL. O convite usa:
  - **Mensagem de serviço `interactive` com botão URL** quando a janela de 24h estiver aberta (gratuita, sem categoria de marketing).
  - **Template de UTILIDADE** (`onboarding_invite_utility`, pt_BR, pré-aprovado pela Meta) com botão `url` dinâmico quando a janela estiver fechada — também gratuito dentro das regras de utilidade.
- Nunca usar Template MARKETING ou AUTHENTICATION para o convite.
- Adicionar o domínio público (`<published-url>/cadastro/`) ao `WHATSAPP_URL_ALLOWLIST`.
- Bloquear envio livre fora da janela com mensagem clara apontando para Templates de utilidade.

### 6. Rotas/menu

- `App.tsx`: adicionar `/app/conversas` e `/cadastro/:token` (fora do AppLayout).
- `AppLayout`: novo item "Conversas" com badge de não lidas.

### Resumo do que muda

- 1 migration (quick_replies, onboarding_invites, colunas auxiliares em messages).
- 3 edge functions (1 update, 2 novas) — todas no caminho gratuito.
- Nova área Conversas com lista + chat + composer + quick replies + painel desconhecido.
- Nova página pública de cadastro via token.
- Realtime por instituição e badge de não lidas no menu.
