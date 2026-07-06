
# Redesign Chagas Connect Care — Plano faseado

Execução em **6 fases**. Cada fase é entregável, testável e mantém o app 100% funcional. Nada de regressão de dados, contratos Supabase preservados, componentes shadcn reaproveitados.

## Princípios transversais (aplicados em todas as fases)

- **Design tokens em `src/index.css` + `tailwind.config.ts`**. Nenhum `text-white`/`bg-[#...]` em componente. Tokens semânticos: `--brand-graphite #4A504A`, `--ink #29322E`, `--coral #E7877C`, `--coral-strong #B94E47` (primary de ação), `--care-green #236B5A` (confirmação), `--care-green-medium #2F7D6C`, `--mint-soft #E7F2EE`, `--coral-soft #FBE9E6`, `--background-warm #FFF8F5`, `--background-neutral #F4F7F5`, `--border-soft #DDE4E0`, `--text-muted #65716B`. Dark mode adaptado (sem azul shadcn genérico).
- **Tipografia**: mantém Plus Jakarta Sans (títulos) e Inter (UI). Escala H1 32/40, H2 24/32, H3 20/28, body 16/24, small 14/20, caption 12/16.
- **Acessibilidade WCAG 2.2 AA**: contraste, foco visível, alvos ≥44px, `prefers-reduced-motion`, sem cor como único indicador (sempre ícone+texto), `aria-live` para status.
- **Organização**: cada área nova em `src/features/<area>/{components,hooks,services,types.ts}`. Nada de arquivos > ~300 linhas.
- **Sem métricas fictícias**: componentes de dashboard usam `useQuery` real; quando faltar dado, `EmptyState` explícito.
- **Rotas antigas → `<Navigate replace>`** para novas URLs; nenhum bookmark quebra.

---

## Fase 1 — Fundação: tokens, tipografia, shell, "Hoje"

**Objetivo**: base visual + navegação nova + primeira página operacional.

Entregas:
1. `src/index.css`: reescrever camada `:root` e `.dark` com a paleta acima em HSL; remover cores hardcoded remanescentes.
2. `tailwind.config.ts`: mapear tokens (`brand`, `coral`, `coralStrong`, `careGreen`, `mintSoft`, `warm`, `borderSoft`, `mutedText`), radius, sombras suaves.
3. `src/components/ui/button.tsx`: variantes `primary` (coral-strong), `care` (care-green), `soft`, `ghost` — sem `text-white` fixo, tudo via tokens.
4. **App shell novo** (`src/components/app/shell/`):
   - `AppSidebar.tsx` (264px, colapsável 80px) com grupos: **Cuidado** (Hoje, Pessoas, Caixa de cuidado, Jornadas, Biblioteca, Insights) e **Administração** recolhível (Modelos Meta, Canais, Instituição, Equipe, Privacidade, Perfil).
   - `InstitutionSwitcher.tsx`, `ChannelHealthPill.tsx` (compacto no rodapé da sidebar), `UserFooter.tsx`.
   - Mobile: header 64px + drawer; sem bottom nav.
   - Substitui `src/components/app/AppLayout.tsx` mas mantém a mesma API de `<Outlet />`.
5. **Rotas** em `src/App.tsx`:
   - Novas: `/app/hoje`, `/app/pessoas`, `/app/pessoas/:id`, `/app/caixa`, `/app/jornadas`, `/app/biblioteca`, `/app/insights`, `/app/admin/modelos-meta`, `/app/admin/canais`, `/app/admin/instituicao`, `/app/admin/equipe`, `/app/admin/privacidade`, `/app/admin/perfil`.
   - Redirects: `/app` → `/app/hoje`, `/app/pacientes*` → `/app/pessoas*`, `/app/mensagens` + `/app/conversas` → `/app/caixa`, `/app/conteudos*` → `/app/biblioteca*`, `/app/conteudos/campanha` → `/app/jornadas`, `/app/segmentos*` → `/app/jornadas` (aba Audiências), `/app/modelos*` → `/app/admin/modelos-meta*`, `/app/relatorios` → `/app/insights`, `/app/configuracoes/whatsapp` → `/app/admin/canais`, `/app/perfil` → `/app/admin/perfil`.
