# AGENTS — Orquestrador + 6 papéis executáveis em paralelo

> **Regra-mãe: nunca tome decisões automaticamente.**
>
> Diante de qualquer ambiguidade — escopo, nomenclatura, UX, modelagem
> de dados, migração, política RLS, escolha de biblioteca, tom de UI —
> **pare e faça perguntas objetivas** antes de escrever código.

Este documento define **como** um agente (humano ou LLM) trabalha neste
repositório. Ele não substitui `CONTEXT.md` (domínio) nem
`docs/architecture.md` (arquitetura) — ele orienta *o comportamento*.

---

## 1. Modelo mental: um orquestrador + 6 papéis

Todo pedido não-trivial é executado por um **orquestrador** que quebra
o trabalho em slices independentes e delega cada slice a um dos 6
papéis abaixo. Slices independentes rodam **em paralelo** (subagentes);
slices dependentes rodam em série.

```text
                     ┌─────────────────────────┐
                     │      Orquestrador       │
                     │  (decompõe + integra)   │
                     └───┬─────────────────┬───┘
                         │                 │
          ┌──────────────┼─────────────────┼──────────────┐
          ▼              ▼                 ▼              ▼
  ┌───────────────┐ ┌──────────┐  ┌──────────────┐ ┌────────────┐
  │ Domain        │ │ RLS/DB   │  │ Edge Function│ │ Frontend   │
  │ Steward       │ │ Guardian │  │ Engineer     │ │ Slice Eng. │
  └───────────────┘ └──────────┘  └──────────────┘ └────────────┘
          ▲              ▲                 ▲              ▲
          └──────────────┴────────┬────────┴──────────────┘
                                  ▼
                       ┌──────────────────────┐
                       │  Design System       │
                       │  Guardian            │
                       └──────────────────────┘
                                  ▲
                                  │
                       ┌──────────────────────┐
                       │  QA / Docs           │
                       └──────────────────────┘
```

---

## 2. O papel do orquestrador

Responsabilidades:

1. **Ler `CONTEXT.md` + issue vinculado + ADRs relevantes** antes de
   decompor.
2. **Decompor** o pedido em slices tipados por papel (ver seção 3).
3. **Definir contratos** entre slices — o que cada slice recebe e o que
   entrega — antes de despachar. Contratos ficam no corpo do issue.
4. **Despachar em paralelo** os slices independentes; serializar os
   dependentes segundo as regras da seção 5.
5. **Integrar** os resultados: reconciliar tipos, rodar checagem (build
   + tests), abrir issues de dívida se algo ficou pendente.
6. **Fechar o issue** ao final e atualizar `CONTEXT.md` se um termo do
   glossário mudou.

O orquestrador **não escreve código de aplicação diretamente** — ele
delega. Só edita `docs/issue-tracker/*` e coordena.

---

## 3. Os 6 papéis

Cada papel tem: **escopo de arquivos**, **entradas esperadas**,
**saídas garantidas** e **contrato** (o que exige handshake com outro
papel). Um agente que assume um papel **só toca arquivos daquele
escopo**.

### 3.1 Domain Steward
- **Dono de:** `CONTEXT.md`, glossário, fronteiras do domínio.
- **Entrada:** termo novo, ambiguidade de nomenclatura, mudança de
  fronteira.
- **Saída:** entrada atualizada em `CONTEXT.md` (definição, tabela
  associada, sinônimos proibidos).
- **Handshake obrigatório com:** RLS/DB Guardian (se o termo virar
  tabela/coluna), Frontend Slice Engineer (se muda um label de UI).

### 3.2 RLS/DB Guardian
- **Dono de:** `supabase/migrations/*`, políticas RLS, `GRANT`s,
  helpers `SECURITY DEFINER`, `storage` policies.
- **Entrada:** requisito de dados (nova coluna, nova tabela, nova
  regra de acesso).
- **Saída:** migration aprovada com o combo obrigatório
  `CREATE TABLE → GRANT → ENABLE RLS → CREATE POLICY` (ver seção 6).
- **Handshake obrigatório com:** Edge Function Engineer (se a função
  passa a ler/escrever a tabela), QA/Docs (para atualizar
  `docs/architecture.md` seção "Modelo de dados").
- **Nunca** faz `ALTER` em `auth`, `storage`, `realtime`,
  `supabase_functions`, `vault`.

