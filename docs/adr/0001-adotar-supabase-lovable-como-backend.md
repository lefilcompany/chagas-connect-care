---
id: 0001
titulo: Adotar Supabase e Lovable Cloud como backend gerenciado
status: aceito
data: 2026-07-08
decisores: [equipe-do-projeto]
substitui: null
---

## Contexto

A aplicação precisa de autenticação, banco relacional, autorização por linha,
storage, funções de servidor e deploy integrado. O repositório já está
estruturado como SPA React/Vite sem servidor Node dedicado, usando Supabase e
Lovable Cloud.

A decisão é difícil de reverter porque afeta schema, autenticação, migrations,
segredos, integração do frontend, funções e operação.

## Decisão

Adotamos **Supabase/Lovable Cloud** como plataforma de backend gerenciado:

- Postgres como banco transacional;
- Supabase Auth para sessão;
- RLS para isolamento/autorização;
- Storage privado para mídia;
- Edge Functions Deno para integrações, webhooks e processamento;
- Lovable para preview/publicação e gestão integrada do ambiente.

A SPA não terá um backend Node próprio enquanto não houver requisito que
justifique outro container.

## Alternativas consideradas

### Backend Node próprio

- **Prós:** controle total, ecossistema amplo, contratos centralizados.
- **Contras:** infraestrutura, deploy, autenticação, observabilidade e operação
  adicionais; duplicação de capacidades do Supabase.
- **Por que não foi escolhida:** o produto atual já depende profundamente do
  Supabase e não há benefício proporcional comprovado.

### Backend serverless em outro provedor

- **Prós:** flexibilidade e isolamento por função.
- **Contras:** múltiplos fornecedores, duplicação de identidade/dados e maior
  complexidade operacional.
- **Por que não foi escolhida:** aumenta superfície e custo de integração sem
  resolver uma limitação atual demonstrada.

### Backend-as-a-service não relacional

- **Prós:** rapidez inicial e realtime.
- **Contras:** pior aderência às relações, constraints, RLS e consultas do
  domínio.
- **Por que não foi escolhida:** o domínio possui relações e consistência que se
  beneficiam de Postgres.

## Consequências

### Positivas

- menor infraestrutura própria;
- autenticação, banco, storage e functions integrados;
- RLS perto do dado;
- desenvolvimento e preview rápidos;
- migrations e tipos gerados versionados.

### Negativas / trade-offs

- lock-in em APIs e operação Supabase/Lovable;
- service role pode contornar RLS e exige disciplina;
- edge functions Deno diferem do ambiente do frontend;
- limites e observabilidade da plataforma condicionam o produto;
- mudanças de ambiente podem depender da plataforma.

## Guard-rails

- segredos somente em ambiente servidor;
- frontend não recebe service role;
- função com service role valida ator, recurso e instituição antes;
- migrations são fonte de verdade;
- tipos gerados não são editados manualmente;
- saída da plataforma exige ADR substituto e plano de migração.

## Impacto em outros documentos

- `CONTEXT.md`;
- `AGENTS.md`;
- `docs/architecture.md`;
- ADRs 0002 e 0003.