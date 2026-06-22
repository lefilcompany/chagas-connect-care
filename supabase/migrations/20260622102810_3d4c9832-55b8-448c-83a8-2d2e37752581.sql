
-- Restrict Realtime subscriptions and broadcasts to the user's institution.
DROP POLICY IF EXISTS "Authenticated can read realtime messages" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated can write realtime messages" ON realtime.messages;

CREATE POLICY "Realtime read scoped by institution"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  public.get_user_institution(auth.uid()) <> ''
  AND realtime.topic() LIKE public.get_user_institution(auth.uid()) || ':%'
);

CREATE POLICY "Realtime write scoped by institution"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  public.get_user_institution(auth.uid()) <> ''
  AND realtime.topic() LIKE public.get_user_institution(auth.uid()) || ':%'
);
