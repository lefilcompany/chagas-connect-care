## Objetivo

Padronizar todas as regiões de rolagem do app com scrollbar discreto, arredondado e alinhado aos tokens do design system, mantendo Radix ScrollArea (sem introduzir Base UI ou libs novas) e sem tocar em `package.json`/lockfile.

## Arquivos alterados

**Novos:**
- `src/styles/scrollbars.css` — estilos globais para scroll nativo (Firefox `scrollbar-width/color` + WebKit `::-webkit-scrollbar`) usando tokens `--brand`, `--care`, `--primary`. Remove setas, trilha transparente, thumb arredondado com borda transparente e `background-clip: padding-box`, estados hover/active, `min-height: 40px`.

**Editados:**
- `src/main.tsx` — importar `./styles/scrollbars.css` **após** `./index.css`.
- `src/components/ui/scroll-area.tsx` — refatorar:
  - Root recebe `type="hover"` e `scrollHideDelay={500}` como default (sobrescrevíveis).
  - Viewport com `focus-visible:outline-none` + `focus-visible:ring-2 ring-ring` (evita outline duplicado, mantém acessibilidade).
  - ScrollBar vertical (`w-3`) e horizontal (`h-3`, `flex-col`) renderizados por padrão.
  - Thumb com `bg-brand/40 hover:bg-care/60 active:bg-primary/80`, `rounded-full`, com borda transparente para efeito "inset".
  - Corner transparente.
  - Preservar `forwardRef` e tipagem original; exportar `ScrollArea` e `ScrollBar`.

## Auditoria (leitura, sem refator estrutural fora do escopo)

Passar `rg` por: `overflow-(auto|scroll|y-auto|x-auto|hidden)`, `overflowY`, `overflowX`, `ScrollArea`, `max-h-`, `h-\[calc`, `min-h-0` em `src/`.

Classificar cada match em:
- **A. Já usa `ScrollArea`** → nenhuma mudança (herda novo estilo).
- **B. `overflow-*` nativo** → herda `scrollbars.css` global; verificar apenas se precisa de `min-h-0`/`min-w-0` para funcionar.
- **C. Regiões com bugs de layout conhecidos** → ajustes cirúrgicos abaixo.

## Ajustes cirúrgicos de layout (apenas onde necessário)

- **`src/components/app/AppLayout.tsx`** — garantir que a `<main>` role via documento (sem `overflow-hidden` no shell). Sidebar: `<nav>` já é `overflow-y-auto`; envolver com `min-h-0` no wrapper flex se faltar.
- **`src/components/app/shell/AppSidebar.tsx`** — confirmar `min-h-0` no `<nav>` para permitir shrink em telas baixas; header/rodapé permanecem `shrink-0`.
- **`src/features/inbox/ConversationThread.tsx`** e página `Inbox`/`Conversas` — garantir `min-h-0` nos filhos flex, sem duplicar scrollbars (thread já usa `overflow-y-auto` nativo, herdará estilo).
- **Dialogs longos** (`UseTemplateDialog`, `MetaStatusDialog`, `NewPatientWizard`, `NewFolderDialog`, `RecipientPreview`) — apenas confirmar `max-h-[80vh]` + conteúdo interno rolável; sem restruturação se já correto.
- **Popovers/multi-select** (`PatientMultiSelect`, `SegmentFilters`) — validar `max-h` nas listas; herdam estilo global.
- **Tabelas** (`Patients`, `Messages`, `Reports`) — mantêm `overflow-x-auto` nativo, herdam estilo.

**Não alterar:** primitives `dialog/select/popover/dropdown-menu/command` (Radix já gerencia scroll internamente).

## Regras respeitadas

- Sem novas dependências, sem tocar `package.json`/lockfile.
- Sem `scrollbar-width: none`, sem `display: none` no scrollbar, sem `scroll-behavior: smooth` global.
- Mantém `html { scrollbar-gutter: stable }` já presente em `index.css`.
- Dark mode automático via redefinição de tokens em `.dark`.
- Sem alteração em auth, Supabase, queries, rotas, WhatsApp, templates, campanhas.

## Verificação

- `bunx tsgo --noEmit` para checar tipos.
- Playwright via shell em rotas-chave (`/app/hoje`, `/app/conversas`, `/app/pacientes`, `/app/mensagens`, `/app/modelos`, um dialog longo) — screenshots do scrollbar em claro e escuro, viewport 1280 e 375, para confirmar aparência e ausência de setas/trilha cinza.
- Build automático da plataforma valida lint/compilação.

## Entrega

Relatório final com: arquivos alterados, contagem de regiões auditadas por categoria (A/B/C), lista de ajustes `min-h-0`/`min-w-0` aplicados, screenshots de evidência, e nota sobre limitação conhecida (macOS "always show scrollbars" desabilitado usa comportamento nativo do SO — esperado).
