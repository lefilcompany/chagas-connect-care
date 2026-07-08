---
id: 0002
titulo: Isolar instituições com RLS e vínculo institucional
status: aceito
data: 2026-07-08
decisores: [equipe-do-projeto]
substitui: null
---

## Contexto

O produto atende várias instituições no mesmo backend. Pacientes, contatos,
mensagens, jornadas, templates e configurações não podem vazar entre
instituições. Parte das tabelas possui `institution`; outras são subordinadas a
uma entidade institucional, como `contacts` por `patient_id`.

O isolamento somente no frontend seria insuficiente, e um banco por instituição
aumentaria operação e dificultaria visão de superadmin.

## Decisão

Adotamos banco compartilhado com **Row-Level Security** como barreira principal,
usando quatro estratégias explícitas:

1. instituição direta em tabelas que possuem `institution`;
2. instituição transitiva por pai institucional;
3. recursos globais apenas para superadmin e com auditoria;
4. eventos ainda não resolvidos mantidos em escopo controlado até vinculação.

`get_user_institution`, `has_role`, `is_superadmin` e helpers específicos podem
ser usados em policies, desde que sejam seguros, estáveis e auditados.

## Alternativas consideradas

### Isolamento somente na aplicação

- **Prós:** queries simples.
- **Contras:** qualquer bug ou endpoint pode vazar dados; service role amplia o
  risco.
- **Por que não foi escolhida:** inadequada para dados de saúde e multi-tenant.

### Schema por instituição

- **Prós:** separação lógica forte.
- **Contras:** migrations, queries globais, onboarding e operação mais complexos.
- **Por que não foi escolhida:** custo operacional desproporcional ao estágio
  atual.

### Banco por instituição

- **Prós:** isolamento máximo e ciclo de vida independente.
- **Contras:** alto custo, provisionamento, observabilidade e visão global
  complexos.
- **Por que não foi escolhida:** inviabiliza simplicidade operacional atual.

## Consequências

### Positivas

- autorização perto do dado;
- infraestrutura compartilhada;
- suporte a superadmin controlado;
- queries institucionais simples em tabelas diretas.

### Negativas / trade-offs

- policies transitivas são mais complexas e exigem índices;
- service role contorna RLS;
- `institution` textual pode gerar inconsistência se não houver domínio/chave
  estável;
- tabela nullable/global exige revisão adicional;
- toda migration precisa considerar tenancy.

## Guard-rails

- toda tabela nova declara estratégia de tenancy;
- policies testadas com mesma e outra instituição;
- edge function com service role valida recurso antes de operar;
- transferência de paciente não é simples update de `institution`;
- superadmin não é bypass silencioso;
- FKs e índices sustentam policies transitivas;
- recursos sem instituição explícita entram em auditoria prioritária.

## Dívidas conhecidas

- produzir matriz de policies por tabela;
- validar `content_library`;
- revisar tabelas/eventos com `institution` nullable;
- padronizar identificador de instituição.

## Impacto em outros documentos

- `docs/architecture.md`, seção de tenancy;
- `docs/risks.md`, R-001 e R-016;
- ADR 0003.