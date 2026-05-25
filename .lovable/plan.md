## Segmentação de pacientes, familiares e cuidadores

Vamos permitir que conteúdos sejam enviados para públicos segmentados usando os dados já cadastrados (etapa, cidade/estado, idade, status, canal, instituição, relação).

### 1. Segmentos salvos (audiências reutilizáveis)

Nova tela **Segmentos** (rota `/app/segmentos`, item no menu lateral) onde a equipe cria audiências nomeadas tipo "Crônicos do Recife" ou "Cuidadores ativos via WhatsApp".

Cada segmento tem:
- Nome + descrição curta.
- **Tipo de público:** Pacientes / Familiares / Cuidadores / Médicos (multi-seleção).
- **Filtros** (todos opcionais, combinados por E lógico):
  - Etapa do paciente (diagnóstico, agudo, crônico) — aplica ao paciente ou ao paciente do contato.
  - Cidade (texto livre, busca contém).
  - Estado (UF, 2 letras).
  - Faixa etária: idade mínima / máxima (calculada a partir de `birth_date`).
  - Status: ativo / inativo / todos.
  - Canal: WhatsApp / SMS / todos.
  - Instituição (texto livre, busca contém).
- Contador em tempo real: "X destinatários correspondem agora".
- Lista os nomes que entram no segmento, com paginação.

Botões: **Salvar**, **Excluir**, **Duplicar**.

### 2. Filtros ad-hoc no envio de conteúdo

No modal **Enviar conteúdo** (já existente em `/app/conteudos`), uma terceira aba além de "Em massa" e "Paciente específico":

**Aba "Segmentado"** com dois modos:
- **Usar segmento salvo:** select com os segmentos criados; mostra o nome e o total atual.
- **Montar filtros agora:** mesmos campos do segmento salvo, sem salvar.

Em ambos os casos, antes de confirmar o envio aparece a **prévia completa**: lista de cada destinatário (nome, grupo, telefone, canal) com checkbox para desmarcar individualmente, e o contador "Enviando para N de M".

### 3. Como a segmentação é resolvida

Para cada combinação de filtros, o sistema:
1. Busca pacientes ativos na instituição (RLS já cobre).
2. Para públicos "paciente": aplica os filtros direto na tabela `patients`.
3. Para públicos "familiar/cuidador/médico": junta `contacts` com `patients` e aplica os filtros (etapa vem do paciente; cidade/estado/idade/status/canal podem vir do contato).
4. Resultado é a lista de destinatários da prévia.

Idade é calculada como `date_part('year', age(birth_date))`.

### 4. Envio

Botão "Enviar agora" insere uma linha em `messages` por destinatário (mesmo padrão atual): `body` = corpo do conteúdo, `patient_id`, `contact_id` (quando aplicável), `channel` = canal do destinatário (ou override escolhido), `direction='outbound'`, `status='sent'`, `sent_at=now()`.

Toast de sucesso mostra "Enviado para N destinatários".

### 5. Detalhes técnicos

**Schema novo (migração):**
- Tabela `audience_segments`: `id`, `name`, `description`, `audience_types text[]` (paciente/familiar/cuidador/medico), `filters jsonb` (estrutura: `{stages, city, state, age_min, age_max, status, channel, institution}`), `owner_id`, `institution`, `created_at`, `updated_at`.
- RLS: leitura/escrita pela instituição do usuário (mesmo padrão de `patients`); exclusão pelo dono ou admin.
- Trigger `set_updated_at`.

**Frontend:**
- Novo arquivo `src/pages/app/Segments.tsx` (lista + form lateral/modal).
- Componente compartilhado `src/components/app/SegmentFilters.tsx` (campos de filtro + preview) reusado em Segments.tsx e no modal de envio em `Content.tsx`.
- Componente `src/components/app/RecipientPreview.tsx` (lista com checkboxes, total, busca).
- Query helper `resolveSegment(filters, audienceTypes)` em `src/lib/segments.ts` que retorna `Array<{ kind: 'patient'|'contact', id, patient_id, contact_id?, name, phone, channel, relation? }>`.
- Adicionar `qk.segments` em `src/lib/queries.ts` e fetcher correspondente; prefetch na rota.
- Rota nova em `src/App.tsx` e item no menu (`src/components/app/AppLayout.tsx`).
- Atualizar `SendContentDialog` em `src/pages/app/Content.tsx` com aba "Segmentado" usando os dois componentes acima.

**UX:**
- Filtros vazios = sem filtro (não restringe).
- Estado/UF normalizado em maiúsculas.
- Contador de prévia com debounce de 300ms.
- Tokens semânticos (sem cores hardcoded).
- Validação Zod nos nomes de segmento (min 2, max 80).

### Arquivos alterados / criados

- novo: `src/pages/app/Segments.tsx`
- novo: `src/components/app/SegmentFilters.tsx`
- novo: `src/components/app/RecipientPreview.tsx`
- novo: `src/lib/segments.ts`
- editado: `src/pages/app/Content.tsx` (nova aba no modal de envio)
- editado: `src/App.tsx` (rota)
- editado: `src/components/app/AppLayout.tsx` (item de menu)
- editado: `src/lib/queries.ts` (qk + fetcher + prefetch)
- migração: criar tabela `audience_segments` + RLS + trigger
