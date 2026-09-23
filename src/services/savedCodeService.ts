import { supabase } from '@/integrations/supabase/client';

export interface SavedCodeSession {
  id: string;
  name: string;
  code: string;
  language: string;
  created_at: string;
  updated_at: string;
}

// Reasonable cap on the history panel's own query — this is a compact
// sidebar list, not a file browser (section 17: avoid unbounded queries).
const HISTORY_LIMIT = 20;

// Thrown by createSavedCode/renameSavedCode when the name collides (case/
// whitespace-insensitively) with another saved session already belonging to
// the same user. Callers (the Save/Rename dialogs) catch this specifically
// to show the inline validation message instead of a generic error toast.
export class DuplicateNameError extends Error {
  constructor() {
    super("A saved code with this name already exists.");
    this.name = "DuplicateNameError";
  }
}

export const normalizeName = (name: string): string => name.trim().toLowerCase();

export const listSavedCode = async (userId: string): Promise<SavedCodeSession[]> => {
  const { data, error } = await supabase
    .from('saved_code_sessions')
    .select('id, name, code, language, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(HISTORY_LIMIT);

  if (error) throw error;
  return data ?? [];
};

// Postgres unique-violation — the DB-level backstop (per-user + normalized-
// name partial unique index, see the migration) for the race a client-side-
// only check can't close: two concurrent Save-As-new requests both passing
// the in-memory duplicate check before either has committed.
const isUniqueViolation = (err: unknown): boolean =>
  typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505';

export const createSavedCode = async (
  userId: string,
  name: string,
  code: string,
  language: string
): Promise<SavedCodeSession> => {
  const { data, error } = await supabase
    .from('saved_code_sessions')
    .insert({ user_id: userId, name, code, language })
    .select('id, name, code, language, created_at, updated_at')
    .single();

  if (error) {
    if (isUniqueViolation(error)) throw new DuplicateNameError();
    throw error;
  }
  return data;
};

// Updates an EXISTING saved session's code/language in place (section 4) —
// id/name/user_id untouched, updated_at bumped by the existing trigger.
// Never creates a new row; that's createSavedCode's job.
export const updateSavedCode = async (
  id: string,
  code: string,
  language: string
): Promise<SavedCodeSession> => {
  const { data, error } = await supabase
    .from('saved_code_sessions')
    .update({ code, language })
    .eq('id', id)
    .select('id, name, code, language, created_at, updated_at')
    .single();

  if (error) throw error;
  return data;
};

export const renameSavedCode = async (id: string, name: string): Promise<SavedCodeSession> => {
  const { data, error } = await supabase
    .from('saved_code_sessions')
    .update({ name })
    .eq('id', id)
    .select('id, name, code, language, created_at, updated_at')
    .single();

  if (error) {
    if (isUniqueViolation(error)) throw new DuplicateNameError();
    throw error;
  }
  return data;
};

export const deleteSavedCode = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('saved_code_sessions')
    .delete()
    .eq('id', id);

  if (error) throw error;
};
