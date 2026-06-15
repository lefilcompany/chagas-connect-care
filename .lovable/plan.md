## Visão geral

1. **Mensagens** vira **histórico puro** (sem disparo / cadastro). Três visualizações: linha do tempo, por paciente, tabela.
2. **Conteúdos** vira **pastas por tema**. Cada pasta abre mostrando modelos de mensagem + conteúdos educativos daquele tema. Disparo de campanha sai daqui.
3. **Envio direto** (1 paciente, 1+ familiares) sai da **ficha do paciente**, com modelo opcional.
4. Nova segmentação: **"Pacientes específicos"** — escolho N pacientes e marco se quero atingir o paciente, familiares (filtrando por relação), cuidadores, médicos.

---

## Tela "Mensagens" — histórico

Substitui a tela atual.

- Remove "Disparar mensagem", "Novo paciente", aba de Campanhas.
- Cabeçalho "Histórico de mensagens" + filtros já existentes (busca, paciente, canal, status) e chips de filtros ativos.
- **Toggle de visualização** no topo (Tabs):
  - **Linha do tempo** — lista cronológica agrupada por dia (atual).
  - **Por paciente** — agrupado, mostra contagem e última interação; expandir abre as mensagens daquele paciente.
  - **Tabela** — Data | Paciente | Destinatário | Canal | Status | Trecho.
- Diálogo de detalhe da mensagem permanece, mas troca "Reenviar" por "Ver paciente" e "Abrir modelo" (quando originada de template).
- Rota `/app/mensagens/historico` é descontinuada; `/app/mensagens` passa a ser o histórico.

---

## Tela "Conteúdos" — pastas por tema

Duas camadas, mesma rota com `?pasta=<categoria>`.

### Camada 1 — grade de pastas

- Cards grandes por categoria (Medicação, Alimentação, Sono, Atividade, Família, Consulta, Adesão, Orientação, Geral), com ícone, nome e contagem (modelos + conteúdos).
- Busca global no topo (encontra modelos/conteúdos em qualquer pasta).

### Camada 2 — dentro de uma pasta

- Breadcrumb "Conteúdos / Medicação" + voltar.
- Duas seções:
  - **Modelos de mensagem** — cards (`TemplateCard`), ações Usar / Editar / Duplicar. "Usar" abre o `UseTemplateDialog` evoluído (ver abaixo).
  - **Conteúdos educativos** — cards do `content_library`, ações Enviar / Editar.
- Botões "Novo modelo" e "Novo conteúdo" já chegam com a categoria pré-selecionada.

---

## Envio: dois caminhos para o mesmo diálogo

Um único componente `SendMessageDialog` (evolução do atual `UseTemplateDialog`) atende todos os casos. Pontos de entrada:

- **Pastas em Conteúdos** → "Usar modelo" no card (campanha em massa ou direcionada).
- **Ficha do paciente** → botão "Enviar mensagem" (já entra com paciente pré-selecionado e modo "contatos deste paciente").

### Modos de destinatário no diálogo

1. **1 paciente** (envio direto ao paciente).
2. **Familiares/contatos de 1 paciente** — multi-seleção dos contatos do paciente, com filtro por relação. **(novo)**
3. **Pacientes específicos** — escolho N pacientes (busca com chips) + marco quem é alvo: o paciente, familiares (relações), cuidadores, médicos. **(novo)**
4. **Por tipo de público** (familiar/cuidador/etc.) — como hoje.
5. **Segmento salvo / Filtros personalizados** — como hoje.

Modelo de mensagem é **opcional** em todos os modos (pode digitar texto livre). Quando vem da pasta, o modelo já está selecionado.

---

## Mudanças de dados (segmentação)

Sem alteração de schema. Acrescentamos campos opcionais ao tipo de filtros em código:

- `SegmentFilters` ganha:
  - `patient_ids?: string[]` — restringe o universo de pacientes alvo.
  - `relations?: string[]` — para familiar/cuidador, filtra por relação (mãe, pai, cônjuge, cuidador, etc.).
- `TargetingMode` ganha `"specific_patients"`.
- `resolveRecipients` em `src/lib/segments.ts` passa a respeitar esses dois campos.
- Persistido no JSONB `filters` já existente em `audience_segments`, `message_templates`, `message_batches`, `content_library`.

---

## Detalhes técnicos

- **Rotas (`src/App.tsx`)**: remover `/app/mensagens/historico`; `/app/mensagens` renderiza `MessageHistory` renomeado para `Messages`. Manter `/app/conteudos`.
- **Arquivos a tocar**:
  - `src/pages/app/Messages.tsx` — substituir conteúdo pelo de `MessageHistory.tsx` + toggle de 3 vistas.
  - `src/pages/app/MessageHistory.tsx` — remover (ou virar redirect).
  - `src/pages/app/Content.tsx` — refatorar em grade de pastas + visão de pasta (`useSearchParams("pasta")`).
  - `src/pages/app/PatientDetail.tsx` — adicionar botão "Enviar mensagem" que abre `SendMessageDialog` com paciente fixo.
  - `src/components/app/messages/UseTemplateDialog.tsx` → evoluir/renomear para `SendMessageDialog`, com os 5 modos acima e contato multi-select.
  - `src/components/app/SegmentFilters.tsx` — UI para `patient_ids` (busca + chips de pacientes) e `relations` (chips).
  - `src/lib/segments.ts` — novos campos + lógica em `resolveRecipients`.
  - `src/lib/templates.ts` — unificar lista canônica de categorias com as de conteúdo, em `src/lib/content-folders.ts`.
  - `CampaignTab` deixa de ser montado em Mensagens; sua lógica é absorvida por `SendMessageDialog` ou disparada a partir das pastas.
- **AppLayout**: nada muda nos itens do menu.
- **Compatibilidade**: dados antigos continuam funcionando (campos novos opcionais). `normalizeFilters` em `src/lib/queries.ts` ganha defaults `[]` para `patient_ids` e `relations`.

---

## Fora do escopo desta entrega

- Mudanças de schema do banco.
- Exportação CSV do histórico (pode ser uma próxima entrega).
- "Calendário" de envios.
- Notificações/automação de novas mensagens.