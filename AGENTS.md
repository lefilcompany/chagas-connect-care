# AGENTS — Regras para agentes neste repositório

> Este documento orienta agentes humanos e LLMs. `CONTEXT.md` define o produto;
> `docs/domain/` define o domínio; `docs/architecture.md` descreve o sistema;
> ADRs registram decisões; issues registram trabalho.

---

## 1. Regra-mãe: autonomia proporcional ao risco

Não tome decisões silenciosas que alterem domínio, segurança, privacidade,
dados persistidos, contratos externos, arquitetura ou comportamento relevante
do usuário.

Ao mesmo tempo, não bloqueie tarefas por detalhes reversíveis que podem ser
inferidos com segurança do código existente.

### Pode decidir autonomamente

Desde que siga padrões existentes e registre a escolha no issue:

- nomes locais de variáveis e helpers;
- organização interna reversível;
- tratamento defensivo de erro sem mudar contrato;
- pequenos ajustes visuais apoiados nos tokens existentes;
- testes adicionais;
- correções inequívocas entre documentação e código;
- refatorações locais sem mudança de comportamento.

### Deve parar e obter decisão humana

- novo conceito de domínio ou mudança de significado;
- coleta, retenção, compartilhamento ou exclusão de dados pessoais/clínicos;
- mudança de base legal, consentimento ou finalidade;
- nova entidade persistida ou migração destrutiva;
- alteração de RLS, GRANT, papel ou fronteira de instituição;
- envio de mensagem sem regra de autorização clara;
- mudança de contrato com Meta ou outro sistema externo;
- alteração de máquina de estados, retry, idempotência ou ordenação crítica;
- dependência nova com impacto de segurança, custo ou lock-in;
- decisão difícil de reverter ou surpreendente sem contexto.

Em tarefa não interativa, registre a lacuna como questão aberta ou ADR proposto
e implemente somente a parte segura e reversível.

---

## 2. Fonte de verdade e leitura mínima

Antes de alterar o repositório:

1. leia `CONTEXT.md`;
2. localize ou crie o issue em `docs/issue-tracker/`;
3. leia os documentos de domínio afetados;
4. leia ADRs relacionados;
5. valide afirmações técnicas no código, migrations e tipos gerados;
6. identifique riscos e critérios de validação.

### Hierarquia quando há divergência

1. migrations/policies aplicadas;
2. tipos gerados do Supabase;
3. código executável e edge functions;
4. ADR aceito;
5. documentação;
6. issue, comentário ou conversa.

Não "corrija" código apenas para fazê-lo coincidir com documentação antiga.
Registre a divergência e determine qual lado está incorreto.

---

## 3. Fluxo obrigatório de trabalho

1. **Issue-first:** localizar ou criar o issue.
2. **Marcar início:** `status: em-andamento`, responsável e data.
3. **Investigar:** ler fontes necessárias e registrar evidências.
4. **Classificar decisões:** reversível, domínio, arquitetura, segurança ou
   privacidade.
5. **Implementar:** menor mudança completa que atenda aos critérios.
6. **Validar:** testes, lint/build quando aplicável, revisão de RLS/tenancy e
   fluxos de falha.
7. **Atualizar documentação:** na mesma entrega, quando domínio, arquitetura,
   operação ou contrato mudar.
8. **Registrar decisão:** ADR quando satisfizer a regra dos três.
9. **Concluir issue:** critérios marcados, validação e riscos residuais.
10. **Referenciar issue e ADRs** na mensagem final e no PR.

Correções puramente tipográficas podem usar issue agregado de documentação,
desde que não escondam mudança de significado.

---

## 4. Como perguntar bem

Quando a decisão humana for necessária:

- agrupe perguntas dependentes em um bloco curto; não faça uma longa sequência
  artificial de uma pergunta por mensagem;
- apresente de duas a quatro alternativas reais;
- explique impacto em domínio, segurança, prazo e reversibilidade;
- recomende uma alternativa;
- diga o que pode avançar sem essa resposta;
- não transfira ao usuário detalhes internos que o código já resolve.

Formato recomendado:

```text
Decisão necessária: ...
Opções: A (...), B (...), C (...)
Recomendação: B, porque ...
Impacto se adiada: ...
```

---

## 5. Linguagem e nomenclatura

- Respostas ao usuário e documentação em **pt-BR**.
- Strings de UI e comentários novos em pt-BR, salvo contrato externo.
- Símbolos, arquivos, tabelas e colunas permanecem em inglês.
- Use termos de `docs/domain/glossary.md`.
- Diferencie **termo de domínio**, **rótulo de UI** e **nome técnico**.
- Não invente tabela ou enum a partir do nome de negócio.

Exemplos atuais:

- domínio: contato da rede de cuidado; tabela: `contacts`;
- domínio: audiência; tabela: `audience_segments`;
- domínio: modelo de mensagem; tabela: `message_templates`;
- UI: Pessoa; entidade persistida: `patients` ou `contacts`, conforme contexto.

