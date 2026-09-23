import { useEffect, useRef, useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { Clock3, MoreHorizontal, FolderOpen, Pencil, Trash2, FilePlus, ChevronDown, Check, X } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ModernTooltip } from "@/components/ModernTooltip";
import { SaveCodeDialog } from "./SaveCodeDialog";
import { getCleanLanguageName } from "@/utils/languageUtils";
import { SavedCodeSession, renameSavedCode, deleteSavedCode, normalizeName, DuplicateNameError } from "@/services/savedCodeService";
import { SavedCodeStatus } from "@/hooks/use-saved-code";
import { useLiquidGlass } from "@/hooks/use-liquid-glass";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

// Matches .editor-history__row's own grid-rows transition duration (CSS) —
// the item is removed from the array only once its own exit animation has
// actually finished, so the list's gap-close reads as a consequence of the
// item leaving, not a hard cut.
const EXIT_DURATION_MS = 320;

interface SavedCodeHistoryProps {
  items: SavedCodeSession[];
  status: SavedCodeStatus;
  onRetry: () => void;
  onUpdateItem: (id: string, patch: Partial<SavedCodeSession>) => void;
  onRemoveItem: (id: string) => void;
  onOpenItem: (item: SavedCodeSession) => void;
  /** Section 3 — was "Save Code" here; the top-bar Save Code button is the
   *  real save action now (it knows the active saved-session identity this
   *  list doesn't need to). This starts a fresh, empty, unsaved session. */
  onNewCode: () => void;
  /** The session currently loaded in the editor, if any — used only to
   *  detect "the user just deleted the item that's open right now". */
  currentSavedCodeId: string | null;
  /** Fired after a successful delete of the currently-open session — the
   *  parent clears its own id and runs the existing editor reveal. */
  onActiveSessionDeleted: () => void;
}

// Same magnetic/sheen liquid-glass interaction Leave Room/Sign Out already
// use (useLiquidGlass) — a per-item component since the hook can't be
// called inside items.map() directly.
function SavedCodeItemButton({ item, onOpen }: { item: SavedCodeSession; onOpen: () => void }) {
  const liquid = useLiquidGlass<HTMLButtonElement>({ strength: 3 });
  return (
    <button
      ref={liquid.ref}
      onMouseMove={liquid.onMouseMove}
      onMouseLeave={liquid.onMouseLeave}
      type="button"
      className="cp-liquid cp-lift editor-history__item-main"
      onClick={onOpen}
      title={item.name}
    >
      <span className="editor-history__item-name">{item.name}</span>
      <span className="editor-history__item-meta">
        {getCleanLanguageName(item.language)} · {formatDistanceToNowStrict(new Date(item.updated_at), { addSuffix: true })}
      </span>
    </button>
  );
}

