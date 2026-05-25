## Aplicar segmentação na criação de conteúdo

Hoje o segmento só aparece na hora de enviar. Vamos trazer a segmentação para dentro do cadastro/edição do conteúdo, garantindo que cada peça já nasça direcionada ao público certo — e que o envio respeite isso por padrão, sem erros.

### 1. O que muda no cadastro de conteúdo

No modal "Adicionar / Editar conteúdo" o campo único "Público" vira uma seção **Segmentação**, com 3 opções (rádio):

- **Todos os públicos** (comportamento atual padrão).
- **Tipos de público** — multi-seleção: Pacientes / Familiares / Cuidadores / Médicos (substitui o atual "paciente/familia/cuidador/ambos" com algo mais preciso).
- **Segmento salvo** — select com os segmentos criados em `/app/segmentos`. Mostra nome + contador atual de destinatários. Botão "Criar novo segmento" abre a tela de segmentos em nova aba.
- **Filtros personalizados** — mesmos campos do `SegmentFiltersForm` (etapa, cidade/UF, idade, status, canal, instituição) + escolha dos tipos de público. Útil quando o conteúdo é específico (ex.: "Cuidadores de crônicos em Recife") mas não justifica salvar como segmento.

Abaixo da seleção aparece uma **prévia compacta**: "X destinatários correspondem agora" + lista colapsável (reaproveita `RecipientPreview` em modo somente-leitura, sem checkboxes). Isso valida visualmente o direcionamento antes de salvar.

Validação: se o autor escolher "Filtros personalizados" sem nenhum tipo de público marcado, o salvar fica desabilitado com mensagem clara.

### 2. O que muda no envio

O `SendContentDialog` passa a **pré-carregar** a segmentação do conteúdo:

- Se o conteúdo tem segmento salvo vinculado → abre direto na aba "Segmentado" / "Usar segmento salvo" com ele selecionado.
- Se o conteúdo tem filtros personalizados → abre na aba "Segmentado" / "Montar filtros agora" com os filtros preenchidos.
- Se o conteúdo tem só tipos de público (sem filtros) → abre na aba "Em massa" com esses grupos marcados.
- Se é "Todos" → comportamento atual.

O usuário ainda pode alternar a aba se quiser sobrescrever no envio. A prévia com checkboxes individuais e o "Enviando para N de M" continuam iguais — nada de regressão.

### 3. Lista de conteúdos

Cada card de conteúdo passa a mostrar um chip extra indicando a segmentação aplicada:

- "Todos" (igual hoje), ou
- Lista dos tipos de público (ex.: "Pacientes + Cuidadores"), ou
- "Segmento: Crônicos do Recife", ou
- "Filtros personalizados (N destinatários)".

O filtro de público no topo da página passa a aceitar também "Com segmento salvo" e "Com filtros personalizados" para encontrar rapidamente conteúdos direcionados.

### 4. Banco de dados

Adicionar à tabela `content_library`:

- `targeting_mode text not null default 'all'` — valores: `all`, `audiences`, `segment`, `filters`.
- `audience_types text[] not null default '{}'` — usado quando `targeting_mode` é `audiences` ou `filters`.
- `segment_id uuid` — FK lógica para `audience_segments(id)` (sem FK rígida, igual ao padrão atual do projeto); usado quando `targeting_mode = 'segment'`.
- `filters jsonb not null default '{}'` — usado quando `targeting_mode = 'filters'`.

O campo legado `audience text` é mantido e populado por compatibilidade (ex.: "paciente", "familia", "cuidador", "ambos") — derivado a partir de `audience_types` quando aplicável — para não quebrar telas/relatórios que ainda leem ele.

RLS existente em `content_library` permanece (qualquer autenticado lê; admin gerencia; autenticado insere). Sem mudança de política.

### 5. Resolução de destinatários

Reusamos `resolveRecipients(audience_types, filters)` de `src/lib/segments.ts`. Helper novo `resolveContentTargeting(content)` em `src/lib/segments.ts`:

- `targeting_mode = 'all'` → resolve com `['paciente','familiar','cuidador','medico']` e `emptyFilters()`.
- `audiences` → usa `audience_types` + `emptyFilters()`.
- `segment` → busca o segmento por id e usa seus `audience_types`/`filters`. Se o segmento foi excluído, mostra aviso "Segmento original removido" e cai para "Todos".
- `filters` → usa `audience_types` + `filters` do próprio conteúdo.

### 6. Detalhes técnicos

**Arquivos editados:**
- `supabase/migrations/<novo>.sql` — alter `content_library`.
- `src/lib/segments.ts` — adicionar `resolveContentTargeting`, tipo `ContentTargeting`.
- `src/lib/queries.ts` — fetcher de `content` passa a selecionar as novas colunas; reusa `qk.segments`.
- `src/pages/app/Content.tsx`:
  - `ContentFormDialog` ganha a seção de segmentação com `SegmentFiltersForm` e prévia.
  - `SendContentDialog` lê a segmentação do `item` e pré-configura abas/campos.
  - Cards mostram chip de segmentação; filtro de público amplia opções.
- `src/components/app/RecipientPreview.tsx` — aceitar prop `readOnly` para esconder checkboxes/busca quando usado como preview no cadastro.

**Edge cases tratados:**
- Conteúdo antigo (sem novas colunas) cai em `targeting_mode='all'` via default da migração.
- Segmento salvo apagado depois de vinculado: UI mostra fallback e o envio cai em "Todos" só após confirmação explícita.
- Filtros vazios em modo `filters` = mesmo efeito de "Todos" (sem restrição).
- Validação Zod no form: se `targeting_mode in ('audiences','filters')` então `audience_types.length >= 1`; se `segment` então `segment_id` obrigatório.

### Arquivos criados / editados

- migração: alterar `content_library` (campos novos com defaults seguros)
- editado: `src/lib/segments.ts`
- editado: `src/lib/queries.ts`
- editado: `src/pages/app/Content.tsx`
- editado: `src/components/app/RecipientPreview.tsx`