---

## 6. Guard-rails de domínio

- Paciente, contato, identidade WhatsApp e usuário autenticado são entidades
  diferentes.
- Jornada e campanha/envio em lote não são sinônimos.
- Capacidade planejada não pode ser apresentada como implementada.
- E-mail não é canal atual enquanto não existir no enum e nos fluxos.
- O produto armazena dados clínicos limitados; não registrar que "não armazena
  dados clínicos".
- Questões abertas não podem virar regra canônica sem decisão.

Mudança de conceito exige atualização de `CONTEXT.md` e documentos de domínio.

---

## 7. Guard-rails de segurança, privacidade e saúde

### Autorização

- Não confiar apenas na UI.
- Validar RLS e autorização no servidor.
- Service role pode contornar RLS; toda edge function que a utiliza precisa
  validar previamente ator, recurso, instituição e finalidade.
- Superadmin não significa acesso irrestrito sem auditoria e necessidade.

### Migrations

Toda `CREATE TABLE public.<x>` deve avaliar e, quando aplicável, incluir na mesma
migration:

1. ownership e `GRANT`;
2. `ENABLE ROW LEVEL SECURITY`;
3. políticas por operação;
4. índices para predicados de RLS e chaves de acesso;
5. estratégia de instituição direta ou transitiva;
6. auditoria, retenção e exclusão;
7. constraints e idempotência.

Não presuma que toda tabela possui `institution`. Algumas dependem de vínculo
transitivo por `patient_id`; isso precisa ser deliberado e testado.

### Dados sensíveis

- Nunca incluir segredo, token, CPF, telefone, mensagem clínica ou payload de
  saúde em log desnecessário.
- Nunca colocar segredo em `VITE_*`.
- Minimizar dados em mensagens, URLs, notificações e analytics.
- Mudança em consentimento, opt-in, opt-out ou finalidade exige revisão de
  `docs/domain/consent-and-privacy.md`.

### WhatsApp

- Resolver destinatário com instituição e identidade.
- Respeitar template aprovado, janela de atendimento, opt-in/finalidade e
  idempotência.
- Webhooks devem ser autenticados/verificados, deduplicados e auditáveis.
- Não enviar com edição local divergente da definição Meta aprovada.

---

## 8. Guard-rails de frontend e design

- Usar tokens semânticos de `src/index.css` e variantes dos componentes.
- Evitar hardcode de cores (`bg-[#...]`, `text-[#...]`) e estética genérica.
- Preservar acessibilidade: foco, teclado, labels, contraste, estados de erro e
  carregamento.
- Não esconder informação clínica essencial apenas por economia visual.
- Não exibir dado sensível em toast, URL, título de página ou preview público.
- Estado de servidor permanece em TanStack Query, salvo ADR que altere isso.

---

## 9. Arquivos auto-gerados ou gerenciados

Nunca editar manualmente:

- `src/integrations/supabase/client.ts`;
- `src/integrations/supabase/types.ts`;
- `supabase/config.toml`;
- variáveis `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` e
  `VITE_SUPABASE_PROJECT_ID`.

Esses arquivos podem ser lidos como evidência. Se estiverem desatualizados, a
correção deve ocorrer no processo gerador ou na plataforma.

---

## 10. Testes e validação mínima

Escolha validações proporcionais à mudança:

- domínio/documentação: conferir nomes contra schema e fluxos;
- frontend: testes de componente, navegação, estados e acessibilidade;
- query/RLS: usuário da mesma instituição, outra instituição, sem papel e
  superadmin;
- edge function: autenticação, autorização, payload inválido, retry,
  idempotência e falha externa;
- jornada: estado inicial, espera, sucesso, falha, retry, handoff e versão;
- WhatsApp: template, texto livre, janela, opt-out, mídia e webhook duplicado.

Não declarar "validado" sem dizer como foi validado.

---

## 11. Quando atualizar cada documento

| Mudança | Documentos mínimos |
| --- | --- |
| Termo ou significado | `CONTEXT.md` + glossário/modelo. |
| Entidade, relação ou estado | modelo + state machines + arquitetura. |
| Consentimento/dado pessoal | consentimento e privacidade + riscos. |
| Decisão estrutural | ADR + arquitetura + issue. |
| Capacidade futura | current-vs-target + issue; não marcar como atual. |
| Novo risco | `docs/risks.md` + issue de mitigação. |
| Nova integração | arquitetura + ADR, quando aplicável. |

---

## 12. Definition of Done

Uma tarefa está concluída quando:

- critérios de aceitação estão atendidos;
- testes/validações relevantes foram executados e registrados;
- não há decisão crítica escondida;
- documentação afetada foi atualizada;
- riscos residuais estão explícitos;
- issue está concluído;
- PR explica estado anterior, mudança, validação e impacto.