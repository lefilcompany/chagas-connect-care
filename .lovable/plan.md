# Plano — Reescrita de CONTEXT.md, architecture.md e AGENTS.md

## Decisões fixadas (respostas 1–6)

- **Escopo:** reescrever os 3 documentos (não patch incremental).
- **AGENTS.md:** orquestrador + 6 papéis executáveis em paralelo, com contratos entre slices.
- **architecture.md:** contrato formal por edge function; ficha por tabela nuclear; sem Mermaid.
- **Classificação de tabelas aprovada** (ver seção "Modelo de dados" abaixo).
- **`adherence_events` / `medications`:** feature ativa → entram no glossário como termos de primeira classe e viram tabelas nucleares.
- **Divergências de nomenclatura:** docs se alinham ao banco (não o contrário).

## Tabelas a "mover" para alinhar frontend ↔ banco

O frontend já usa os nomes reais do banco (via `src/integrations/supabase/types.ts`, auto-gerado). O desalinhamento está **só nas docs**. Portanto, nenhuma migration de rename; o trabalho é reescrever as docs e o glossário.

Correções no glossário do `CONTEXT.md`:

| Termo antigo (doc) | Termo canônico (banco) | Ação |
| --- | --- | --- |
| `care_network_contacts` | **`contacts`** | Renomear entrada "Rede de cuidado / Contato" para apontar a `contacts`. Manter "contato" como rótulo de domínio, mas remover a proibição de "contato" no glossário de Pessoa (deixar de sinônimo proibido). |
| `templates` | **`message_templates`** | Atualizar seção "Template Meta / WhatsApp" para citar `message_templates`. |
| `audiences` | **`audience_segments`** | Atualizar seção "Audiência / Segmento" para citar `audience_segments`. |
| (ausente) | **`adherence_events`** | Adicionar entrada "Adesão / Evento de adesão" no glossário. |
| (ausente) | **`medications`** | Adicionar entrada "Medicação". |
| Fronteira "não somos prontuário" | — | Refinar: não somos prontuário **clínico** (evolução, prescrição, diagnóstico), mas registramos **adesão a medicação** como parte da jornada de cuidado. |

Correções no `architecture.md` (seção 4 — Modelo de dados): substituir `care_network_contacts` → `contacts`, `templates` → `message_templates`, `audiences` → `audience_segments`; adicionar `adherence_events` e `medications` como nucleares.

## Estrutura final dos 3 documentos

### CONTEXT.md (reescrito)

1. Visão do produto
2. Glossário (termos alinhados ao banco + `adherence_events`/`medications` adicionados + `contacts` correto)
3. Fronteiras (refinada: adesão faz parte; evolução clínica não)
4. Stack técnica (mantida, com edge functions atualizadas incluindo `mcp`)
5. Convenções de código

### architecture.md (reescrito, denso)

1. Visão C4 nível 1
2. Módulos frontend (por slice)
3. **Edge functions — contrato formal por função** (15 funções):
   - Para cada uma: método, path, autenticação, request schema, response schema, side-effects (tabelas escritas, chamadas externas), invariantes, códigos de erro.
   - Inclui a nova `mcp` (OAuth + tools).
4. **Modelo de dados — buckets**:
   - **Nucleares (15) — ficha completa:** `institutions`, `profiles`, `user_roles`, `patients`, `contacts`, `messages`, `message_templates`, `message_batches`, `content_library`, `content_folders`, `audience_segments`, `journeys`, `journey_runs`, `journey_run_steps`, `journey_tasks`.
     Cada ficha: colunas nucleares, FKs, invariantes, RLS (SELECT/INSERT/UPDATE/DELETE por papel), GRANTs, helpers `SECURITY DEFINER` que a tocam.
   - **Nucleares adicionadas (2 — feature ativa):** `adherence_events`, `medications` — ficha completa.
   - **Semi-nucleares WhatsApp (7) — ficha resumida:** `whatsapp_channels`, `whatsapp_identities`, `whatsapp_conversations`, `whatsapp_media_assets`, `whatsapp_template_submissions`, `whatsapp_template_header_media`, `institution_whatsapp_settings`.
   - **Auxiliares (8) — tabela-resumo:** `onboarding_invites`, `quick_replies`, `crm_sync_log`, `whatsapp_admin_audit_log`, `whatsapp_integration_health`, `whatsapp_otp_codes`, `whatsapp_template_events`, `whatsapp_unmatched_events`, `whatsapp_webhook_activity`.
5. **Catálogo de helpers `SECURITY DEFINER`** (`has_role`, `get_user_institution`, `is_superadmin`, `can_access_patient`, `whatsapp_window_open`, `mark_expired_whatsapp_media`, `handle_new_user`, `prevent_institution_self_change`, `set_updated_at`, `update_updated_at_column`) — assinatura, propósito, quem chama.
6. Fluxos críticos em ASCII (envio WhatsApp + webhook; execução de jornada; onboarding público; OAuth do MCP).
7. Matriz de permissões (mantida, expandida por tabela nuclear).
8. Deploy / cron / bucket de storage.
9. Riscos e dívidas (placeholder linkando `docs/issue-tracker/`).

### AGENTS.md (reescrito — orquestrador + 6 papéis)

1. Regra-mãe (nunca decidir em silêncio) — mantida.
2. **Papel do orquestrador**: recebe pedido, quebra em slices independentes, atribui a papéis, define contratos entre slices, valida integração.
3. **6 papéis executáveis em paralelo**:
   - **Domain Steward** — dono de `CONTEXT.md` e glossário.
   - **Guardião de RLS / Banco** — dono de migrations, políticas, GRANTs, helpers `SECURITY DEFINER`.
   - **Edge Function Engineer** — dono de `supabase/functions/*` e contratos.
   - **Frontend Slice Engineer** — dono de um `src/features/<slice>/`.
   - **Design System Guardian** — dono de tokens, shadcn, guard-rails visuais.
   - **QA / Docs** — dono de testes, `docs/adr/`, `docs/issue-tracker/`, atualização final dos documentos.
4. **Contratos entre papéis** (o que cada papel pode mudar sem coordenar, e o que exige handshake).
5. **Regras de paralelização**: quais slices podem rodar juntos (ex.: `people/` + `library/` OK; qualquer coisa que mexa em `messages` serializa).
6. Fluxo obrigatório de trabalho (issue-first, ADR quando aplicável).
7. Guard-rails (design, segurança, arquivos intocáveis, glossário é lei) — mantidos.
8. Protocolo de perguntas objetivas (1 por vez, 2–4 alternativas, recomendação com trade-off).

## Ordem de execução (quando eu entrar em build mode)

1. Reescrever `CONTEXT.md` (glossário alinhado ao banco + adesão/medicação).
2. Reescrever `docs/architecture.md` (contratos + fichas + helpers).
3. Reescrever `AGENTS.md` (orquestrador + 6 papéis + paralelização).
4. Nenhuma mudança de código de aplicação nem migration nesta rodada — só documentação.

## O que fica de fora explicitamente

- Nenhum rename de tabela no banco.
- Nenhum diagrama Mermaid.
- Nenhum ADR novo automático (só se surgir decisão que preencha os 3 critérios do `docs/adr/README.md`).
- ERD visual (fica para uma rodada futura, se você pedir).
