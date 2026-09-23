-- Personal saved-code history (a code SNAPSHOT, not execution history).
-- Belongs to the user, not a room, so it can be saved in one room and
-- opened in another. No room_id — no existing room relationship makes
-- sense here per the feature's own intent.
CREATE TABLE public.saved_code_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  language TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Supports the history panel's own query shape: filter by user, order by
-- updated_at DESC, limited.
CREATE INDEX idx_saved_code_sessions_user_updated
  ON public.saved_code_sessions (user_id, updated_at DESC);

ALTER TABLE public.saved_code_sessions ENABLE ROW LEVEL SECURITY;

-- Strictly per-user — unlike rooms/room_participants (collaborative, "anyone
-- can" policies), saved code is personal history: a user must never be able
-- to read, modify, or delete another user's saved code by any means.
CREATE POLICY "Users can view their own saved code"
  ON public.saved_code_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own saved code"
  ON public.saved_code_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own saved code"
  ON public.saved_code_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saved code"
  ON public.saved_code_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- Reuses the existing public.update_updated_at() trigger function (defined
-- for public.rooms in the first migration) rather than duplicating it.
CREATE TRIGGER update_saved_code_sessions_updated_at
  BEFORE UPDATE ON public.saved_code_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
