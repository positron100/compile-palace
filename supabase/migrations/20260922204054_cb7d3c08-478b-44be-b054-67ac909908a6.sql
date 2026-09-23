-- Per-user, normalized (trimmed + case-insensitive) uniqueness on saved
-- code names (section 6) — NOT a global unique constraint: user A and user
-- B can both have a session named "My Code", only duplicates WITHIN the
-- same user_id are rejected. Enforced at the DB level (this index) as the
-- backstop for concurrent requests; the app also checks client-side first
-- to show an inline message without a round trip.
CREATE UNIQUE INDEX idx_saved_code_sessions_user_name_unique
  ON public.saved_code_sessions (user_id, lower(btrim(name)));
