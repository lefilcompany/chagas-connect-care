CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- O papel é usado por policies da migration posterior. A inclusão precisa
-- ocorrer em uma transação anterior, pois o PostgreSQL não permite usar um novo
-- valor de enum na mesma transação em que ele foi adicionado.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'superadmin';
