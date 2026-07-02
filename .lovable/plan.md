# Fase 1 — Catálogo institucional de modelos (somente leitura)

Fatia vertical: rota `/app/modelos` que lista os modelos da instituição do usuário autenticado, com filtros e ações condicionais, sem criação/edição/submissão.

## Escopo

- Nova rota SPA + item de menu entre "Conteúdos" e "Segmentos".
- Nova página + serviço com resolução de instituição por usuário.
- Reuso máximo de componentes existentes (`TemplateCard`, `WhatsAppPreview`, `META_STATUS_LABEL`).
- Testes RTL comportamentais dirigindo a UI através do serviço substituível.

## Arquivos criados

```text
src/services/institutionTemplates.ts          # InstitutionTemplateService + implementação supabase
src/pages/app/MessageTemplates.tsx            # <MessageTemplatesPage />
src/pages/app/MessageTemplates.test.tsx       # testes comportamentais RTL
```

## Arquivos alterados

- `src/App.tsx` — registrar rota `path="modelos" element={<MessageTemplates />}` dentro de `/app`.
- `src/components/app/AppLayout.tsx` — inserir item de menu "Modelos" (icone `FileText`) entre "Conteúdos" e "Segmentos".
- `src/lib/queries.ts` — adicionar `qk.institutionTemplates(institution)` **e** rota de prefetch `/app/modelos`. Manter `qk.templates` intocado (uso legado).
- `src/pages/app/Content.tsx` — na seção "Objetivos de mensagem" (linha ~544) adicionar link discreto `Ver todos os modelos` → `/app/modelos`. Não remover nada.

Nenhum arquivo é excluído.

## Interface pública do serviço

```ts
// src/services/institutionTemplates.ts
export interface InstitutionTemplateService {
  list(institution: string): Promise<MessageTemplate[]>;
}

export const supabaseInstitutionTemplates: InstitutionTemplateService = { … };

// Contexto React para permitir override em testes sem tocar em React Query.
export const InstitutionTemplateServiceContext =
  React.createContext<InstitutionTemplateService>(supabaseInstitutionTemplates);
export const useInstitutionTemplateService = () => useContext(...);
```

Métodos de criação/edição/submissão ficam para fases seguintes.

## Query key

```ts
qk.institutionTemplates = (institution: string) =>
  ["institution-templates", institution] as const;
```

Sem colisão com `["message-templates"]`.

## Página `/app/modelos`

Estrutura:

1. Cabeçalho: `<h1>Modelos de mensagem</h1>` + parágrafo explicativo.
2. Barra de filtros:
   - `Input` de busca (nome/descrição).
   - `Select` **Tipo**: Todos / Interno / Meta.
   - `Select` **Status**: Todos + os 6 status humanos (`META_STATUS_LABEL`).
   - `Select` **Categoria**: baseado em `TEMPLATE_CATEGORIES`.
3. Grid responsivo de `<TemplateCard variant="catalog" />`.
   - Ajuste mínimo em `TemplateCard`: aceitar prop opcional `variant?: "editor" | "catalog"`. Quando `catalog`, oculta botões `Editar`, `Duplicar`, `Nova versão`; mantém apenas `Usar modelo` e desabilita quando `template_kind === "meta" && meta_status !== "approved"` (interno = sempre permitido).
   - Sem duplicação do componente.
4. Última sincronização exibida em cada card via `template.last_synced_at` (adicionar linha `<time>` no `TemplateCard` quando estiver em modo `catalog`).
5. Badge de divergência já existe (`meta_has_local_differences`).
6. Estado vazio: mensagem "Nenhum modelo encontrado" + sugestão de limpar filtros.
7. Estado de erro: mensagem + `<Button onClick={refetch}>Tentar novamente</Button>`.
8. Rodapé sutil: se usuário for admin, `<p className="text-xs">Em breve: criar e submeter modelos por aqui.</p>` (satisfaz "admin visualiza indicação futura de gerenciamento" sem criar botão sem função).

Consulta: `useQuery({ queryKey: qk.institutionTemplates(institution), queryFn: () => service.list(institution), enabled: !!institution })`. Instituição vem via `select institution from profiles where id = auth.uid()`.

## Ciclo TDD

Modo vertical (um teste → uma implementação → repetir). Cada ciclo roda `npm test -- src/pages/app/MessageTemplates.test.tsx`.

Ordem dos ciclos:

1. **RED1 → GREEN1** — Usuário autenticado vê os nomes dos modelos da própria instituição. Registrar rota, page, service fake, primeira renderização.
2. Busca por nome filtra a lista.
3. Filtro de status oculta modelos fora do status escolhido.
4. Modelo aprovado (Meta) mostra ação "Usar modelo".
5. Modelo Meta não aprovado não expõe ação "Usar modelo" (mostra tooltip/`disabled`).
6. Admin vê o rodapé com indicação futura de gerenciamento; usuário comum não vê.
7. Lista vazia mostra mensagem compreensível.
8. Erro de carregamento mostra "Tentar novamente" e re-chama o serviço.

Cada teste renderiza `<MemoryRouter initialEntries={["/app/modelos"]}>` com `QueryClientProvider` real e `InstitutionTemplateServiceContext.Provider` com implementação in-memory. Auth é substituída por wrapper que monkey-patcha `useAuth` via `vi.mock("@/lib/auth", ...)` — permitido porque é fronteira externa (Supabase), não estado interno do componente.

Assertions apenas por texto visível / `getByRole` / `queryByRole`. Nenhum teste inspeciona hooks, estado, número de chamadas ou estrutura interna.

## Compatibilidade e não-regressão

- Seção "Objetivos de mensagem" de `/app/conteudos` permanece funcional.
- Rota antiga de templates dentro de `/app/mensagens` permanece.
- Sem migrations, sem edge functions novas, sem RLS novas.

## Riscos

- `TemplateCard` já é usado em 2 lugares; adicionar prop `variant` opcional com default `"editor"` mantém retrocompatibilidade.
- Instituição vazia (usuário ainda sem `profiles.institution`) → serviço retorna `[]` e página mostra estado vazio.
- Realtime não é escopo desta fase (dados institucionais são estáveis e `staleTime` já é 5 min).

## Comandos de verificação

```bash
npm test -- src/pages/app/MessageTemplates.test.tsx
npm run lint
npm run build
```

Encerrar após esta fatia. Fase 2 (criação de rascunho + editor) fica para o próximo pedido.
