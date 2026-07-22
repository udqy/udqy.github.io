-- Harden the reaction counter.
--
-- Before: anon held blanket INSERT/UPDATE on `reactions`, and the edge function
-- did a read-modify-write. That allowed lost updates under concurrency, let the
-- client dictate the resulting value, and left the table writable by anyone
-- holding the anon key -- bypassing the edge function entirely.
--
-- After: anon can only read. All writes go through bump_reaction(), which is
-- SECURITY DEFINER, applies a fixed +/-1 delta atomically, and clamps at zero.

DROP POLICY IF EXISTS "anon_upsert_reactions" ON reactions;
DROP POLICY IF EXISTS "anon_update_reactions" ON reactions;

CREATE OR REPLACE FUNCTION public.bump_reaction(p_slug TEXT, p_delta INT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
-- Empty search_path + fully-qualified names: standard hardening for SECURITY
-- DEFINER, so a caller-controlled search_path can't shadow `reactions`.
SET search_path = ''
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF p_slug IS NULL OR length(p_slug) = 0 OR length(p_slug) > 100 THEN
    RAISE EXCEPTION 'invalid slug';
  END IF;

  -- Only ever move by one. The client cannot supply an arbitrary magnitude.
  IF p_delta IS NULL OR p_delta NOT IN (-1, 1) THEN
    RAISE EXCEPTION 'invalid delta';
  END IF;

  INSERT INTO public.reactions AS r (slug, count)
  VALUES (p_slug, GREATEST(0, p_delta))
  ON CONFLICT (slug) DO UPDATE
    SET count = GREATEST(0, r.count + p_delta)
  RETURNING r.count INTO v_count;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.bump_reaction(TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bump_reaction(TEXT, INT) TO anon;
