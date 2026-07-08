-- O service_role é usado exclusivamente em Edge Functions e rotinas de backend.
-- BYPASSRLS não substitui privilégios SQL: sem GRANT, chamadas administrativas
-- falham com "permission denied" antes mesmo da avaliação de RLS.

GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Mantém o contrato para objetos públicos criados por migrations futuras.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL PRIVILEGES ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL PRIVILEGES ON SEQUENCES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO service_role;

COMMENT ON SCHEMA public IS
  'Schema da aplicação. O papel service_role possui acesso backend e deve permanecer restrito a ambientes confiáveis.';