6. **Página `Hoje`** (`src/features/today/`):
   - `TodayHeader` (saudação + data + instituição + `ChannelHealth` + botão "Nova ação de cuidado").
   - `AttentionQueue` com `CareActionCard` para: respostas pendentes, consultas sem confirmação, falhas de envio, pessoas sem contato recente, jornadas interrompidas, templates rejeitados, cadastros incompletos. Cada card: ícone + contagem + explicação + prioridade + CTA. Contagens vêm de queries reais em `messages`, `patients`, `message_templates`; quando 0, estado vazio positivo.
   - `CareAgenda` timeline de eventos programados (a partir de `message_batches` scheduled + medications próximas).
   - `CommunicationSummary` (alcançadas/entregues/respondidas/falhas/tempo — todos derivados de `messages` do dia).
7. **Componentes base** criados nesta fase: `AttentionQueue`, `CareActionCard`, `ChannelHealth`, `ChannelBadge`, `EmptyState`, `ErrorState`, `SkeletonState`.

Critério de aceite: build passa, todas as rotas antigas redirecionam, "Hoje" renderiza com dados reais, contraste AA verificado em botões primários.

---

## Fase 2 — Pessoas + Perfil 360°

Entregas:
1. `src/features/people/` com `PeopleList` (avatar, nome, idade, cidade, estágio, responsável, canal, último contato, próxima ação, rede, pendências), `PeopleFilters` (quick filters: precisa atenção / sem contato / sem consentimento / sem canal / consulta próxima / medicação ativa / sem cuidador / jornada interrompida), toggle lista/cards, paginação.
2. `PatientSummaryHeader` fixo (nome, ID mascarado, idade, status, responsável, canal, consentimento, último contato, botão "Comunicar").
3. Tabs do perfil: **Resumo**, **Linha do tempo**, **Próxima melhor ação**.
4. `CareOrbit` v1 usando `contacts` existentes vinculados ao paciente. Campo `relationship` já existe em contacts; complemento visual com `role` derivado. Versões: full / compact / read-only / selectable. Mobile: lista hierárquica.
5. `CareTimeline` unificando `messages`, `medications`, `adherence_events`, mudanças cadastrais.
6. `NextBestAction` — regras explícitas (não IA): consulta em <48h sem confirmação → "Confirmar consulta"; canal inválido → "Atualizar contato"; sem cuidador → "Incluir cuidador"; última mensagem falhou → "Revisar falha".

---

## Fase 3 — Caixa de Cuidado (unificação Mensagens + Conversas)

Entregas:
1. `src/features/inbox/` com layout 3 colunas (desktop): `QueueList` (Todas/Não lidas/Precisa resposta/Aguardando paciente/Aguardando equipe/Agendamentos/Falhas/Encerradas), `ConversationList` (nome, relação, paciente, canal, última msg, tempo aguardando, responsável, prioridade, status janela WhatsApp), `ConversationContext` (dados mínimos + `CareOrbit` compact + consentimento + próxima consulta + jornada + últimas interações + ações rápidas).
2. `Composer` com tabs Texto / Template / Conteúdo aprovado / Anexo; chips de variáveis; preview; seletor de canal e remetente; toggle nota interna vs mensagem externa.
3. Reaproveita edge functions existentes (`send-whatsapp`, `approvedTemplatePayload`). Zero mudança em contratos.
4. Mobile: pilha (lista → conversa → contexto em sheet).

---

## Fase 4 — Jornadas (stub visual) + Audiências + Biblioteca

Entregas:
1. `src/features/journeys/`:
   - `JourneyList` (cards com status/ativas/conclusões/interrupções/falhas/taxa resposta/última execução).
   - `JourneyBuilder` visual em **colunas** (sem react-flow para evitar dep pesada): entrada → eventos → ramificações. Nós: Entrada, Evento, Audiência, Condição, WhatsApp, SMS, E-mail, Página segura, Aguardar, Verificar resposta, Criar tarefa, Notificar equipe, Encaminhar humano, Encerrar. Cada nó tem alternativa em formulário/lista (a11y).
   - **Marcado explicitamente como preview**: banner "Motor de execução em breve. Estrutura salva mas não executada." Dados persistem em localStorage por enquanto (schema definido em fase futura).
2. `src/features/audiences/` reaproveitando `audience_segments`. Regras renderizadas como **frase legível** ("Pessoas em acompanhamento crônico, com consulta nos próximos 7 dias, consentimento ativo e WhatsApp válido"). Contadores: elegíveis, excluídos (com motivos), distribuição por papel, amostra, última atualização. Filtros avançados em accordion.
3. `src/features/content-library/` reaproveitando `content_library` + `content_folders`. Cada item: título, objetivo, público, estágio, assunto, resumo, corpo, CTA, fonte, revisor, data revisão, validade, versão, nível de leitura, canais, templates relacionados, status (Rascunho/Revisão clínica/Revisão privacidade/Aprovado/Expirando/Arquivado).

