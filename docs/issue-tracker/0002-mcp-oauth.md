---
id: 0002
titulo: Servidor MCP com OAuth (integração com agentes de IA)
status: concluido
criado_em: 2026-07-10
atualizado_em: 2026-07-10
---

## Contexto

Habilitar o painel "More → Agent integrations" para expor o Chagas Digital
Care como servidor MCP, permitindo que clientes externos (ChatGPT, Claude,
Cursor, etc.) chamem ferramentas do app agindo como um usuário real —
respeitando os papéis (`superadmin`/`admin`/`equipe`), a instituição e todas
as políticas de RLS já existentes.

## Decisões

- **Autenticação:** OAuth 2.1 gerenciado pelo Lovable Cloud
  (`supabase--configure_oauth_server`). Servidor público foi descartado
  porque todo dado do app é escopado por instituição via RLS.
- **SDK:** `@lovable.dev/mcp-js` com `mcpPlugin()` no Vite. A edge function
  `supabase/functions/mcp/index.ts` é auto-gerada — não editar manualmente.
- **Issuer OAuth:** derivado de `VITE_SUPABASE_PROJECT_ID` para bater com o
  documento de discovery (`https://<ref>.supabase.co/auth/v1`).
- **Tokens:** cada ferramenta encaminha o bearer OAuth ao Supabase via
  `Authorization`, de forma que RLS execute como o `auth.uid()` do chamador.
- **Consentimento:** rota `/.lovable/oauth/consent` renderiza tela em pt-BR
  com nome do cliente, escopos solicitados e botões Aprovar/Cancelar. Rota
  `/auth` preserva `?next=` para retornar ao consentimento após login.

## Ferramentas expostas

| Ferramenta | Descrição |
| --- | --- |
| `whoami` | Retorna usuário, papéis e instituição do chamador. |
| `list_patients` | Lista pessoas sob cuidado visíveis por RLS. |
| `get_patient` | Detalha paciente + rede de cuidado + últimas mensagens. |
| `list_journeys` | Lista jornadas da instituição. |
| `list_conversations` | Mensagens recentes da caixa (WhatsApp). |

Todas são somente-leitura por ora. Ferramentas de escrita (enviar mensagem,
matricular em jornada, criar tarefa) devem ser adicionadas em issues próprios
com `annotations.destructiveHint`/`needsApproval`.

## Critérios de aceitação

- [x] `supabase--configure_oauth_server` ativo.
- [x] Chaves de assinatura ES256 ativas (JWKS não vazio).
- [x] Função `mcp` implantada e listada em `.lovable/mcp/manifest.json`.
- [x] Rota `/.lovable/oauth/consent` renderiza e preserva `next` no `/auth`.
- [x] Cada ferramenta usa o token OAuth do chamador (sem service role).

## Notas

- Endpoint público: `https://<project-ref>.supabase.co/functions/v1/mcp`.
- Ferramentas escritas em pt-BR conforme regra do `AGENTS.md`; nomes de
  símbolos permanecem em inglês.