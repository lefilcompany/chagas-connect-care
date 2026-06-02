
-- 1) Add is_default flag
ALTER TABLE public.message_templates
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_message_templates_is_default
  ON public.message_templates(is_default) WHERE is_default = true;

-- 2) Adjust SELECT policy so default templates are visible to every authenticated user
DROP POLICY IF EXISTS "Templates view in institution" ON public.message_templates;
CREATE POLICY "Templates view in institution"
ON public.message_templates
FOR SELECT
TO authenticated
USING (
  is_default = true
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR (institution = public.get_user_institution(auth.uid()))
  OR (created_by = auth.uid())
);

-- 3) Restrict updates/deletes on default templates to admins only
DROP POLICY IF EXISTS "Templates update in institution" ON public.message_templates;
CREATE POLICY "Templates update in institution"
ON public.message_templates
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (
    is_default = false
    AND (
      (institution = public.get_user_institution(auth.uid()))
      OR (created_by = auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "Templates delete owner or admin" ON public.message_templates;
CREATE POLICY "Templates delete owner or admin"
ON public.message_templates
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (is_default = false AND created_by = auth.uid())
);

-- 4) Seed default templates (only if none exist yet)
INSERT INTO public.message_templates
  (name, description, category, body, variables, template_kind, meta_status, meta_language, channel, institution, created_by, is_default, is_active)
SELECT * FROM (VALUES
  (
    'Boas-vindas',
    'Recepciona um novo paciente no acompanhamento.',
    'geral',
    'Olá, {nome_paciente}. Seja bem-vindo(a) ao acompanhamento do ambulatório. Por aqui, você poderá receber orientações, avisos e lembretes importantes para o seu cuidado.',
    '["nome_paciente"]'::jsonb,
    'internal', 'not_submitted', 'pt_BR', 'whatsapp', '', NULL::uuid, true, true
  ),
  (
    'Orientação de saúde',
    'Envia uma orientação educativa ao paciente.',
    'orientacao',
    'Olá, {nome_paciente}. A equipe do ambulatório compartilhou uma orientação para o seu acompanhamento: {orientacao}',
    '["nome_paciente","orientacao"]'::jsonb,
    'internal', 'not_submitted', 'pt_BR', 'whatsapp', '', NULL::uuid, true, true
  ),
  (
    'Lembrete de medicação',
    'Reforça uma orientação relacionada ao uso de medicação.',
    'medicacao',
    'Olá, {nome_paciente}. Este é um lembrete do seu acompanhamento de saúde: {medicacao_orientacao}. Em caso de dúvida, procure sua equipe de saúde.',
    '["nome_paciente","medicacao_orientacao"]'::jsonb,
    'internal', 'not_submitted', 'pt_BR', 'whatsapp', '', NULL::uuid, true, true
  ),
  (
    'Aviso do ambulatório',
    'Envia um aviso importante da equipe de saúde.',
    'geral',
    'Olá, {nome_paciente}. A equipe do ambulatório tem um aviso para você: {aviso}',
    '["nome_paciente","aviso"]'::jsonb,
    'internal', 'not_submitted', 'pt_BR', 'whatsapp', '', NULL::uuid, true, true
  ),
  (
    'Lembrete de consulta',
    'Lembra o paciente sobre consulta, retorno ou acompanhamento.',
    'consulta',
    'Olá, {nome_paciente}. Lembramos que você tem um compromisso relacionado ao seu acompanhamento em {data_consulta}, às {hora_consulta}. Local: {local_consulta}.',
    '["nome_paciente","data_consulta","hora_consulta","local_consulta"]'::jsonb,
    'internal', 'not_submitted', 'pt_BR', 'whatsapp', '', NULL::uuid, true, true
  ),
  (
    'Confirmação de recebimento',
    'Confirma que a mensagem do paciente foi recebida.',
    'geral',
    'Olá, {nome_paciente}. Recebemos sua mensagem. A equipe do ambulatório irá acompanhar sua solicitação.',
    '["nome_paciente"]'::jsonb,
    'internal', 'not_submitted', 'pt_BR', 'whatsapp', '', NULL::uuid, true, true
  ),
  (
    'Alimentação saudável',
    'Envia orientação educativa sobre alimentação.',
    'alimentacao',
    'Olá, {nome_paciente}. Uma alimentação equilibrada pode contribuir com sua rotina de cuidado. Orientação da equipe: {orientacao_alimentacao}',
    '["nome_paciente","orientacao_alimentacao"]'::jsonb,
    'internal', 'not_submitted', 'pt_BR', 'whatsapp', '', NULL::uuid, true, true
  ),
  (
    'Cuidados de rotina',
    'Envia lembretes simples sobre hábitos de cuidado.',
    'orientacao',
    'Olá, {nome_paciente}. Passando para lembrar uma orientação importante para sua rotina de cuidado: {orientacao_rotina}',
    '["nome_paciente","orientacao_rotina"]'::jsonb,
    'internal', 'not_submitted', 'pt_BR', 'whatsapp', '', NULL::uuid, true, true
  ),
  (
    'Mensagem para familiar/cuidador',
    'Envia orientação para familiar ou cuidador vinculado ao paciente.',
    'geral',
    'Olá, {nome_contato}. A equipe do ambulatório compartilhou uma orientação relacionada ao cuidado de {nome_paciente}: {orientacao}',
    '["nome_contato","nome_paciente","orientacao"]'::jsonb,
    'internal', 'not_submitted', 'pt_BR', 'whatsapp', '', NULL::uuid, true, true
  ),
  (
    'Acompanhamento de adesão',
    'Reforça a importância de seguir o acompanhamento.',
    'adesao',
    'Olá, {nome_paciente}. Como está seu acompanhamento esta semana? Lembre-se de seguir as orientações combinadas com a equipe de saúde.',
    '["nome_paciente"]'::jsonb,
    'internal', 'not_submitted', 'pt_BR', 'whatsapp', '', NULL::uuid, true, true
  )
) AS v(name, description, category, body, variables, template_kind, meta_status, meta_language, channel, institution, created_by, is_default, is_active)
WHERE NOT EXISTS (
  SELECT 1 FROM public.message_templates WHERE is_default = true AND name = v.name
);
