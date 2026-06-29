## Próximas fases — Templates Meta WhatsApp

A Fase 1 (erro real da Meta + variáveis posicionais bloqueadas) já está em produção. Proponho dividir o restante das 24 seções em 4 fases entregáveis, cada uma autocontida e testável isoladamente.

---

### Fase 2 — Variáveis semânticas ponta-a-ponta (seções 5, 11, 12, 13)

**O que entrega:** O administrador escreve `{nome_destinatario}` e nunca vê `{{1}}` na interface, mas o que vai para a Meta continua posicional e auditável.

- Novo módulo `src/lib/metaVariables.ts` com:
  - Catálogo de variáveis canônicas (`nome_destinatario`, `data_consulta`, `hora_consulta`, `local_consulta`, `nome_instituicao`, `nome_profissional`, `codigo_otp`, etc.) com `label`, `description`, `example`, `resolver`.
  - `semanticToPositional(text, order)` → converte `{nome}` em `{{1}}` mantendo `order` como array de chaves.
  - `positionalToSemantic(text, order)` → renderiza preview.
  - `extractSemanticKeys(text)` → ordem de aparição.
- `VariableInput.tsx` passa a renderizar `label` humano + `example` + tipo (data/hora/texto/url) baseado no catálogo, em vez do nome cru.
- `UseTemplateDialog.tsx` resolve automaticamente as variáveis derivadas do destinatário (nome, instituição) antes de pedir input.
- `TemplateCard.tsx` e `WhatsAppPreview.tsx` mostram o texto já substituído por exemplos; nunca `{{1}}`.

### Fase 3 — Editor wizard de Template Meta em 8 etapas (seções 3, 6, 9, 14, 15)

**O que entrega:** Substitui `TemplateEditorDialog.tsx` por um wizard que separa objetivo interno × template Meta e impede submissão inválida.

Etapas: (1) Tipo → objetivo interno OU Meta · (2) Identificação (nome técnico, idioma, categoria) · (3) Cabeçalho (none/text/image/video/document + upload) · (4) Corpo + variáveis semânticas · (5) Rodapé (manual ou herdado de `institution_whatsapp_settings`) · (6) Botões (QUICK_REPLY, URL com allowlist, PHONE_NUMBER, COPY_CODE — limite 10/3/3) · (7) Exemplos por variável (obrigatório para submissão à Meta) · (8) Revisão + diff vs versão sincronizada.

Validação por etapa com Zod; botão "Enviar para aprovação" só habilita na etapa 8 quando tudo válido.

### Fase 4 — Sincronização real + versionamento (seções 17, 18, 20)

**O que entrega:** O status da Meta é a fonte de verdade e o admin vê quando o local divergiu do oficial.

- `sync-whatsapp-templates`: paginação completa do Graph (`fields=name,language,status,category,components,quality_score,rejected_reason`), grava `meta_definition`, `meta_status`, `meta_quality_score`, `meta_rejection_reason`, `meta_last_synced_at`.
- Detecção de divergência: gera `meta_has_local_differences=true` quando o corpo/cabeçalho/botões locais diferem do `meta_definition` retornado.
- Versionamento: ao editar um template já APPROVED, cria nova linha com `meta_parent_template_id` apontando para a anterior, em vez de sobrescrever.
- Botão "Sincronizar agora" em `WhatsAppSettings.tsx` aba Templates, com toast de quantos foram atualizados/divergentes/rejeitados.

### Fase 5 — Preview e cards definitivos (seções 7, 21, 22)

**O que entrega:** Card e preview consistentes; o admin vê exatamente o que o paciente recebe.

- `WhatsAppPreview.tsx` redesenhado: balão verde do destinatário, cabeçalho (texto/imagem/vídeo/doc com thumb), corpo com variáveis resolvidas, rodapé, botões (quick reply cinza, URL com ícone externo, phone, copy code), timestamp, check duplo azul.
- `TemplateCard.tsx`: altura uniforme via `grid-rows-[auto_1fr_auto]`, badges de status Meta (APPROVED/PENDING/REJECTED/PAUSED), categoria, idioma, contador de uso nas últimas 24h.
- Filtros: por status, categoria, idioma, "com diferenças locais", "rejeitados".

---

### Notas técnicas

- Sentry: tratar 0/`net::ERR_BLOCKED_BY_CLIENT` como warning silencioso em `src/integrations/sentry.ts` (não considerar falha de envio).
- Todo template é filtrado por `institution` no backend (RLS já cobre, reforçar nos selects do frontend).
- Nenhuma migration destrutiva — apenas `add column if not exists` quando faltar.
- Edge functions afetadas: `create-whatsapp-template`, `sync-whatsapp-templates`, `send-whatsapp` (já tocada na Fase 1).

### Ordem sugerida de execução

1. Fase 2 (base para 3 e 5)
2. Fase 3 (consome Fase 2)
3. Fase 4 (independente, pode ir em paralelo com 3 se necessário)
4. Fase 5 (consome Fases 2 e 4)

Posso começar pela Fase 2 imediatamente após sua aprovação.