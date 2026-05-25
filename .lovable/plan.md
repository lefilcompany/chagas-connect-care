## Tela de Conteúdos — Padronização e edição

Atualizar `src/pages/app/Conteúdos` (`Content.tsx`) para padronizar todos os cards, adicionar filtros, ações de envio e permitir editar.

### 1. Filtros no topo

Acima da grade de conteúdos:
- Campo de busca por título.
- Select **Categoria**: Todos, Medicação, Alimentação, Sono, Atividade física, Família, Geral.
- Select **Público**: Todos, Paciente, Família, Ambos.
- Botão "Limpar filtros" quando algum estiver ativo.

Filtragem feita no cliente sobre `useQuery(qk.content)`.

### 2. Card padronizado

Todos os cards seguem o mesmo layout:
- Cabeçalho: badge da categoria + badge do público.
- Título (truncado em 2 linhas).
- Trecho do corpo (clamp 3 linhas).
- Rodapé com 2 botões padrão em todos:
  - **Enviar** (ícone Send) → abre modal "Enviar conteúdo".
  - **Para quem** já fica embutido dentro do modal de envio (ver passo 3).
- Card inteiro clicável → abre modal de visualização/edição.

### 3. Modal "Enviar conteúdo"

Acionado pelo botão Enviar do card:
- Mostra título + prévia do conteúdo.
- Select **Paciente** (busca em `patients`).
- Após escolher paciente, lista os **contatos** dele (`contacts` filtrados por `patient_id`) com checkboxes — "Para quem enviar" (paciente, familiar, cuidador, médico). Pelo menos um obrigatório.
- Select **Canal**: WhatsApp / SMS (default `channel_pref` do contato).
- Botão "Enviar" insere linhas em `messages` (uma por destinatário) com `body` = corpo do conteúdo, `direction='outbound'`, `status='sent'`, `sent_at=now()`.

### 4. Modal "Ver / editar conteúdo"

Acionado ao clicar no card:
- Mesma estrutura do modal "Novo conteúdo" mas pré-preenchido.
- Campos: Título, Categoria, Público, Conteúdo.
- Validação Zod (título min 2, body min 5).
- Botões: **Salvar** (UPDATE em `content_library`), **Excluir** (DELETE com confirm), **Fechar**.
- Botão Salvar desabilitado até o schema validar.

### 5. Detalhes técnicos

- Reaproveitar `Dialog`, `Select`, `Input`, `Textarea`, `Badge`, `Button` já existentes.
- Estado local: `filters {q, category, audience}`, `sendOpen`, `editOpen`.
- Invalidar `qk.content` após create/update/delete; invalidar `qk.messages` após envio.
- Manter todas as cores via tokens semânticos (sem cores hardcoded).
- Sem mudanças de schema no banco — `content_library`, `patients`, `contacts`, `messages` já cobrem o necessário.

### Arquivos alterados

- `src/pages/app/Content.tsx` — reescrita do componente.
