
-- 1) Add variant columns
ALTER TABLE public.message_templates
  ADD COLUMN IF NOT EXISTS body_patient text,
  ADD COLUMN IF NOT EXISTS body_contact text,
  ADD COLUMN IF NOT EXISTS body_segment text;

-- 2) Wipe existing templates (start fresh as requested)
DELETE FROM public.message_templates;

-- 3) Seed 9 default objetivos with 3 variants each
INSERT INTO public.message_templates
  (name, description, category, body, body_patient, body_contact, body_segment,
   variables, template_kind, channel, targeting_mode, audience_types,
   institution, is_default, is_active, meta_status)
VALUES
(
  'Lembrete de medicação',
  'Lembra paciente/familiar do uso correto da medicação',
  'medicacao',
  'Olá, {nome_destinatario}. Lembrete da medicação: {medicacao}.',
  'Olá, {nome_paciente}. Este é um lembrete da sua medicação: {medicacao}. Não esqueça do horário certinho. Qualquer dúvida, fale com a equipe.',
  'Olá, {nome_contato}. Você acompanha o cuidado de {nome_paciente}. Lembrete da medicação dele(a): {medicacao}. Sua ajuda no horário faz toda a diferença.',
  'Olá, {nome_destinatario}. Lembrete coletivo sobre o uso correto da medicação: {medicacao}. Manter o horário ajuda no tratamento.',
  '["nome_destinatario","nome_paciente","nome_contato","medicacao"]'::jsonb,
  'internal','whatsapp','all','{}','',true,true,'not_submitted'
),
(
  'Lembrete de consulta',
  'Aviso de consulta agendada',
  'consulta',
  'Olá, {nome_destinatario}. Lembramos sua consulta em {data_consulta} às {hora_consulta} em {local_consulta}.',
  'Olá, {nome_paciente}. Lembramos sua consulta em {data_consulta} às {hora_consulta}, em {local_consulta}. Confirme sua presença, por favor.',
  'Olá, {nome_contato}. {nome_paciente} tem consulta marcada em {data_consulta} às {hora_consulta}, em {local_consulta}. Contamos com seu apoio na ida.',
  'Olá, {nome_destinatario}. Esta é uma lembrança sobre a consulta de acompanhamento em {data_consulta} às {hora_consulta} em {local_consulta}.',
  '["nome_destinatario","nome_paciente","nome_contato","data_consulta","hora_consulta","local_consulta"]'::jsonb,
  'internal','whatsapp','all','{}','',true,true,'not_submitted'
),
(
  'Confirmação de recebimento',
  'Confirma que a mensagem do paciente/familiar foi recebida',
  'geral',
  'Olá, {nome_destinatario}. Recebemos sua mensagem e logo retornaremos.',
  'Olá, {nome_paciente}. Recebemos sua mensagem. A equipe do ambulatório vai te responder em breve.',
  'Olá, {nome_contato}. Recebemos sua mensagem sobre {nome_paciente}. Logo retornamos com a equipe responsável.',
  'Olá, {nome_destinatario}. Recebemos suas mensagens. Em caso de urgência, procure o serviço de saúde mais próximo.',
  '["nome_destinatario","nome_paciente","nome_contato"]'::jsonb,
  'internal','whatsapp','all','{}','',true,true,'not_submitted'
),
(
  'Acompanhamento de adesão',
  'Confere como está a aderência ao tratamento',
  'adesao',
  'Olá, {nome_destinatario}. Como está sua adesão ao tratamento?',
  'Olá, {nome_paciente}. Como está seu acompanhamento esta semana? Conseguiu manter os horários da medicação? Nos conte aqui.',
  'Olá, {nome_contato}. Como tem sido a adesão de {nome_paciente} ao tratamento esta semana? Qualquer dificuldade, podemos ajustar juntos.',
  'Olá, {nome_destinatario}. Esta semana queremos saber como está sua adesão ao tratamento. Responda esta mensagem com qualquer dificuldade.',
  '["nome_destinatario","nome_paciente","nome_contato"]'::jsonb,
  'internal','whatsapp','all','{}','',true,true,'not_submitted'
),
(
  'Cuidados de rotina',
  'Orientação geral de cuidados diários',
  'orientacao',
  'Olá, {nome_destinatario}. Orientação: {orientacao_rotina}.',
  'Olá, {nome_paciente}. Uma orientação de rotina para você: {orientacao_rotina}. Pequenos cuidados ajudam muito no tratamento.',
  'Olá, {nome_contato}. Reforce com {nome_paciente} esta orientação de rotina: {orientacao_rotina}. Sua presença faz diferença.',
  'Olá, {nome_destinatario}. Orientação de cuidados para esta semana: {orientacao_rotina}.',
  '["nome_destinatario","nome_paciente","nome_contato","orientacao_rotina"]'::jsonb,
  'internal','whatsapp','all','{}','',true,true,'not_submitted'
),
(
  'Boas-vindas',
  'Mensagem de acolhimento ao novo paciente',
  'geral',
  'Olá, {nome_destinatario}. Seja bem-vindo(a) ao acompanhamento.',
  'Olá, {nome_paciente}. Seja bem-vindo(a) ao acompanhamento do ambulatório. Estamos aqui para te apoiar no tratamento.',
  'Olá, {nome_contato}. {nome_paciente} acaba de iniciar o acompanhamento conosco. Contamos com seu apoio nessa caminhada.',
  'Olá, {nome_destinatario}. Damos as boas-vindas a você no acompanhamento do ambulatório. Conte com a equipe.',
  '["nome_destinatario","nome_paciente","nome_contato"]'::jsonb,
  'internal','whatsapp','all','{}','',true,true,'not_submitted'
),
(
  'Aviso do ambulatório',
  'Comunicado curto da equipe',
  'geral',
  'Olá, {nome_destinatario}. Aviso do ambulatório: {aviso}.',
  'Olá, {nome_paciente}. A equipe do ambulatório tem um aviso para você: {aviso}.',
  'Olá, {nome_contato}. Aviso da equipe sobre o acompanhamento de {nome_paciente}: {aviso}.',
  'Olá, {nome_destinatario}. Comunicado do ambulatório: {aviso}.',
  '["nome_destinatario","nome_paciente","nome_contato","aviso"]'::jsonb,
  'internal','whatsapp','all','{}','',true,true,'not_submitted'
),
(
  'Alimentação saudável',
  'Orientação sobre alimentação',
  'alimentacao',
  'Olá, {nome_destinatario}. Orientação alimentar: {orientacao_alimentacao}.',
  'Olá, {nome_paciente}. Uma alimentação equilibrada ajuda na sua rotina de cuidado. Orientação de hoje: {orientacao_alimentacao}.',
  'Olá, {nome_contato}. Ajude {nome_paciente} a manter uma alimentação equilibrada. Orientação: {orientacao_alimentacao}.',
  'Olá, {nome_destinatario}. Dica de alimentação saudável para esta semana: {orientacao_alimentacao}.',
  '["nome_destinatario","nome_paciente","nome_contato","orientacao_alimentacao"]'::jsonb,
  'internal','whatsapp','all','{}','',true,true,'not_submitted'
),
(
  'Orientação de saúde',
  'Orientação geral de saúde',
  'orientacao',
  'Olá, {nome_destinatario}. Orientação: {orientacao}.',
  'Olá, {nome_paciente}. A equipe do ambulatório compartilhou uma orientação para você: {orientacao}.',
  'Olá, {nome_contato}. Compartilhamos uma orientação de saúde sobre {nome_paciente}: {orientacao}.',
  'Olá, {nome_destinatario}. Orientação de saúde desta semana: {orientacao}.',
  '["nome_destinatario","nome_paciente","nome_contato","orientacao"]'::jsonb,
  'internal','whatsapp','all','{}','',true,true,'not_submitted'
);
