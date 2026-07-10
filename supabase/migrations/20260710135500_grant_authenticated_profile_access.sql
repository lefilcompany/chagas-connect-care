-- Usuários autenticados precisam ler o próprio perfil e atualizar os campos
-- permitidos pela aplicação. Os GRANTs habilitam a operação SQL; a autorização
-- por usuário, papel e instituição continua sendo aplicada pelas policies RLS e
-- pelos triggers existentes.

GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT ON TABLE public.user_roles TO authenticated;

COMMENT ON TABLE public.profiles IS
  'Perfis de usuários. Acesso autenticado permanece restrito por RLS e triggers.';
