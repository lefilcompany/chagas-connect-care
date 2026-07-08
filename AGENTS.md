# AGENTS — Regras para agentes que trabalham neste repositório

> **Regra-mãe: nunca tome decisões automaticamente.**
>
> Diante de qualquer ambiguidade — escopo, nomenclatura, UX, modelagem
> de dados, migração, política RLS, escolha de biblioteca, tom de UI —
> **pare e faça perguntas objetivas** antes de escrever código. É
> preferível uma pergunta a mais do que uma decisão silenciosa que
> precisará ser desfeita.

Este documento vale para **qualquer** agente (humano ou LLM) que edite
este repositório. Ele não substitui `docs/CONTEXT.md` (domínio) nem
`docs/architecture.md` (arquitetura) — ele orienta *o comportamento* do
agente.

---

## 1. Como perguntar bem

- **Uma pergunta por vez.** Não empilhe cinco perguntas num só bloco.
- **Ofereça alternativas concretas** (2 a 4), cada uma com trade-off
  explícito.
- **Recomende uma opção** com justificativa curta (por que ela se
  encaixa no domínio / no código atual).
- **Não peça ao usuário para escolher detalhes técnicos internos** que
  o próprio agente consegue inferir do código (nomes de arquivo,
  helpers). Peça decisões de domínio, UX e trade-offs.

---

## 2. Fluxo obrigatório de trabalho

Para toda tarefa, nesta ordem:

1. **Ler `docs/CONTEXT.md`** — confirmar vocabulário e fronteiras.
2. **Ler o issue correspondente** em `docs/issue-tracker/`. Se não
   existe, **criar antes** (ver seção 4 — issue-first).
3. **Ler ADRs relevantes** em `docs/adr/`. Se a tarefa contradiz um
   ADR, **pare e pergunte** — não sobrescreva a decisão em silêncio.
4. **Executar a tarefa** respeitando os guard-rails abaixo.
5. **Atualizar o issue** ao concluir: mudar `status`, `atualizado_em`,
   marcar critérios de aceitação, adicionar notas de decisões.
6. **Se afetou o domínio** (termo novo, fronteira redesenhada,
   entidade nova), **atualizar `docs/CONTEXT.md` na mesma tarefa**.
7. **Se surgiu decisão arquitetural** difícil de reverter, surpreendente
   sem contexto e resultado de trade-off real → **propor um ADR novo**
   (ver `docs/adr/README.md`).

---

## 3. Idioma

- **Todas as respostas ao usuário em pt-BR.**
- **Toda a documentação em pt-BR** (CONTEXT, AGENTS, architecture,
  ADRs, issues, READMEs).
- **Comentários novos de código em pt-BR.** Nomes de símbolos, arquivos
  e colunas permanecem em inglês (consistência com o ecossistema).

---

## 4. Issue-first obrigatório

**Nenhuma mudança de código sem issue vinculada em
`docs/issue-tracker/`.**

- Bug reportado? Crie o issue primeiro.
- Pedido informal do usuário? Traduza para um issue antes de codar.
- Refatoração espontânea que você identificou? Idem — vira issue.

Ao concluir, sempre referencie o issue na mensagem final ao usuário
(ex.: "Fechado `docs/issue-tracker/0042-...`").

Convenções completas: `docs/issue-tracker/README.md`.

---

## 5. Guard-rails de design

- **Tokens semânticos obrigatórios** — todas as cores, sombras e
  gradientes vêm de `src/index.css` (HSL) ou de variantes shadcn.
- **Proibido:**
  - `text-white`, `text-black`, `bg-white`, `bg-black`, `bg-[#...]`,
    `text-[#...]` (qualquer classe Tailwind com cor arbitrária).
  - Fontes default de IA (Inter, Poppins) sem escolha explícita do
    usuário.
  - Gradientes roxo→azul/índigo padrão de IA.
- **Rejeitar estética genérica** — uma direção visual distinta por
  projeto, salvo pedido explícito em contrário.

---

## 6. Guard-rails de segurança (Supabase / RLS)

- Toda `CREATE TABLE public.<x>` deve vir acompanhada, **na mesma
  migration**, de:
  1. `GRANT` para os papéis relevantes (`authenticated`, `service_role`,
     e `anon` **apenas** se houver política que autoriza leitura anônima).
  2. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`.
  3. `CREATE POLICY ...` para cada operação permitida.
- **Papéis nunca em `profiles`** — sempre em `user_roles`, checados por
  `has_role()` `SECURITY DEFINER`.
- **Segredos nunca em `VITE_*`** — só no ambiente das edge functions.
- **Storage:** políticas devem escopar por bucket + prefixo de
  instituição (`storage.foldername(name)[1] = get_user_institution(...)`).

---

## 7. Arquivos intocáveis (auto-gerados)

**Nunca** editar manualmente:

- `src/integrations/supabase/client.ts`
- `src/integrations/supabase/types.ts`
- `supabase/config.toml`
- Variáveis `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
  `VITE_SUPABASE_PROJECT_ID` em `.env`

Se precisar de algo que exige mudar um deles, **pare e pergunte** —
quase sempre a mudança correta é em outro lugar.

---

## 8. Glossário é lei

- Usar **exatamente** os termos definidos em `docs/CONTEXT.md`
  (nomes de entidades, estados, kinds de nó, papéis).
- Encontrou um termo novo no discurso do usuário? Antes de codar:
  1. Verifique se ele mapeia para um termo existente.
  2. Se não mapeia, **pergunte** e, ao decidir, **atualize
     `CONTEXT.md`** — na mesma tarefa.
- "Sinônimo proibido" listado no glossário **não** deve aparecer em
  código, UI ou docs novas.
