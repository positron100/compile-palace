import { useEffect, useRef } from "react";
import { debounce, throttle } from "lodash";
import ACTIONS from "../Actions";
import { mapIndexThroughChange } from "../lib/remoteCursorMap";

// Must equal PALETTE_SIZE in the backend server.js and the number of
// --cp-remote-cursor-N tokens in EditorPage.css. The server assigns each room
// member the lowest unused index, so no two members share a color.
export const CURSOR_PALETTE_SIZE = 12;

export interface RemoteParticipant {
  socketId: string;
  username?: string;
  colorIndex?: number;
  cursor?: { line: number; ch: number };
}

interface Widget {
  el: HTMLElement;
  pill: HTMLElement;
  marker: any | null;
  /** Last position the owner (or the server's `joined` list) reported. */
  reported?: { line: number; ch: number };
  /** The reported position didn't fit the document we had at the time (a joiner gets
   *  cursors BEFORE the snapshot), so after the next whole-document apply it must be
   *  re-placed from `reported` rather than mapped from its clamped spot. */
  clamped: boolean;
}

interface Props {
  socketRef: React.MutableRefObject<any>;
  editorRef: React.MutableRefObject<any>;
  ignoreChangeRef: React.MutableRefObject<boolean>;
  roomId: string;
  /** The single authoritative participant list (`joined` payload) — names, colors, first cursor. */
  participants?: RemoteParticipant[];
}

const isCoord = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0;

/**
 * Remote cursors as zero-width CodeMirror bookmarks. A bookmark lives inside the
 * document, so it scrolls with the code and follows local edits on its own; the
 * only thing that destroys it is a whole-document setValue (how peer edits and
 * saved code arrive), which is handled in the beforeChange/change pair below.
 * No React state is touched per cursor movement.
 */
