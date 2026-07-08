# CONTEXT — Chagas Digital Care

> Mapa canônico do produto e porta de entrada da documentação. Este arquivo
> explica por que o produto existe, qual é seu domínio, quais afirmações estão
> comprovadas e quais regras governam novas funcionalidades.

Idioma oficial do produto e da documentação: **pt-BR**.

---

## 1. Como interpretar esta documentação

| Marcador | Significado | Fonte de verdade |
| --- | --- | --- |
| **[ATUAL]** | Existe no código, banco ou operação atual. | Código, migrations e tipos gerados. |
| **[DECISÃO]** | Escolha consciente vigente. | ADR aceito. |
| **[ALVO]** | Direção desejada, ainda não necessariamente implementada. | Roadmap, issue ou ADR proposto. |
| **[HIPÓTESE]** | Entendimento ainda não validado. | `docs/domain/open-questions.md`. |

### Hierarquia de evidências

Quando documentos divergirem:

1. migrations e policies aplicadas;
2. `src/integrations/supabase/types.ts`;
3. edge functions e código executável;
4. ADR aceito;
5. documentação de domínio/arquitetura;
6. issues, comentários e conversas.

A divergência deve ser corrigida na mesma tarefa. Não adapte silenciosamente o
código para satisfazer documentação antiga.

---

## 2. Visão do produto

**[ATUAL]** O Chagas Digital Care é uma aplicação multi-instituição para
coordenar comunicação, acompanhamento e ações humanas ao redor da jornada de
cuidado. Combina:

- pacientes e contatos da rede de cuidado;
- mensageria, principalmente WhatsApp;
- caixa de conversas;
- jornadas automatizadas em grafo;
- tarefas humanas;
- audiências e envios em lote;
- biblioteca e modelos de mensagem;
- administração de instituições, usuários, canais e integrações;
- dados clínicos limitados para contexto e adesão.

**[ALVO]** Reduzir perdas de acompanhamento, tornar a comunicação mais segura e
oportuna e orientar a equipe sobre a próxima ação operacional necessária.

### Domínio central

O domínio central é a **coordenação da jornada de cuidado**: transformar estado,
contexto, autorização, eventos e respostas em comunicações e ações humanas
rastreáveis.

Mensageria, templates, audiências e integrações são capacidades de suporte. O
limite dos dados clínicos ainda requer decisão final; ver ADR `0006`.

---

## 3. Atores

| Ator | Objetivo |
| --- | --- |
| **Paciente** | Receber orientação, lembretes e acompanhamento adequados. |
| **Contato da rede de cuidado** | Apoiar o paciente dentro da autorização permitida. |
| **Equipe** | Responder, acompanhar, executar tarefas e operar jornadas. |
| **Admin institucional** | Configurar equipe, instituição, conteúdo e canais. |
| **Superadmin** | Operar plataforma, instituições e integrações com auditoria. |
| **Sistema externo** | Trocar mensagens/eventos por contratos explícitos. |

Usuário autenticado é quem opera a aplicação. Paciente e contato não são
“usuários” do sistema, mesmo quando interagem por WhatsApp/formulário.

---

## 4. Capacidades e estado

| Capacidade | Estado | Observação |
| --- | --- | --- |
| WhatsApp bidirecional | **[ATUAL]** | Envio, webhook, identidade, conversa, janela, mídia e templates. |
| SMS | **[ATUAL parcial]** | Presente no enum; cobertura ponta a ponta ainda deve ser validada. |
| E-mail | **[ALVO]** | Não consta no enum atual. |
| Jornadas | **[ATUAL]** | `journeys`, `journey_runs`, `journey_run_steps`, `journey_tasks`. |
| Audiências | **[ATUAL]** | Nome técnico: `audience_segments`. |
| Envios em lote | **[ATUAL]** | Nome técnico: `message_batches`; distinto de jornada. |
| Biblioteca | **[ATUAL]** | `content_library` e `content_folders`, com tenancy a decidir. |
| Dados clínicos limitados | **[ATUAL]** | `patients`, `medications`, `adherence_events`. |
| CI/CD e testes por funcionalidade | **[ATUAL]** | GitHub Actions, Vitest, cobertura, Playwright e Quality gate. |
| Prontuário completo | **[FORA DO ESCOPO ATUAL]** | Não descrever o sistema como PEP completo. |
| Faturamento/TISS | **[FORA DO ESCOPO]** | Não pertence ao domínio atual. |
| Telemedicina síncrona | **[FORA DO ESCOPO]** | Sem vídeo/consulta como capacidade central. |

---

## 5. Fronteiras do domínio

### O produto é

- plataforma de coordenação e comunicação em saúde;
- sistema operacional para jornadas, mensagens, tarefas e resposta humana;
- repositório do contexto necessário para segmentação e acompanhamento.

### O produto não deve afirmar ser

- prontuário eletrônico completo;
- ferramenta de diagnóstico ou prescrição autônoma;
- ERP hospitalar/faturamento;
- plataforma de teleconsulta síncrona;
- CRM comercial genérico.

### Fronteira clínica real

O produto já armazena dados clínicos estruturados e semiestruturados, como forma
clínica, fase, comorbidades, alergias, medicamentos, medidas e adesão.

Fronteira provisória:

> Armazenamos apenas os dados clínicos necessários para coordenação,
> comunicação e acompanhamento; não substituímos o prontuário longitudinal
> oficial nem suportamos, sem nova decisão, prescrição, laudos, exames ou
> evolução clínica completa.

Essa fronteira é proposta e depende de validação clínica, jurídica e de produto.

---

## 6. Linguagem ubíqua

Glossário completo: `docs/domain/glossary.md`.

