CREATE TABLE reactions (
  slug TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read_reactions" ON reactions
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_upsert_reactions" ON reactions
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_update_reactions" ON reactions
  FOR UPDATE TO anon USING (true);