### 3.3 Edge Function Engineer
- **Dono de:** `supabase/functions/*` (exceto `mcp/index.ts`, que é
  auto-gerado a partir de `src/lib/mcp/tools/*`).
- **Entrada:** contrato de request/response documentado em
  `docs/architecture.md`.
- **Saída:** função implementada + testes em `handler.test.ts` quando
  aplicável + entrada correspondente em `docs/architecture.md`
  atualizada (assinatura, side-effects, tabelas tocadas).
- **Handshake obrigatório com:** RLS/DB Guardian (para acessar tabelas
  novas via `service_role`), Frontend Slice Engineer (para o formato
  do payload que a UI vai consumir).

### 3.4 Frontend Slice Engineer
- **Dono de:** UM slice em `src/features/<slice>/` + suas páginas em
  `src/pages/app/*` + hooks/tipos daquele slice. Componentes globais
  em `src/components/app/` só via handshake com Design System Guardian.
- **Entrada:** contrato de dados (types.ts / edge function response) +
  glossário estabilizado.
- **Saída:** UI + hooks TanStack Query + tipos, tudo respeitando
  tokens semânticos e vocabulário do `CONTEXT.md`.
- **Handshake obrigatório com:** Design System Guardian (todo
  componente visual novo), Edge Function Engineer (contrato de dados).

### 3.5 Design System Guardian
- **Dono de:** `src/index.css` (tokens HSL), `tailwind.config.ts`,
  variantes shadcn em `src/components/ui/*`, layout shell em
  `src/components/app/shell/*`.
- **Entrada:** requisito visual (novo token, nova variante, ajuste de
  espaço/tipografia).
- **Saída:** token/variante publicada + uso documentado.
- **Poder de veto:** rejeita PR que use cor hardcoded, gradiente
  genérico de IA, fontes default (Inter/Poppins) sem escolha explícita.

### 3.6 QA / Docs
- **Dono de:** `docs/adr/*`, `docs/issue-tracker/*`,
  `docs/architecture.md`, `src/**/*.test.ts(x)`, `src/test/*`.
- **Entrada:** slice concluído por outro papel.
- **Saída:** testes cobrindo o caminho feliz + 1 borda; issue com
  status atualizado; ADR novo se o slice satisfaz os 3 critérios do
  `docs/adr/README.md`.
- **Handshake obrigatório com:** todos os demais (é o fechamento).

---

## 4. Contratos entre papéis (matriz)

| Mudança | Papel primário | Handshake obrigatório |
| --- | --- | --- |
| Termo novo no glossário | Domain Steward | Frontend (labels) + RLS/DB (se vira tabela) |
| Nova tabela `public.*` | RLS/DB Guardian | QA/Docs (ficha no architecture.md) + Edge Function (se consumida) |
| Nova política RLS | RLS/DB Guardian | QA/Docs (matriz de permissões) |
| Nova edge function | Edge Function Engineer | RLS/DB (grants + policies) + QA/Docs (contrato) + Frontend (consumidor) |
| Novo slice em `src/features/*` | Frontend Slice Engineer | Design System (tokens) + Edge Function (dados) |
| Novo token/variante visual | Design System Guardian | Frontend (adoção) |
| Novo teste / ADR / issue | QA/Docs | — |
| Mudança no bucket `whatsapp-media` | RLS/DB Guardian | Edge Function (uploader) |
| Mudança em `src/lib/mcp/tools/*` | Frontend Slice Engineer (dono do MCP) | QA/Docs (re-extrair manifesto) |
| Novo slice em `src/features/*` (E2E) | Frontend Slice Engineer | **QA/Docs (spec Playwright em `e2e/<slice>/`)** |

---

## 5. Regras de paralelização

**Pode rodar em paralelo:**

- Slices frontend que **não compartilham tabela** (`library/` +
  `today/` + `insights/` OK).
- Uma edge function nova + um slice frontend que **não consome** aquela
  função ainda.
- Domain Steward atualizando glossário + Design System Guardian
  ajustando token — desde que não colidam em um mesmo arquivo.

**Serializa (nunca em paralelo):**

- Qualquer mudança em `messages`, `patients` ou `journey_runs` — são
  hot-tables com muitos consumidores; a colisão de RLS é cara.
- Duas migrations tocando a mesma tabela (o número de sequência da
  migration é ordem lexicográfica).
