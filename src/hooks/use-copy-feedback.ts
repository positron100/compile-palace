import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Clipboard write plus a timed `copied` flag for the Copy → Copied
 * micro-interaction. `copied` only turns true after the write actually
 * succeeds (no false "Copied"), and `copy` resolves to whether it did, so
 * each caller keeps its own failure handling. A repeat click restarts the one
 * timer instead of stacking a second one, which used to end the newer
 * "Copied" state early.
 */
export function useCopyFeedback(resetMs = 1600) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        return false;
      }
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), resetMs);
      return true;
    },
    [resetMs],
  );

  return { copied, copy };
}
