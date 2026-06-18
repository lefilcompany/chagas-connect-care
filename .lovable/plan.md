# Cadastro de paciente em etapas

Transformar o diálogo "Novo paciente" em um wizard de 3 etapas, com validação por etapa e novos campos clínicos focados em Doença de Chagas.

## Etapas

**1. Informações pessoais**
- Nome completo*, CPF, data de nascimento
- Telefone*, e-mail
- Endereço (CEP → rua, cidade, estado — já temos o componente `CepAddressFields`)

**2. Informações de saúde**
- Etapa da doença* (diagnóstico, agudo, crônico) — já existe
- Forma clínica de Chagas (indeterminada, cardíaca, digestiva, mista)
- Data do diagnóstico
- Peso (kg), altura (cm), tipo sanguíneo (A+/A-/B+/B-/AB+/AB-/O+/O-/não sabe)
- Comorbidades (texto livre)
- Alergias (texto livre)
- Medicações em uso (texto livre)

**3. Preferências e observações**
- Canal preferido* (WhatsApp/SMS)
- Status (ativo/inativo)
- Observações gerais

## UX

- Barra de progresso no topo: `Pessoais · Saúde · Preferências` (passo atual destacado, anteriores marcados como concluídos).
- Botões `Voltar` / `Próximo` no rodapé; última etapa mostra `Cadastrar paciente`.
- "Próximo" valida apenas os campos da etapa atual (zod por etapa). Erros aparecem inline e o foco vai para o primeiro campo inválido.
- Estado do formulário preservado ao navegar entre etapas (não reseta ao voltar).
- Ao fechar o diálogo, o wizard reseta para a etapa 1.
- Mesmo padrão visual já usado nos diálogos atuais (sem mudanças de design system).

## Mudanças técnicas

**Banco** (migration):
- Adicionar colunas em `public.patients`:
  - `clinical_form text` (valores: `indeterminada` | `cardiaca` | `digestiva` | `mista` | vazio)
  - `diagnosis_date date`
  - `weight_kg numeric(5,2)`
  - `height_cm numeric(5,2)`
  - `blood_type text`
  - `comorbidities text` default `''`
  - `allergies text` default `''`
  - `current_medications text` default `''`
- Todas opcionais (NULL ou default vazio) para não quebrar registros existentes.
- Sem mudança em RLS/policies (herdam as atuais da tabela).

**Frontend** (`src/pages/app/Patients.tsx`):
- Extrair o conteúdo do `Dialog` de cadastro em um novo componente `NewPatientWizard` (`src/components/app/patients/NewPatientWizard.tsx`) para isolar a lógica de etapas e manter `Patients.tsx` legível.
- Schema zod dividido: `personalSchema`, `healthSchema`, `prefsSchema` + `fullSchema` combinado para o submit final.
- Estado único `form` com todos os campos; `step` controla a UI.
- `onCreate` envia o objeto completo para `supabase.from('patients').insert(...)` com os novos campos.
- Mesma invalidação de queries (`patients`, `dashboard`) e toast de sucesso.

**Detalhes de paciente** (`src/pages/app/PatientDetail.tsx`): fora de escopo nesta tarefa — os novos campos ficam disponíveis no banco mas a exibição/edição em "detalhes" pode ser feita em uma etapa seguinte se você quiser.

## Fora de escopo
- Edição dos novos campos via tela de detalhes do paciente.
- Migrar o cadastro de contatos (familiar/cuidador/médico) para wizard — segue como está.
