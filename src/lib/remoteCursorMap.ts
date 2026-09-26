/**
 * Where a cursor at `index` in `oldText` ends up in `newText`, for a whole-
 * document replacement (the editor syncs full snapshots, so a peer's edit
 * arrives as setValue and there is no operation to transform through).
 *
 * The change is modelled as the smallest middle region that differs (common
 * prefix / common suffix): a cursor before it stays, a cursor after it shifts
 * by the length delta, a cursor inside it lands at the end of the new region.
 * Intentionally not OT: two edits in one snapshot collapse into one region.
 */
export function mapIndexThroughChange(oldText: string, newText: string, index: number): number {
  const minLen = Math.min(oldText.length, newText.length);
  let prefix = 0;
  while (prefix < minLen && oldText.charCodeAt(prefix) === newText.charCodeAt(prefix)) prefix++;

  let suffix = 0;
  const maxSuffix = minLen - prefix;
  while (
    suffix < maxSuffix &&
    oldText.charCodeAt(oldText.length - 1 - suffix) === newText.charCodeAt(newText.length - 1 - suffix)
  ) {
    suffix++;
  }

  if (index <= prefix) return Math.min(index, newText.length);
  if (index >= oldText.length - suffix) return Math.max(0, Math.min(newText.length, index + newText.length - oldText.length));
  return newText.length - suffix;
}
