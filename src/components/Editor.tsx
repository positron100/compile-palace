
import React, { useRef, useCallback, memo, useEffect, forwardRef, useImperativeHandle } from "react";
import { useEditorSetup } from "../hooks/useEditorSetup";
import { useCollaboration } from "../hooks/useCollaboration";
import { getRoomCode } from "../socket";

interface EditorProps {
  socketRef: React.MutableRefObject<any>;
  roomId: string;
  onCodeChange: (code: string) => void;
  language: {
    id: number;
    name: string;
  };
  username?: string;
  initialCode?: string | null;
}

export interface EditorHandle {
  formatCode: () => void;
  loadCode: (code: string) => void;
  getValue: () => string;
}

const Editor = memo(forwardRef<EditorHandle, EditorProps>(({
  socketRef,
  roomId,
  onCodeChange,
  language,
  username = 'Anonymous',
  initialCode = null
}, ref) => {
  const codeRef = useRef<string>(getRoomCode(roomId) || "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Was `!codeRef.current` (truthy check) below to mean "not yet loaded" —
  // but "" is falsy too, so loadCode("") (New Code, section 3/5) looked
  // identical to "never loaded" and made the initial-sync effect re-fire
  // and stomp the intentional empty editor with stale cached room code the
  // very next time `onCodeChange`'s identity changed (e.g. a language
  // switch bundled into the same reveal). Explicit sentinel, independent of
  // content truthiness, fixes it without touching codeRef's own semantics
  // anywhere else it's read.
  const initializedRef = useRef(false);

  // Memoize the code change handler to prevent unnecessary re-renders
  const handleCodeChange = useCallback((code: string) => {
    codeRef.current = code;
    onCodeChange(code);
  }, [onCodeChange]);
  
  // Setup CodeMirror editor
  const { editorRef, ignoreChangeRef } = useEditorSetup({
    onCodeChange: handleCodeChange,
    languageId: language.id,
    textareaRef
  });
  
  // Setup collaboration features
  const { handleRemoteChange, requestCodeSync } = useCollaboration({
    socketRef,
    roomId,
    username,
    editorRef,
    ignoreChangeRef,
    onCodeChange: handleCodeChange
  });
  
  // Apply initial code if available when the component mounts, or once it
  // arrives from the database (initialCode resolves asynchronously after mount)
  useEffect(() => {
    const codeToApply = initialCode || getRoomCode(roomId);
    if (codeToApply && editorRef.current && !initializedRef.current) {
      // Set flag to ignore the change event this will trigger
      ignoreChangeRef.current = true;
      editorRef.current.setValue(codeToApply);
      codeRef.current = codeToApply;
      initializedRef.current = true;
      onCodeChange(codeToApply);
      setTimeout(() => {
        ignoreChangeRef.current = false;
      }, 10);
    } else if (!codeToApply && socketRef.current) {
      // Explicitly request code sync if we don't have initial code
      // This helps ensure new users get the latest code
      requestCodeSync();
    }
  }, [roomId, onCodeChange, editorRef, ignoreChangeRef, socketRef, requestCodeSync, initialCode]);

  // Reindents every line using CodeMirror's own mode-aware indent logic
  // (cm.indentLine("smart") — same thing pressing Tab on a line does).
  // No new formatter dependency: CodeMirror's built-in indent already covers
  // every language this editor supports (a real formatter like Prettier only
  // handles JS/CSS/etc, not Python/C++/PHP/Ruby/SQL/Swift). Goes through
  // CodeMirror's normal edit APIs, so the existing "change" listener
  // (useCollaboration) picks it up and syncs it to other clients same as any
  // other edit — no special-case flag needed.
  useImperativeHandle(ref, () => ({
    formatCode: () => {
      const cm = editorRef.current;
      if (!cm) return;
      cm.operation(() => {
        for (let i = 0; i < cm.lineCount(); i++) {
          cm.indentLine(i, "smart");
        }
      });
    },
    // Opening a saved code item. Deliberately a normal `setValue` (no
    // ignoreChangeRef flag, unlike the initial-code-load effect above) so
    // the resulting "change" event flows through useCollaboration's own
    // listener exactly like any other edit — the existing WebSocket sync
    // mechanism is reused as-is, not bypassed, per the feature's own scope
    // rule (don't rewrite collaboration; loading a saved snapshot is just
    // "the user replaced the code," same as if they'd typed it).
    loadCode: (code: string) => {
      const cm = editorRef.current;
      if (!cm) return;
      cm.setValue(code);
      codeRef.current = code;
      initializedRef.current = true;
      handleCodeChange(code);
    },
    // Run must always compile what's actually in the buffer right now, not
    // a mirrored ref that's only as fresh as the last change-event that
    // happened to fire — read CodeMirror directly.
    getValue: () => editorRef.current?.getValue() ?? codeRef.current
  }), [editorRef, handleCodeChange]);

  return <textarea id="realtimeEditor" ref={textareaRef}></textarea>;
}));

Editor.displayName = "Editor";

export default Editor;
