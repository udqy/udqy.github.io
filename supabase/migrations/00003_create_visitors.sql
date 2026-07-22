-- Visitor counter.
--
-- Umami Cloud gates its API behind a paid plan, so the displayed number is
-- counted here instead. Deduplication is server-side: a visitor is identified
-- by a salted hash of IP + user agent + the current date, so clearing browser
-- storage doesn't buy another count, and no IP is ever stored. Because the date
-- is inside the hash, yesterday's identifiers can't be correlated with today's.

CREATE TABLE site_stats (
  key   TEXT PRIMARY KEY,
  count BIGINT NOT NULL DEFAULT 0
);

INSERT INTO site_stats (key, count) VALUES ('visitors', 0);

ALTER TABLE site_stats ENABLE ROW LEVEL SECURITY;

-- Reading the total is public; writing only happens via count_visitor() below.
-- An RLS policy alone isn't access -- the table privilege has to exist too, so
-- grant it explicitly rather than leaning on Supabase's default privileges.
CREATE POLICY "anon_read_site_stats" ON site_stats
  FOR SELECT TO anon USING (true);

GRANT SELECT ON site_stats TO anon;

CREATE TABLE visitor_seen (
  hash    TEXT PRIMARY KEY,
  seen_on DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE INDEX visitor_seen_seen_on_idx ON visitor_seen (seen_on);

-- No policies at all: RLS on with zero policies denies every anon operation.
-- The REVOKE is belt-and-braces against Supabase's default grants, so the
-- hashes stay unreadable even if a policy is ever added by mistake.
ALTER TABLE visitor_seen ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON visitor_seen FROM anon;

CREATE FUNCTION public.count_visitor(p_hash TEXT)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count BIGINT;
BEGIN
  -- sha256 hex, so anything else is not something we produced.
  IF p_hash IS NULL OR p_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid hash';
  END IF;

  INSERT INTO public.visitor_seen (hash)
  VALUES (p_hash)
  ON CONFLICT (hash) DO NOTHING;

  -- ON CONFLICT DO NOTHING leaves FOUND false when the row already existed,
  -- which is exactly "this visitor was already counted today".
  IF FOUND THEN
    UPDATE public.site_stats
      SET count = count + 1
      WHERE key = 'visitors'
      RETURNING count INTO v_count;

    -- Opportunistic cleanup: hashes are only useful for the day they encode.
    DELETE FROM public.visitor_seen WHERE seen_on < CURRENT_DATE - 1;
  ELSE
    SELECT count INTO v_count FROM public.site_stats WHERE key = 'visitors';
  END IF;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.count_visitor(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_visitor(TEXT) TO anon;
