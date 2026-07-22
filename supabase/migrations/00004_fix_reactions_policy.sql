-- 00002 assumed the policies named in 00001 were live. They weren't: the remote
-- table had been set up by hand with a single "anon_all" policy granting anon
-- ALL commands, so the DROPs in 00002 were silent no-ops and anon retained
-- INSERT/UPDATE/DELETE on reactions -- including the ability to wipe the table.
--
-- This is what 00002 was supposed to achieve: reads public, every write through
-- bump_reaction().

-- Idempotent, and covers the case where the table was created without RLS --
-- in which case the policies below would never have been consulted at all.
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_all" ON reactions;

DROP POLICY IF EXISTS "anon_read_reactions" ON reactions;
CREATE POLICY "anon_read_reactions" ON reactions
  FOR SELECT TO anon USING (true);

-- Privileges are a separate layer from policies; revoke the write grants that
-- Supabase's default privileges hand to anon on new public tables.
GRANT SELECT ON reactions TO anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON reactions FROM anon;

-- Same treatment for the counter, which 00003 only guarded with a policy.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON site_stats FROM anon;