- **Paciente:** `patients`.
- **Pessoa:** rótulo de UI; não existe tabela `people`.
- **Contato da rede de cuidado:** `contacts`, vinculado a paciente.
- **Audiência:** `audience_segments`.
- **Modelo de mensagem:** `message_templates`.
- **Template Meta:** modelo sincronizado/submetido à Meta.
- **Conversa WhatsApp:** `whatsapp_conversations`.
- **Identidade WhatsApp:** `whatsapp_identities`.
- **Jornada:** automação durável e versionada.
- **Envio em lote:** `message_batches`; não é sinônimo de jornada.
- **Instituição:** unidade de isolamento e operação.

Termo novo exige atualização do glossário, issue, ADR e testes quando altera o
comportamento.

---

## 7. Invariantes essenciais

1. Nenhuma operação permite acesso cruzado entre instituições sem autorização
   explícita e auditável.
2. RLS/servidor são a barreira de segurança; UI não é autorização.
3. Destinatário WhatsApp é resolvido por identidade e instituição.
4. Mensagem outbound exige instituição, destinatário, canal e autorização.
5. Template enviado corresponde à definição aprovada/sincronizada.
6. Run de jornada é rastreável por versão, passos, tentativas, estado e erro.
7. Revogação bloqueia novos usos incompatíveis; retenção segue política.
8. Dados clínicos não aparecem em logs, URLs ou artifacts além do necessário.
9. Alteração de schema avalia GRANT, RLS, policies, índices, auditoria,
   idempotência, retenção e tenancy.
10. **Nova funcionalidade começa com issue e ADR antes do código.**
11. **Nova funcionalidade termina com unitário e E2E mapeados e Quality gate
    verde.**
12. Fixtures, traces, screenshots e vídeos usam apenas dados sintéticos.

---

## 8. Stack e fontes técnicas

Resumo **[ATUAL]**:

- React 18, TypeScript 5 e Vite 5;
- React Router 6;
- Tailwind CSS 3 e shadcn/ui/Radix;
- TanStack Query 5;
- Supabase/Lovable Cloud: Postgres, Auth, Storage e Edge Functions Deno;
- Meta WhatsApp Cloud API;
- Vitest + Testing Library + cobertura V8;
- Playwright Chromium para E2E;
- GitHub Actions para governança, análise estática, testes, build e artifacts.

### Não editar manualmente

- `src/integrations/supabase/client.ts`;
- `src/integrations/supabase/types.ts`;
- `supabase/config.toml`;
- `VITE_SUPABASE_*` gerenciadas pela plataforma.

Os tipos gerados devem ser lidos como evidência.

---

## 9. Ciclo obrigatório de funcionalidade

### Antes do código

1. issue em `docs/issue-tracker/`;
2. ADR aceito/proposto conforme decisão;
3. entrada em `tests/test-matrix.json`;
4. cenários unitários e E2E definidos.

### Ao finalizar

1. testes unitários das regras/estados;
2. E2E do caminho de usuário/contrato de navegação;
3. lint e TypeScript;
4. cobertura;
5. build;
6. Playwright;
7. Quality gate verde;
8. issue, ADR e docs atualizados.

A CI valida automaticamente a ordem e o mapeamento. Detalhes em
`docs/testing-and-ci.md` e ADR `0008`.

---

## 10. CI/CD e qualidade

Workflow: `.github/workflows/ci-cd.yml`.

Executa em:

- qualquer `pull_request`, sem filtro de branch;
- qualquer `push` na `main`;
- execução manual.

Jobs:

- governança de issue/ADR/test matrix;
- ESLint e TypeScript;
- unitários em matriz por funcionalidade;
- cobertura e thresholds;
- build de produção;
- E2E público, institucional, superadmin e legado;
- Quality gate;
- artifact validado da `main`.

O deploy efetivo continua gerenciado pelo Lovable; o Actions entrega bundle e
manifesto aprovados.

---

## 11. Decisões vigentes

- `0001` — Supabase/Lovable como backend;
- `0002` — isolamento com RLS;
- `0003` — papéis em `user_roles`;
- `0004` — jornadas como grafos versionados;
- `0005` — identidade, conversa, pessoa e mensagem separadas;
- `0007` — issue tracker local;
- `0008` — CI/CD com unitário e E2E por funcionalidade.

ADR proposto:

- `0006` — limite dos dados clínicos.

Um ADR aceito não garante implementação sem dívida; riscos permanecem em
`docs/risks.md`.

---

## 12. Questões abertas prioritárias

1. Vertical de Chagas, plataforma genérica ou núcleo + módulo vertical?
2. Qual conjunto máximo de dados clínicos?
3. Quais bases legais, finalidades e retenções?
4. SMS é operacionalmente completo?
5. `content_library` é global ou institucional?
6. Quais estados são canônicos?
7. Como tratar telefone/identidade duplicados?
8. Quais SLAs governam handoff e tarefas?
9. Quando criar suíte de contrato real com Supabase/Meta em staging?

Perguntas abertas não devem ser resolvidas silenciosamente.

---

## 13. Mapa da documentação

- `AGENTS.md` — comportamento e Definition of Done.
- `docs/domain/` — glossário, modelo, estados, privacidade e perguntas.
- `docs/architecture.md` — arquitetura e fluxos.
- `docs/testing-and-ci.md` — pipeline, testes, matriz e branch protection.
- `tests/test-matrix.json` — vínculo obrigatório entre fonte, unitário e E2E.
- `docs/risks.md` — riscos e controles.
- `docs/adr/` — decisões e alternativas.
- `docs/issue-tracker/` — trabalho rastreável.