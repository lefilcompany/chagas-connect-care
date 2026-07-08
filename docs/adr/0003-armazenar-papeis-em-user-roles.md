---
id: 0003
titulo: Armazenar papéis autorizativos em user_roles
status: aceito
data: 2026-07-08
decisores: [equipe-do-projeto]
substitui: null
---

## Contexto

O sistema possui usuários autenticados com papéis `superadmin`, `admin` e
`equipe`. `profiles` também possui `role_label`, usado para descrição
profissional. Misturar rótulo de perfil com autorização criaria ambiguidade,
risco de elevação de privilégio e policies difíceis de manter.

## Decisão

Papéis autorizativos ficam exclusivamente em `user_roles`, usando o enum
`app_role`. `profiles.role_label` permanece descritivo e nunca concede acesso.

Checagens no banco utilizam `has_role`/`is_superadmin`; o frontend pode derivar
flags para UX, mas não é fonte de autorização.

## Alternativas consideradas

### Papel em `profiles`

- **Prós:** leitura simples e uma linha por usuário.
- **Contras:** mistura perfil e autorização; dificulta múltiplos papéis; risco de
  update indevido.
- **Por que não foi escolhida:** menos segura e menos expressiva.

### Claims customizadas no JWT como única fonte

- **Prós:** checagem rápida sem query.
- **Contras:** claims podem ficar desatualizadas, exigem refresh e processo
  seguro de emissão.
- **Por que não foi escolhida:** o banco precisa de fonte relacional atualizada
  para RLS.

### Tabela de permissões granulares desde o início

- **Prós:** flexibilidade.
- **Contras:** complexidade prematura, UX e policies mais difíceis.
- **Por que não foi escolhida:** três papéis atuais atendem o modelo conhecido.

## Consequências

### Positivas

- separação clara entre descrição e autorização;
- múltiplos papéis possíveis;
- helpers reutilizáveis em RLS;
- menor risco de elevação por edição do perfil.

### Negativas / trade-offs

- consulta adicional para carregar acesso;
- mudança de papel precisa invalidar cache/sessão quando necessário;
- permissões dentro do mesmo papel ainda são amplas;
- helpers `SECURITY DEFINER` exigem revisão cuidadosa.

## Guard-rails

- nunca autorizar por `role_label`;
- UI não substitui policy;
- alteração de papel exige ator autorizado e auditoria;
- novos papéis exigem revisão de todas as policies e rotas;
- permissionamento granular futuro exige ADR substituto ou complementar.

## Impacto em outros documentos

- `AGENTS.md`;
- `docs/architecture.md`;
- `docs/domain/glossary.md`;
- ADR 0002.