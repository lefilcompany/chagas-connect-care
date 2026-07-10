# Testes E2E (Playwright)

Os testes E2E rodam contra o **preview publicado** da Lovable, para
validar a integração real com Lovable Cloud (Supabase, edge functions,
RLS).

## Variáveis de ambiente

| Variável | Onde configurar | Valor |
| --- | --- | --- |
| `PLAYWRIGHT_BASE_URL` | GitHub → Settings → Secrets → Actions | URL do preview publicado, ex.: `https://chagas-connect-care.lovable.app` |
| `TEST_USER_EMAIL` | GitHub → Settings → Secrets → Actions | E-mail de um usuário de teste criado no ambiente Lovable Cloud |
| `TEST_USER_PASSWORD` | GitHub → Settings → Secrets → Actions | Senha desse usuário |

Como criar o usuário de teste: publique o app, acesse `/auth`, use a
aba **Criar conta** com um e-mail dedicado (ex.:
`e2e+ci@sua-instituicao.com`) e vincule-o à instituição/papel mínimo
necessário para as jornadas testadas.

## Rodando localmente

```bash
bun install
bunx playwright install --with-deps chromium

# Contra o preview publicado (mesmo ambiente do CI):
PLAYWRIGHT_BASE_URL="https://chagas-connect-care.lovable.app" \
TEST_USER_EMAIL="e2e+ci@exemplo.com" \
TEST_USER_PASSWORD="..." \
bunx playwright test

# Modo UI interativo:
bunx playwright test --ui
```

## Onde escrever novos specs

Um spec por fluxo, organizado por slice:

```text
e2e/
  smoke.spec.ts
  today/…
  patients/…
  journeys/…
  fixtures/auth.ts
```

A regra de obrigatoriedade está em `AGENTS.md §14` (Definition of Done).