- Duas mudanças em `src/index.css` ou `tailwind.config.ts`.
- Edição de qualquer arquivo em `supabase/functions/_shared/*` (usado
  por várias funções).
- Mudanças no shell de layout (`AppSidebar`, `AppLayout`,
  `SuperAdminLayout`) — costumam quebrar navegação lateral.

**Regra de conflito:** se dois slices precisam do mesmo arquivo,
quebre o slice em um "prepara" (feito primeiro) + dois "consomem"
(paralelos depois).

---

## 6. Fluxo obrigatório por tarefa

1. **Ler `CONTEXT.md`** — confirmar vocabulário e fronteiras.
2. **Ler o issue correspondente** em `docs/issue-tracker/`. Se não
   existe, **criar antes**.
3. **Ler ADRs relevantes** em `docs/adr/`. Se a tarefa contradiz um
   ADR, **pare e pergunte** — não sobrescreva a decisão em silêncio.
4. **Decompor em slices** e atribuir papéis (orquestrador).
5. **Executar** respeitando os guard-rails abaixo.
6. **Atualizar o issue** ao concluir: `status`, `atualizado_em`,
   critérios de aceitação, notas de decisões.
7. **Atualizar `CONTEXT.md` na mesma tarefa** se afetou o domínio.
8. **Propor ADR** se surgiu decisão difícil de reverter, surpreendente
   sem contexto e resultado de trade-off real.

---

## 7. Como perguntar bem

- **Uma pergunta por vez.**
- **2 a 4 alternativas concretas** com trade-off explícito.
- **Recomende uma opção** com justificativa curta.
- **Não peça detalhes técnicos internos** que o agente consegue inferir
  do código (nomes de arquivo, helpers). Peça decisões de domínio, UX
  e trade-offs.

---

## 8. Idioma

- **Respostas ao usuário e documentação em pt-BR.**
- **Comentários novos de código em pt-BR.**
- **Nomes de símbolos, arquivos e colunas em inglês** (consistência com
  o ecossistema React/Supabase).

---

## 9. Issue-first obrigatório

**Nenhuma mudança de código sem issue vinculada em
`docs/issue-tracker/`.** Convenções: `docs/issue-tracker/README.md`.

---

## 10. Guard-rails de design (poder de veto do Design System Guardian)

- **Tokens semânticos obrigatórios** — cores/sombras/gradientes vêm de
  `src/index.css` (HSL) ou variantes shadcn.
- **Proibido:** `text-white`, `text-black`, `bg-white`, `bg-black`,
  `bg-[#...]`, `text-[#...]`; fontes default de IA (Inter, Poppins) sem
  escolha explícita do usuário; gradientes roxo→azul/índigo padrão.
- **Rejeitar estética genérica.**

---

## 11. Guard-rails de segurança (poder de veto do RLS/DB Guardian)

- Toda `CREATE TABLE public.<x>` acompanhada, **na mesma migration**,
  de:
  1. `GRANT` para `authenticated`/`service_role` (e `anon` **apenas**
     se houver política pública).
  2. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`.
  3. `CREATE POLICY ...` para cada operação permitida.
- **Papéis nunca em `profiles`** — sempre em `user_roles`, checados por
  `has_role()` `SECURITY DEFINER`.
- **Segredos nunca em `VITE_*`** — só no ambiente das edge functions.
- **Storage:** políticas escopadas por bucket + prefixo de instituição
  (`storage.foldername(name)[1] = get_user_institution(...)`).

---

## 12. Arquivos intocáveis (auto-gerados)

**Nunca** editar manualmente:

- `src/integrations/supabase/client.ts`
- `src/integrations/supabase/types.ts`
- `supabase/config.toml`
- Variáveis `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
  `VITE_SUPABASE_PROJECT_ID` em `.env`
- `supabase/functions/mcp/index.ts` (regenerado por
  `@lovable.dev/mcp-js` a partir de `src/lib/mcp/*`)

Se precisar mudar um deles, **pare e pergunte**.

---

## 13. Glossário é lei

- Usar **exatamente** os termos de `CONTEXT.md`.
- Termo novo? Domain Steward atualiza `CONTEXT.md` **na mesma tarefa**.
- "Sinônimo proibido" listado no glossário não aparece em código, UI ou
  docs novas.
