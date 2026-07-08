---
id: 0004
titulo: Substituir E2E mockado por testes funcionais
status: em-andamento
tipo: feature
prioridade: alta
criado_em: 2026-07-08
atualizado_em: 2026-07-08
responsavel: openai-codex
relacionados: [0003]
adr: 0009
---

## Contexto

A primeira versão da pipeline criou testes Playwright com sessão sintética e
interceptação das APIs Supabase. Esse desenho validava rotas, composição e
exceções JavaScript, mas não exercitava autenticação, migrations, Postgres, RLS,
queries e mutations reais.

O requisito atualizado é que os E2E sejam funcionais: o navegador deve usar uma
instância Supabase local isolada, criada pela CI, com schema real e dados
sintéticos persistidos.

## O que fazer

- Criar ADR substituindo a estratégia E2E mockada.
- Inicializar Supabase CLI/Docker em cada job E2E funcional.
- Aplicar todas as migrations reais do repositório.
- Criar usuários e dados sintéticos por service role somente no ambiente local.
- Executar login real pelo formulário da aplicação.
- Validar leitura e escrita reais no Postgres.
- Validar RLS entre duas instituições.
- Validar rotas e dados de admin institucional e superadmin.
- Validar ao menos uma Edge Function sem dependência externa, quando o contrato
  do projeto permitir execução local determinística.
- Remover sessão fake, interceptação de rede e `VITE_E2E_MOCK`.
- Separar integrações externas Meta em suíte de contrato protegida, pois exigem
  WABA/número/credenciais reais de teste.
- Atualizar CI, matriz de testes, AGENTS, CONTEXT, README e documentação.

## Evidências

- `tests/e2e/fixtures.ts` intercepta REST, Auth, Storage e Functions.
- `src/lib/e2e.ts` cria usuário, sessão, papel e instituição sintéticos.
- `.env.e2e` ativa `VITE_E2E_MOCK=true`.
- O workflow atual não inicia banco local nem aplica migrations.
- O frontend já usa Supabase Auth, PostgREST e RLS, que podem ser exercitados
  localmente com Supabase CLI.

## Critérios de aceitação

- [ ] Nenhum teste E2E obrigatório intercepta endpoints Supabase.
- [ ] Nenhum teste E2E obrigatório usa sessão ou papel fake.
- [ ] CI inicia Supabase local e aplica migrations reais.
- [ ] Seed funcional cria usuários de duas instituições e superadmin.
- [ ] Login real funciona pela UI.
- [ ] Leitura de dados reais aparece nas telas.
- [ ] Ao menos uma mutation real é persistida e verificada.
- [ ] RLS impede leitura cruzada entre instituições.
- [ ] Superadmin acessa escopo transversal real.
- [ ] Relatórios Playwright continuam disponíveis.
- [ ] Testes Meta reais ficam em workflow protegido e não são falsamente
      declarados como cobertos sem credenciais.
- [ ] Quality gate passa no próprio PR.

## Fora de escopo

- Usar produção como ambiente de teste.
- Enviar mensagens para pacientes ou números reais.
- Criar credenciais Meta/WABA automaticamente.
- Tornar integrações externas determinísticas sem sandbox oficial.

## Riscos e impactos

- **Tempo de CI:** subir containers e aplicar migrations aumenta a duração.
- **Migrations:** falhas antes ocultas passam a bloquear o PR.
- **RLS:** policies incorretas podem revelar regressões reais.
- **Docker:** runners precisam de capacidade para o stack Supabase.
- **Integrações externas:** Meta permanece dependente de ambiente protegido.
- **Privacidade:** seeds devem conter apenas dados fictícios e reservados para
  testes.

## Plano de testes

- Login institucional real.
- Login superadmin real.
- Consulta real de pacientes e tarefas.
- Mutation real de dado seguro e verificação posterior.
- Isolamento RLS entre instituição A e B.
- Compatibilidade de redirects após autenticação real.
- Rotas públicas sem backend mockado.
- Edge Function local sem provedor externo.

## Validação

- [ ] Supabase local sobe no GitHub Actions.
- [ ] `supabase db reset` aplica migrations e seed.
- [ ] Playwright passa sem interceptação de backend.
- [ ] Quality gate verde.

## Notas

- “Funcional” não será usado como sinônimo de integração Meta real. Essa
  integração terá suíte separada e protegida com credenciais próprias de teste.