---

## Fase 5 — Modelos Meta (2 colunas) + Insights + Canais

Entregas:
1. `src/features/meta-templates/` reorganizando `MessageTemplateEdit.tsx` (atualmente monolítico):
   - Coluna esquerda: acordeões Identificação, Categoria, Cabeçalho, Corpo, Variáveis (com `TemplateParameterOrder` existente), Rodapé, Botões, Exemplos, Público, Revisão.
   - Coluna direita fixa: `WhatsAppPreview` + `TemplateLifecycle` stepper (Rascunho→Validado→Enviado→Em análise→Aprovado, com estado Rejeitado exibindo motivo/parte/orientação/CTA nova versão).
   - Preserva: upload mídia, sincronização, realtime, polling, bloqueio pós-envio, histórico, duplicação, versionamento, botão "Sincronizar com Meta" já adicionado.
2. `src/features/insights/` (era Relatórios) em 3 seções: **Entrega** (enviadas/entregues/falhas/motivos/fallback), **Engajamento** (respostas/tempo resposta/cliques/confirmações/opt-outs/escalonamentos), **Jornada** (iniciadas/concluídas/interrompidas/tarefas resolvidas/consultas confirmadas/tempo). Gráficos com alternativa textual. Sem confundir entrega com resultado clínico.
3. `src/features/settings/channels/` — centro de saúde dos canais. Cards WhatsApp / SMS (placeholder desabilitado) / E-mail (placeholder) / Página segura (placeholder) / Voz (futuro) / Prontuário FHIR (futuro). Cada card: status, última sync, remetente, falhas recentes, ações Configurar/Testar/Diagnóstico. Reaproveita `whatsapp-diagnostics`, `institution_whatsapp_settings`.

---

## Fase 6 — Onboarding público + Privacidade + polimento

Entregas:
1. `src/pages/public/OnboardingForm.tsx` refeito como formulário progressivo 8 passos: Confiança/contexto → Identificação → Papel no cuidado → Contato → Preferências → Consentimentos (separados por finalidade e canal) → Revisão → Confirmação. Exibe instituição, quem convidou, finalidade, tempo estimado, link privacidade, contato, próximos passos.
2. `src/features/admin/privacy/`: página de auditoria (apenas perfis autorizados via `has_role('admin')`), `AuditEvent` component, mascaramento de identificadores, `ConsentStatus`, `PrivacyCheck` em fluxos de envio, `MessageSafetyPreview` (alerta de conteúdo sensível), confirmação reforçada para disparos em massa, bloqueio de variável vazia, bloqueio de envio para relação não autorizada.
3. Componentes finais criados: `AuditEvent`, `ConsentStatus`, `PrivacyCheck`, `MessageSafetyPreview`, `DeliveryFunnel`, `RecipientSummary`, `TemplateLifecycle`, `ClinicalReviewBadge`, `JourneyNode`, `JourneyProgress`, `CareNetworkMember`.
4. Passada final de a11y (axe manual em cada rota principal), responsividade (desktop / tablet / mobile), verificação contraste, revisão de estados loading/vazio/erro/sucesso em toda tela.

---

## Detalhes técnicos-chave

- **Preservado sem toque**: `supabase/functions/*`, `src/integrations/supabase/{client,types}.ts`, contratos de dados, RLS, edge functions, hooks `useQuery` e chaves de cache existentes.
- **Reaproveitado**: `TemplateParameterOrder`, `TemplateEditorForm`, `WhatsAppPreview`, `VariableInput`, `UseTemplateDialog`, `MetaStatusDialog`, `SegmentFilters`, `PatientMultiSelect`, `NewPatientWizard`, `useFolders`, `useInstitutionDefaultFooter`, `metaVariables`, `templateDraft`, `whatsapp*` libs.
- **Refatorado** (dividido em subcomponentes, sem mudar comportamento): `MessageTemplateEdit.tsx`, `Messages.tsx`, `Conversas.tsx`, `Dashboard.tsx`, `Patients.tsx`, `PatientDetail.tsx`.
- **Removido**: nada. Todos os arquivos antigos ou viram redirect, ou são recompostos como feature.
- **Dependências novas**: nenhuma nesta fase 1. React Flow não será adicionado (builder de jornadas usa colunas). `framer-motion` só se necessário para transição do drawer mobile.

## Ordem de execução proposta

Fase 1 primeiro (fundação sem a qual tudo colide). Ao final de cada fase eu peço sua validação antes de iniciar a próxima, para você conseguir revisar o que mudou visualmente e no fluxo antes de acumular.

Posso começar pela Fase 1?
