import { useCallback, useEffect, useState } from "react";
import { listSavedCode, SavedCodeSession } from "@/services/savedCodeService";

export type SavedCodeStatus = "loading" | "loaded" | "empty" | "error";

/**
 * Local list state for the Saved Code / History panel — one instance lives
 * in EditorPage, shared by the Save dialog (addItem on success) and the
 * History section (renameItem/removeItem on their own successful Supabase
 * calls). Local-state updates after each operation (section 12) rather than
 * refetching the whole list every time.
 */
export function useSavedCode(userId: string | undefined) {
  const [items, setItems] = useState<SavedCodeSession[]>([]);
  const [status, setStatus] = useState<SavedCodeStatus>("loading");

  const refresh = useCallback(async () => {
    if (!userId) return;
    setStatus("loading");
    try {
      const data = await listSavedCode(userId);
      setItems(data);
      setStatus(data.length === 0 ? "empty" : "loaded");
    } catch (err) {
      console.error("Error loading saved code history:", err);
      setStatus("error");
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addItem = useCallback((item: SavedCodeSession) => {
    setItems((prev) => [item, ...prev]);
    setStatus("loaded");
  }, []);

  const updateItem = useCallback((id: string, patch: Partial<SavedCodeSession>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.id !== id);
      if (next.length === 0) setStatus("empty");
      return next;
    });
  }, []);

  return { items, status, refresh, addItem, updateItem, removeItem };
}