// Section 1 — inline Confirm/Cancel that replaces the item's normal ⋯ menu
// trigger area in place, same liquid-glass pill controls as everywhere
// else, no modal, item never moves/resizes.
function InlineDeleteConfirm({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  const confirmLiquid = useLiquidGlass<HTMLButtonElement>({ strength: 3 });
  const cancelLiquid = useLiquidGlass<HTMLButtonElement>({ strength: 3 });
  return (
    <div className="editor-history__confirm">
      <ModernTooltip content="Confirm Delete">
        <button
          ref={confirmLiquid.ref}
          onMouseMove={confirmLiquid.onMouseMove}
          onMouseLeave={confirmLiquid.onMouseLeave}
          type="button"
          className="cp-liquid editor-history__confirm-btn editor-history__confirm-btn--danger"
          onClick={onConfirm}
          aria-label="Confirm delete"
        >
          <Check size={14} />
        </button>
      </ModernTooltip>
      <ModernTooltip content="Cancel">
        <button
          ref={cancelLiquid.ref}
          onMouseMove={cancelLiquid.onMouseMove}
          onMouseLeave={cancelLiquid.onMouseLeave}
          type="button"
          className="cp-liquid editor-history__confirm-btn"
          onClick={onCancel}
          aria-label="Cancel delete"
        >
          <X size={14} />
        </button>
      </ModernTooltip>
    </div>
  );
}

/**
 * Compact History list inside the Room Info panel (section 5) — not a file
 * browser: fixed-height scroll, one contextual "⋯" menu per item instead of
 * a row of buttons (section 6), same glass/pill language as the rest of the
 * panel. Handles loading/empty/error/loaded (section 11) without ever
 * throwing the parent panel over a failed Supabase call.
 */
export function SavedCodeHistory({
  items,
  status,
  onRetry,
  onUpdateItem,
  onRemoveItem,
  onOpenItem,
  onNewCode,
  currentSavedCodeId,
  onActiveSessionDeleted,
}: SavedCodeHistoryProps) {
  const [renameTarget, setRenameTarget] = useState<SavedCodeSession | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [exitingId, setExitingId] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const reduceMotion = useReducedMotion();

  // Section 1/3 (this round) — new items (addItem prepends, so this is
  // really "id wasn't here last render") must paint collapsed on their
  // very FIRST commit, or there's nothing for the CSS transition to expand
  // FROM. The previous version detected new ids inside a `useEffect`, which
  // only runs AFTER the browser has already painted the new item at its
  // resting (idle/full-height) state — so by the time `enteringIds` got set,
  // the item had already appeared at full size once, and the animation ran
  // backwards/flashed instead of expanding in. Fix: detect the new id
  // synchronously DURING render (React's documented "adjust state while
  // rendering" pattern — calling setState mid-render is safe/supported and
  // makes React redo this render with the new state before anything is
  // committed to the DOM, so the first real paint already shows
  // data-anim="entering" i.e. collapsed). A separate effect (below) only
  // handles flipping entering -> idle a frame later so the collapsed state
  // has actually been painted before the expand transition starts.
  const [enteringIds, setEnteringIds] = useState<Set<string>>(new Set());
  const [seenIds, setSeenIds] = useState<Set<string>>(() => new Set(items.map((i) => i.id)));
  const newlyAddedIds = items.map((i) => i.id).filter((id) => !seenIds.has(id));
  if (newlyAddedIds.length > 0) {
    setSeenIds(new Set(items.map((i) => i.id)));
    setEnteringIds((prev) => new Set([...prev, ...newlyAddedIds]));
  }

  const flippedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const toFlip = [...enteringIds].filter((id) => !flippedRef.current.has(id));
    if (toFlip.length === 0) return;
    toFlip.forEach((id) => flippedRef.current.add(id));
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setEnteringIds((prev) => {
          const next = new Set(prev);
          toFlip.forEach((id) => {
            next.delete(id);
            flippedRef.current.delete(id);
          });
          return next;
        });
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [enteringIds]);

  // Drives the down-arrow's visibility (section 1A) — native scrollbar is
  // hidden via CSS only (.editor-history__list below); this is the actual
  // "is there more below" check, re-run on scroll, on item-list changes
  // (save/delete), and on resize.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const check = () => {
      setCanScrollDown(el.scrollHeight - el.scrollTop - el.clientHeight > 4);
    };
    check();
    el.addEventListener("scroll", check);
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", check);
      ro.disconnect();
    };
  }, [items]);

  const scrollDown = () => {
    const el = listRef.current;
    if (!el) return;
    el.scrollBy({ top: Math.round(el.clientHeight * 0.7), behavior: reduceMotion ? "auto" : "smooth" });
  };

  // Section 7: renaming to the item's OWN current name is fine (excluded
  // via id !== renameTarget.id below); any other saved item's name, same
  // user, normalized (trim + case-insensitive) — rejected inline, dialog
  // stays open. Client-side check first (uses the already-loaded list, no
  // round trip); the DB's own unique index is the backstop for a real race,
  // caught via DuplicateNameError from renameSavedCode itself.
  const handleRename = async (name: string): Promise<string | void> => {
    if (!renameTarget) return;
    const normalized = normalizeName(name);
    const clashes = items.some((i) => i.id !== renameTarget.id && normalizeName(i.name) === normalized);
    if (clashes) return "A saved code with this name already exists.";
    try {
      const updated = await renameSavedCode(renameTarget.id, name);
      onUpdateItem(renameTarget.id, { name: updated.name, updated_at: updated.updated_at });
      toast.success("Renamed");
      // No explicit setRenameTarget(null) here — returning nothing tells
      // SaveCodeDialog to close itself, which fires onOpenChange(false)
      // below, which is what actually clears renameTarget.
    } catch (err) {
      if (err instanceof DuplicateNameError) return err.message;
      console.error("Error renaming saved code:", err);
      toast.error("Could not rename — try again.");
    }
  };

  // Section 1/2/3 choreography: confirm -> item starts exiting (visual) ->
  // real Supabase delete -> if this was the active session, tell the
  // parent so it clears its id and runs the existing editor reveal -> only
  // once the exit animation has actually had time to play, remove the item
  // from the array (closing the list's gap as a result of that, not before
  // it, and not simultaneously with it).
  const handleConfirmDelete = async (item: SavedCodeSession) => {
    setConfirmingId(null);
    setExitingId(item.id);
    try {
      await deleteSavedCode(item.id);
      toast.success("Deleted");
      if (item.id === currentSavedCodeId) onActiveSessionDeleted();
      setTimeout(() => onRemoveItem(item.id), reduceMotion ? 0 : EXIT_DURATION_MS);
    } catch (err) {
      console.error("Error deleting saved code:", err);
      toast.error("Could not delete — try again.");
      setExitingId(null); // failed — item stays, restore its normal state
    }
  };

  return (
    <div className="editor-sidebar__section editor-sidebar__section--history">
      <div className="flex items-center justify-between mb-1">
        <div className="editor-sidebar__label" style={{ marginBottom: 0 }}>
          <Clock3 size={11} className="inline -mt-0.5 mr-1 opacity-70" />
          Saved Code
        </div>
        <ModernTooltip content="New Code">
          <button type="button" className="cp-liquid editor-rail__icon-btn" style={{ height: "1.5rem", width: "1.5rem" }} onClick={onNewCode} aria-label="New code">
            <FilePlus size={13} />
          </button>
        </ModernTooltip>
      </div>

      {status === "loading" && (
        <div className="text-xs opacity-50 italic py-2">Loading…</div>
      )}

      {status === "error" && (
        <div className="text-xs py-2 flex items-center justify-between gap-2">
          <span className="opacity-60">Couldn't load saved code.</span>
          <button type="button" className="cp-liquid editor-history__retry" onClick={onRetry}>
            Retry
          </button>
        </div>
      )}

      {status === "empty" && (
        <div className="text-xs opacity-60 py-2 leading-relaxed">
          No saved code yet. Save your current code to access it here later.
        </div>
      )}

      {status === "loaded" && (
        <div className="editor-history__scroll-region">
          <ul className="editor-history__list" ref={listRef}>
            {items.map((item) => {
              const anim = exitingId === item.id ? "exiting" : enteringIds.has(item.id) ? "entering" : "idle";
              return (
                <li key={item.id} className="editor-history__row" data-anim={anim}>
                  <div className="editor-history__row-inner">
                    <div className="editor-history__item">
                      <SavedCodeItemButton item={item} onOpen={() => onOpenItem(item)} />
                      {confirmingId === item.id ? (
                        <InlineDeleteConfirm
                          onConfirm={() => handleConfirmDelete(item)}
                          onCancel={() => setConfirmingId(null)}
                        />
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button type="button" className="cp-liquid editor-history__item-menu" aria-label={`Actions for ${item.name}`}>
                              <MoreHorizontal size={14} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="cp-glass-dialog cp-glass-dialog--menu">
                            <DropdownMenuItem onClick={() => onOpenItem(item)}>
                              <FolderOpen size={14} className="mr-2" /> Open
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setRenameTarget(item)}>
                              <Pencil size={14} className="mr-2" /> Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setConfirmingId(item.id)} className="text-red-600 focus:text-red-600">
                              <Trash2 size={14} className="mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <ModernTooltip content="Scroll Down" side="top">
            <button
              type="button"
              className="cp-liquid editor-history__scroll-arrow"
              data-visible={canScrollDown}
              onClick={scrollDown}
              aria-hidden={!canScrollDown}
              tabIndex={canScrollDown ? 0 : -1}
              aria-label="Scroll saved code list down"
            >
              <ChevronDown size={13} />
            </button>
          </ModernTooltip>
        </div>
      )}

      <SaveCodeDialog
        open={!!renameTarget}
        onOpenChange={(open) => !open && setRenameTarget(null)}
        title="Rename Saved Code"
        initialName={renameTarget?.name}
        onSubmit={handleRename}
      />
    </div>
  );
}
