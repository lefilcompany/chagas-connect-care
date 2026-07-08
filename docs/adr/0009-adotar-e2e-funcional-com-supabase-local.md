---
id: 0009
titulo: Adotar E2E funcional com Supabase local
status: aceito
data: 2026-07-08
decisores: [equipe-do-projeto]
substitui: 0008-parcial
issue: 0004
---

## Contexto

O ADR 0008 adotou Playwright com backend sintético para validar rotas e
composição sem segredos. A solução foi útil como baseline, mas não prova que o
produto funciona com Auth, Postgres, RLS, migrations, queries, mutations e Edge
Functions reais.

O requisito atualizado exige testes E2E funcionais. Ao mesmo tempo, usar
produção ou um projeto compartilhado tornaria os testes inseguros, lentos,
flaky e dependentes de estado externo.

## Decisão

Os testes E2E obrigatórios de PR usarão uma instância **Supabase local efêmera**
por job, iniciada pelo Supabase CLI em Docker.

Cada execução deverá:

1. iniciar o stack Supabase local;
2. aplicar todas as migrations reais;
3. criar usuários e fixtures sintéticas por service role local;
4. construir a aplicação com URL e anon key locais;
5. autenticar pelo formulário real;
6. executar queries e mutations reais;
7. validar RLS entre instituições distintas;
8. executar Edge Functions locais que não dependam de provedor externo;
9. destruir o ambiente ao final.

A aplicação não terá mais modo E2E com sessão/papel fake, e o Playwright não
interceptará Auth, REST, Storage ou Functions do Supabase.

## Escopo funcional obrigatório

- login e logout reais;
- sessão persistida real;
- papel e instituição carregados de `profiles`/`user_roles`;
- leitura de dados persistidos;
- mutation persistida e verificada;
- isolamento RLS same-tenant/cross-tenant;
- acesso superadmin real;
- migrations executáveis do zero;
- pelo menos uma Edge Function local sem dependência externa.

## Integrações externas

Meta WhatsApp não será simulada dentro da suíte funcional obrigatória. Testes
reais da Meta exigem WABA, número, templates e credenciais de **sandbox/staging**.
Eles serão executados em workflow separado, protegido por environment e secrets,
sem bloquear PRs de fork quando as credenciais não estiverem disponíveis.

Não declarar sucesso de integração Meta apenas porque o frontend e o banco
funcionaram.

## Alternativas consideradas

### Manter interceptação de rede

- rápido e determinístico;
- não valida backend, RLS ou migrations;
- rejeitado por não atender ao requisito funcional.

### Usar projeto Supabase remoto compartilhado

- próximo do ambiente hospedado;
- sujeito a colisão, custo, dados residuais e indisponibilidade;
- rejeitado como gate obrigatório de todo PR.

### Usar produção

- máxima fidelidade aparente;
- risco inaceitável de alteração de dados e mensagens reais;
- proibido.

### Supabase local efêmero

- valida stack real e migrations com isolamento;
- aumenta tempo e consumo de CI;
- escolhido como melhor equilíbrio de fidelidade, segurança e repetibilidade.

## Consequências

### Positivas

- regressões de migration e RLS passam a ser detectadas;
- login, queries e mutations são realmente exercitados;
- fixtures não contaminam ambientes compartilhados;
- testes são reproduzíveis localmente;
- falhas representam problemas mais próximos do usuário.

### Negativas

- pipeline mais lenta e pesada;
- dependência de Docker e Supabase CLI;
- Edge Functions com integrações externas ainda exigem suíte protegida;
- seed funcional precisa acompanhar mudanças de schema.

## Guard-rails

- somente dados fictícios reservados para testes;
- nunca apontar `VITE_SUPABASE_URL` E2E para produção;
- service role local não pode ser persistida em artefatos;
- logs/traces não podem conter senhas, tokens ou dados reais;
- cada job usa ambiente efêmero e independente;
- cross-tenant deve ser testado negativamente;
- testes Meta usam número e tenant exclusivos de staging;
- falha ao aplicar migration bloqueia o Quality gate.

## Plano de adoção

1. remover `VITE_E2E_MOCK`, sessão fake e interceptação de backend;
2. adicionar scripts de start/status/seed do Supabase local;
3. criar fixtures funcionais;
4. reescrever specs para login e dados reais;
5. adicionar validação de RLS e mutations;
6. adicionar Edge Function local determinística;
7. atualizar workflow e documentação;
8. validar no próprio PR.

## Critério de revisão

Reavaliar se:

- Supabase local divergir materialmente do ambiente hospedado;
- houver staging efêmero oficial por PR;
- tempo de pipeline ultrapassar limite operacional;
- Meta fornecer sandbox automatizável com isolamento suficiente.