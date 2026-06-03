## Objetivo

Simplificar o disparo de campanha removendo a exposição de variáveis técnicas (`{medicacao_orientacao}`, `{medicacao}`, etc.). As medicações devem vir automaticamente dos pacientes cadastrados, e o passo "Revisar" deve mostrar prévias por tipo de público (paciente, familiar, cuidador, médico).

## Comportamento desejado

1. **Variáveis de medicação são automáticas**
   - `{medicacao}` e `{medicacao_orientacao}` deixam de aparecer como campo manual no passo "Revisar".
   - Para cada destinatário, a medicação é buscada da tabela `medications` do paciente vinculado:
     - **Paciente** → medicações do próprio paciente.
     - **Familiar / Cuidador / Médico** → medicações do paciente ao qual o contato está vinculado (mensagem fica do tipo "Lembrete: João está tomando…").

2. **Tratamento de múltiplas medicações**
   - Se o paciente tiver **1 medicação** → preenche direto (`Nome — Dose — Horário`).
   - Se tiver **várias** → lista todas formatadas em linhas separadas (`• Nome — Dose — Horário`).
   - Adicionar um seletor opcional no passo "Revisar": "Como enviar quando houver várias medicações?" com duas opções:
     - **Todas em lista** (padrão)
     - **Apenas a primeira cadastrada**
   - (Escolher uma medicação específica por paciente fica fora do escopo porque cada paciente pode ter um conjunto diferente — listar todas é o comportamento seguro.)

3. **Aviso de pacientes sem medicação cadastrada**
   - Quando o modelo usa variável de medicação e houver destinatários cujo paciente não tem medicação cadastrada, exibir um alerta amarelo no passo "Revisar" listando os nomes desses pacientes, com texto orientando "Cadastre as medicações desses pacientes antes de enviar, ou remova-os no passo Destinatários".
   - Permitir prosseguir mesmo assim (mas a mensagem desses destinatários será pulada para evitar enviar texto com `{medicacao}` em branco).

4. **Prévia por tipo de público no passo "Revisar"**
   - Substituir o card único de WhatsApp por **uma prévia por tipo de público presente nos destinatários selecionados** (Paciente, Familiar, Cuidador, Médico).
   - Cada prévia usa um destinatário real daquele tipo (o primeiro da lista) para mostrar como o nome e as medicações serão renderizados.
   - Se um tipo não tiver destinatários, não aparece.

5. **Esconder também as outras variáveis automáticas**
   - Já é feito para `{nome_destinatario}`. Estender para `{medicacao}` e `{medicacao_orientacao}` no `manualVars` do `CampaignTab`.

## Mudanças técnicas

### `src/lib/templates.ts`
- Adicionar helper `formatMedications(meds, mode: "all" | "first"): string` que devolve string formatada (lista com `•` para várias, ou linha única).
- Remover `medicacao` e `medicacao_orientacao` de `VARIABLE_SUGGESTIONS` (continuam funcionando, só não são sugeridas como input manual).

### `src/lib/whatsapp.ts` — `createBatch`
- Aceitar novo parâmetro opcional `medication_mode: "all" | "first"`.
- Antes de gerar `rows`, fazer **uma** query `supabase.from("medications").select("patient_id, name, dose, schedule").in("patient_id", uniquePatientIds)` e agrupar por `patient_id`.
- Para cada destinatário:
  - Calcular `medText = formatMedications(medsByPatient[r.patient_id] ?? [], medication_mode)`.
  - Injetar em `perVars.medicacao` e `perVars.medicacao_orientacao` se ainda não definidos.
  - Se o template referencia `{medicacao}`/`{medicacao_orientacao}` e a lista estiver vazia, **pular** esse destinatário (não inserir em `messages`) e contabilizar em `skipped`.
- Retornar `skipped_count` e `skipped_names: string[]` no resultado para o toast final.

### `src/components/app/messages/CampaignTab.tsx`
- Expandir `AUTO_RECIPIENT_VARS` para incluir `medicacao` e `medicacao_orientacao` → escondem do bloco "Variáveis".
- Detectar se o body contém variáveis de medicação (`bodyUsesMedication`).
- Quando `bodyUsesMedication`:
  - Buscar medicações dos pacientes finais via `useQuery(["medications-by-patient", patientIds], ...)`.
  - Calcular `patientsWithoutMeds: string[]` e mostrar alerta amarelo no passo Revisar.
  - Mostrar um pequeno seletor "Quando o paciente tiver várias medicações: [Listar todas | Enviar só a primeira]".
- Substituir o card único de `WhatsAppPreview` por um grid de prévias, uma por tipo de público presente em `finalRecipients`. Cada prévia rende o body usando um destinatário-exemplo daquele tipo + suas medicações (ou as do paciente vinculado).
- Passar `medication_mode` para `createBatch`.
- Atualizar toast final para mencionar `skipped_count` quando > 0.

### Banco de dados
- Nenhuma migração necessária. A tabela `medications` já existe com RLS por paciente.

## Telas afetadas

```text
[Passo 4 – Revisar]
┌──────────────────────────────────────────────┐
│ Aviso: 2 pacientes selecionados não têm      │
│ medicação cadastrada (Maria S., João P.).    │
│ Eles serão pulados no envio.                 │
└──────────────────────────────────────────────┘

Quando houver várias medicações:  ( ) Listar todas  (•) Só a primeira

┌─ Resumo ───────────────┐  ┌─ Prévia: Paciente ─────────┐
│ Campanha: ...          │  │ Olá, Ana. Este é um lembrete│
│ Modelo: ...            │  │ ... • Benzonidazol 100mg  │
│ Destinatários: 6       │  │     • Vitamina D 1x/dia   │
│ Pacientes sem med: 2   │  └────────────────────────────┘
└────────────────────────┘  ┌─ Prévia: Familiar ─────────┐
                            │ Olá, Carla. Este é um ...  │
                            │ ... do paciente João: ...  │
                            └────────────────────────────┘
```

## Riscos / observações
- Per-recipient rendering passa a depender de uma query extra de medications — limitada por RLS já existente em `medications` (`can_access_patient`).
- Pacientes sem medicação são silenciosamente pulados quando o template exige medicação — o usuário é avisado antes de confirmar e o toast final relata quantos foram pulados.