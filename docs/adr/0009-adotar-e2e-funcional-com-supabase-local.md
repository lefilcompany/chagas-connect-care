---
id: 0009
titulo: Adotar E2E funcional com Supabase local
status: aceito
data: 2026-07-08
decisores: [equipe-do-projeto]
substitui: null
complementa: 0008
issue: 0004
---

## Contexto

O ADR 0008 adotou Playwright com backend sintético para validar rotas e
composição sem segredos. A solução foi útil como baseline, mas não comprovava
Auth, Postgres, RLS, migrations, queries, mutations e Edge Functions reais.

O requisito atualizado exige testes E2E funcionais. Ao mesmo tempo, usar
produção ou um projeto remoto compartilhado tornaria os testes inseguros,
flaky e dependentes de estado externo.

## Relação com o ADR 0008

Este ADR **complementa** o ADR 0008 e substitui apenas a estratégia de E2E
mockado descrita nele. Governança, análise estática, unitários, cobertura,
build, artifacts e Quality gate continuam vigentes.

## Decisão

Os testes E2E obrigatórios de pull request usarão uma instância **Supabase local
efêmera** por job, iniciada pelo Supabase CLI em Docker.

Cada execução deve:

1. iniciar o stack Supabase local;
2. reconstruir o banco e aplicar todas as migrations reais;
3. criar usuários e fixtures exclusivamente sintéticas;
4. preparar um superadmin real e usar a própria autorização do sistema para
   atribuir instituições às contas de teste;
5. construir a aplicação com URL e anon key locais;
6. autenticar pelo formulário real;
7. executar queries e mutations reais;
8. validar RLS entre instituições distintas;
9. executar Edge Functions locais sem dependência externa;
10. destruir o ambiente ao final.

A aplicação não terá modo obrigatório de E2E com sessão ou papel fake, e o
Playwright não interceptará Auth, REST, Storage ou Functions do Supabase.

## Escopo funcional obrigatório

- login e logout reais;
- sessão persistida real;
- papel e instituição carregados de `profiles` e `user_roles`;
- leitura de dados persistidos;
- mutation persistida e verificada;
- isolamento RLS same-tenant e cross-tenant;
- acesso superadmin real;
- migrations executáveis do zero;
- pelo menos uma Edge Function local determinística.

## Integrações externas

Meta WhatsApp não é considerada coberta por esta suíte. Testes reais da Meta
exigem WABA, número, templates e credenciais exclusivos de sandbox ou staging.
Esses testes devem existir em workflow separado, protegido por environment e
secrets, sem utilizar produção.

## Alternativas consideradas

### Manter interceptação de rede

- mais rápido e determinístico;
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

- regressões de migration e RLS são detectadas antes do merge;
- login, queries e mutations são exercitados de verdade;
- fixtures não contaminam ambientes compartilhados;
- falhas representam problemas próximos do usuário;
- a reconstrução completa do banco passa a ser parte do gate.

### Negativas

- pipeline mais lenta e pesada;
- dependência de Docker e Supabase CLI;
- integrações externas ainda exigem suíte protegida;
- seed e testes precisam acompanhar mudanças de schema.

## Guard-rails

- somente dados fictícios reservados para testes;
- nunca apontar E2E para produção;
- service role local não pode ser persistida em artifacts;
- logs e traces não podem conter senhas, tokens ou dados reais;
- cada job usa ambiente efêmero e independente;
- o trigger de proteção de instituição permanece ativo;
- cross-tenant deve ser testado negativamente;
- falha em migration, seed, RLS ou Edge Function bloqueia o Quality gate.

## Plano de adoção

1. remover sessão fake e interceptação do backend obrigatório;
2. iniciar Supabase local no runner;
3. reconstruir migrations em banco vazio;
4. criar fixtures funcionais;
5. validar login, leitura, mutation, RLS e superadmin;
6. executar Edge Function local determinística;
7. atualizar workflow, matriz e documentação;
8. validar no próprio PR.

## Critério de revisão

Reavaliar se:

- Supabase local divergir materialmente do ambiente hospedado;
- houver staging efêmero oficial por PR;
- o tempo da pipeline ultrapassar o limite operacional acordado;
- a Meta fornecer sandbox automatizável com isolamento suficiente.