export function useRemoteCursors({ socketRef, editorRef, ignoreChangeRef, roomId, participants }: Props) {
  const participantsRef = useRef(participants);
  participantsRef.current = participants;
  const roomIdRef = useRef(roomId);
  roomIdRef.current = roomId;

  const widgets = useRef(new Map<string, Widget>());
  // Cursor offsets in the OLD document, captured just before a setValue wipes the bookmarks.
  const pending = useRef<{ oldText: string; offsets: Map<string, number>; replace: Map<string, { line: number; ch: number }> } | null>(null);
  const joinedRef = useRef(false);
  const lastSent = useRef("");
  const attached = useRef<{ socket: any; cm: any } | null>(null);
  const detachRef = useRef<(() => void) | null>(null);
  const emitRef = useRef<((force: boolean) => void) | null>(null);

  const styleWidget = (id: string, w: Widget) => {
    const p = participantsRef.current?.find((x) => x.socketId === id);
    w.pill.textContent = p?.username || "Guest";
    const idx = (((p?.colorIndex ?? 0) % CURSOR_PALETTE_SIZE) + CURSOR_PALETTE_SIZE) % CURSOR_PALETTE_SIZE;
    w.el.style.setProperty("--cursor-color", `var(--cp-remote-cursor-${idx})`);
  };

  // Keep the pill inside the editor: flip below near the top, right-align near the right edge.
  const orientPill = (w: Widget) => {
    const cm = editorRef.current;
    if (!cm) return;
    const box = cm.getWrapperElement().getBoundingClientRect();
    const r = w.el.getBoundingClientRect();
    w.el.dataset.flip = r.top - box.top < w.pill.offsetHeight + 12 ? "below" : "above";
    w.el.dataset.align = box.right - r.left < w.pill.offsetWidth + 16 ? "end" : "start";
  };

  const createWidget = (): Widget => {
    const el = document.createElement("span");
    el.className = "cp-remote-cursor";
    const bar = document.createElement("span");
    bar.className = "cp-remote-cursor__bar";
    const pill = document.createElement("span");
    pill.className = "cp-remote-cursor__pill";
    el.append(bar, pill);
    const w: Widget = { el, pill, marker: null, clamped: false };
    el.addEventListener("mouseenter", () => orientPill(w));
    return w;
  };

  // `mapped` = the position was derived locally (diff mapping), not reported by the owner.
  const place = (id: string, pos: { line: number; ch: number }, mapped = false) => {
    const cm = editorRef.current;
    if (!cm) return;
    let w = widgets.current.get(id);
    if (!w) {
      w = createWidget();
      widgets.current.set(id, w);
    }
    w.marker?.clear();
    w.el.style.height = `${cm.defaultTextHeight()}px`;
    styleWidget(id, w);
    const clipped = cm.clipPos({ line: pos.line, ch: pos.ch });
    if (mapped) {
      w.clamped = false;
    } else {
      w.reported = { line: pos.line, ch: pos.ch };
      w.clamped = clipped.line !== pos.line || clipped.ch !== pos.ch;
    }
    w.marker = cm.setBookmark(clipped, { widget: w.el, insertLeft: true });
  };

  const remove = (id: string) => {
    widgets.current.get(id)?.marker?.clear();
    widgets.current.delete(id);
  };

  const clearAll = () => {
    widgets.current.forEach((w) => w.marker?.clear());
    widgets.current.clear();
    pending.current = null;
  };

  // Attach socket + editor listeners once per (socket, editor) pair. The socket
  // is created by the parent's effect, which runs after this component's, so
  // this can't be a one-shot mount effect; it re-checks each render (cheap early return).
  useEffect(() => {
    const socket = socketRef.current;
    const cm = editorRef.current;
    if (!socket || !cm) return;
    if (attached.current?.socket === socket && attached.current?.cm === cm) return;
    detachRef.current?.();
    clearAll();

    const emit = (force: boolean) => {
      const s = socketRef.current;
      const c = editorRef.current;
      if (!s?.connected || !joinedRef.current || !roomIdRef.current || !c) return;
      const { line, ch } = c.getCursor("head");
      const key = `${line}:${ch}`;
      if (!force && key === lastSent.current) return;
      lastSent.current = key;
      s.emit(ACTIONS.CURSOR_CHANGE, { line, ch });
    };
    // Responsive while moving (leading + trailing so the final spot always goes out)…
    const emitSoon = throttle(() => emit(false), 80, { leading: true, trailing: true });
    // …and re-sent just AFTER the debounced (500ms) code-change, so peers that
    // mapped this cursor through the incoming document snapshot get its exact position back.
    const emitAfterDoc = debounce(() => emit(true), 520);

    const onCursor = (data: { socketId?: string; line?: number; ch?: number }) => {
      if (!data?.socketId || data.socketId === socket.id || !isCoord(data.line) || !isCoord(data.ch)) return;
      place(data.socketId, { line: data.line, ch: data.ch });
    };
    const onJoined = (data: { socketId?: string }) => {
      if (data?.socketId !== socket.id) return;
      joinedRef.current = true;
      lastSent.current = "";
      emit(true);
    };
    const onDisconnected = (data: { socketId?: string }) => data?.socketId && remove(data.socketId);
    const onSocketReset = () => {
      joinedRef.current = false;
      lastSent.current = "";
      clearAll();
    };

    const onBeforeChange = (_cm: any, change: any) => {
      if (change.origin !== "setValue" || widgets.current.size === 0) return;
      const offsets = new Map<string, number>();
      const replace = new Map<string, { line: number; ch: number }>();
      widgets.current.forEach((w, id) => {
        // A cursor that was clamped to a too-short document has no meaningful old
        // offset: re-place it from what its owner reported once the new text is in.
        if (w.clamped && w.reported) return void replace.set(id, w.reported);
        const pos = w.marker?.find();
        if (pos) offsets.set(id, cm.indexFromPos(pos));
      });
      pending.current = { oldText: cm.getValue(), offsets, replace };
    };
    const onChange = (_cm: any, change: any) => {
      if (change.origin === "setValue" && pending.current) {
        const { oldText, offsets, replace } = pending.current;
        pending.current = null;
        const newText = cm.getValue();
        cm.operation(() => {
          offsets.forEach((offset, id) =>
            place(id, cm.posFromIndex(mapIndexThroughChange(oldText, newText, offset)), true)
          );
          replace.forEach((pos, id) => place(id, pos));
        });
      }
      // Also after a peer's whole-document apply: useCollaboration restores our
      // caret to its old line/ch, which can be a different spot in the new text,
      // and cursorActivity is suppressed while it does that — so re-announce it.
      if (!ignoreChangeRef.current || change.origin === "setValue") emitAfterDoc();
    };
    const onActivity = () => {
      if (!ignoreChangeRef.current) emitSoon();
    };

    socket.on(ACTIONS.CURSOR_CHANGE, onCursor);
    socket.on(ACTIONS.JOINED, onJoined);
    socket.on(ACTIONS.DISCONNECTED, onDisconnected);
    socket.on("disconnect", onSocketReset);
    socket.on("connect", onSocketReset);
    cm.on("beforeChange", onBeforeChange);
    cm.on("change", onChange);
    cm.on("cursorActivity", onActivity);

    attached.current = { socket, cm };
    detachRef.current = () => {
      socket.off(ACTIONS.CURSOR_CHANGE, onCursor);
      socket.off(ACTIONS.JOINED, onJoined);
      socket.off(ACTIONS.DISCONNECTED, onDisconnected);
      socket.off("disconnect", onSocketReset);
      socket.off("connect", onSocketReset);
      cm.off("beforeChange", onBeforeChange);
      cm.off("change", onChange);
      cm.off("cursorActivity", onActivity);
      emitSoon.cancel();
      emitAfterDoc.cancel();
      attached.current = null;
      detachRef.current = null;
    };
    emitRef.current = emit;
  });

  // Leaving a room (or unmounting) discards every cursor from it. Declared
  // before the reconcile effect below so, on a room change, it clears first
  // and the reconcile then places the new room's cursors.
  useEffect(() => {
    joinedRef.current = false;
    lastSent.current = "";
    clearAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // Reconcile with the authoritative participant list: restyle (renames), place
  // a first-known cursor for new members, drop anyone who is no longer listed.
  useEffect(() => {
    const self = socketRef.current?.id;
    // If our own `joined` arrived before the listeners attached, the list
    // containing us is proof we've joined: announce our cursor now.
    if (self && !joinedRef.current && participants?.some((p) => p.socketId === self)) {
      joinedRef.current = true;
      emitRef.current?.(true);
    }
    const ids = new Set<string>();
    for (const p of participants ?? []) {
      if (!p.socketId || p.socketId === self) continue;
      ids.add(p.socketId);
      const w = widgets.current.get(p.socketId);
      if (w) styleWidget(p.socketId, w);
      else if (p.cursor && isCoord(p.cursor.line) && isCoord(p.cursor.ch)) place(p.socketId, p.cursor);
    }
    for (const id of Array.from(widgets.current.keys())) if (!ids.has(id)) remove(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participants, roomId]);

  useEffect(
    () => () => {
      detachRef.current?.();
      clearAll();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
}
